// Console d'administration : profils, usage et activité. Lecture seule sauf
// la réinitialisation de mot de passe et la suppression d'un profil.
import { prisma } from './prisma';
import { AppError } from './app-error';
import { getSessionContext } from './serverAuth';
import { quotaWindowStart } from './import/quota';

const USAGE_DAYS = 30;

/** Refuse l'accès si la session n'est pas administrateur (en plus du proxy). */
export async function requireAdmin() {
  const ctx = await getSessionContext();
  if (!ctx.isAdmin) throw new AppError('Accès réservé à l’administrateur.', 403);
  return ctx;
}

export interface AdminProfile {
  id: string;
  name: string;
  books: number;
  lessonsDone: number;
  points: number;
  lastActivity: string | null;
  importsToday: number;
  hasPassword: boolean;
  isSelf: boolean;
}

export interface AdminOverview {
  totals: { profiles: number; books: number; lessonsGenerated: number; importsToday: number; aiCalls: number };
  profiles: AdminProfile[];
}

const latest = (...dates: (Date | null | undefined)[]) => {
  const ms = dates.filter((d): d is Date => !!d).map((d) => d.getTime());
  return ms.length ? new Date(Math.max(...ms)).toISOString() : null;
};

export async function getAdminOverview(selfId: string): Promise<AdminOverview> {
  const since = new Date(Date.now() - USAGE_DAYS * 86_400_000);
  const today = quotaWindowStart();

  const [profiles, lessonsGenerated, jobs, lastSessions, lastImports] = await Promise.all([
    prisma.userProfile.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        totalXp: true,
        updatedAt: true,
        credential: { select: { userId: true } },
        _count: { select: { books: true, sessions: { where: { completed: true } } } },
      },
    }),
    prisma.lesson.count(),
    prisma.importJob.findMany({
      where: { createdAt: { gte: since } },
      select: { ownerId: true, createdAt: true, status: true, analysis: true, cursor: true },
    }),
    prisma.userSession.groupBy({ by: ['userId'], where: { completed: true }, _max: { completedAt: true } }),
    prisma.importJob.groupBy({ by: ['ownerId'], _max: { createdAt: true } }),
  ]);

  const lastSession = new Map(lastSessions.map((s) => [s.userId, s._max.completedAt]));
  const lastImport = new Map(lastImports.map((j) => [j.ownerId, j._max.createdAt]));
  const todayJobs = jobs.filter((j) => j.createdAt >= today && j.status !== 'ERROR');
  // Un appel pour l'analyse, puis un par extrait généré (les nouvelles tentatives ne sont pas comptées).
  const aiCalls = jobs.reduce((n, j) => n + (j.analysis ? 1 : 0) + j.cursor, 0);

  return {
    totals: {
      profiles: profiles.length,
      books: profiles.reduce((n, p) => n + p._count.books, 0),
      lessonsGenerated,
      importsToday: todayJobs.length,
      aiCalls,
    },
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      books: p._count.books,
      lessonsDone: p._count.sessions,
      points: p.totalXp,
      lastActivity: latest(lastSession.get(p.id), lastImport.get(p.id)),
      importsToday: todayJobs.filter((j) => j.ownerId === p.id).length,
      hasPassword: !!p.credential,
      isSelf: p.id === selfId,
    })),
  };
}

export interface ActivityItem {
  at: string;
  kind: 'LESSON' | 'QUIZ' | 'IMPORT';
  who: string;
  text: string;
  detail: string;
}

const IMPORT_STATUS: Record<string, string> = {
  ANALYZING: 'analyse',
  REVIEW: 'à vérifier',
  GENERATING: 'génération',
  DONE: 'terminé',
  ERROR: 'échec',
  CANCELLED: 'arrêté',
};

/** Les derniers événements, tous profils confondus. */
export async function getActivity(limit = 20): Promise<ActivityItem[]> {
  const [sessions, attempts, jobs, profiles] = await Promise.all([
    prisma.userSession.findMany({
      where: { completed: true, completedAt: { not: null } },
      select: { userId: true, completedAt: true, lesson: { select: { title: true } } },
      orderBy: { completedAt: 'desc' },
      take: limit,
    }),
    prisma.quizAttempt.findMany({
      select: { userId: true, attemptedAt: true, percentage: true, passed: true, quiz: { select: { topic: { select: { name: true } } } } },
      orderBy: { attemptedAt: 'desc' },
      take: limit,
    }),
    prisma.importJob.findMany({
      select: { ownerId: true, createdAt: true, fileName: true, status: true, lessonsCreated: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.userProfile.findMany({ select: { id: true, name: true } }),
  ]);

  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const who = (id: string) => names.get(id) ?? id;

  const items: ActivityItem[] = [
    ...sessions.map((s) => ({
      at: s.completedAt!.toISOString(),
      kind: 'LESSON' as const,
      who: who(s.userId),
      text: s.lesson.title,
      detail: '+50',
    })),
    ...attempts.map((a) => ({
      at: a.attemptedAt.toISOString(),
      kind: 'QUIZ' as const,
      who: who(a.userId),
      text: `Quiz « ${a.quiz.topic.name} » ${a.passed ? 'réussi' : 'échoué'}`,
      detail: `${Math.round(a.percentage)} %`,
    })),
    ...jobs.map((j) => ({
      at: j.createdAt.toISOString(),
      kind: 'IMPORT' as const,
      who: who(j.ownerId),
      text: `Import de ${j.fileName} (${IMPORT_STATUS[j.status] ?? j.status})`,
      detail: `${j.lessonsCreated} leçons`,
    })),
  ];

  // Dates ISO : l'ordre alphabétique est l'ordre chronologique.
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Le testeur choisira un nouveau mot de passe à sa prochaine connexion. */
export async function resetPassword(userId: string) {
  const { count } = await prisma.userCredential.deleteMany({ where: { userId } });
  if (!count) throw new AppError('Ce profil n’a pas de mot de passe personnel.', 404);
}

/** Supprime un profil et toutes ses données (livres, leçons, progression : en cascade). */
export async function deleteProfile(adminId: string, userId: string) {
  if (userId === adminId) throw new AppError('Vous ne pouvez pas supprimer votre propre profil.');
  const { count } = await prisma.userProfile.deleteMany({ where: { id: userId } });
  if (!count) throw new AppError('Profil introuvable.', 404);
}
