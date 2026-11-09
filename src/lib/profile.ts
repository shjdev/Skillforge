import { prisma } from '@/lib/prisma';
import { isAuthEnabled } from '@/lib/authGate';
import { ensureUserProfile } from '@/lib/serverAuth';

/** Réglages renvoyés au navigateur (jamais le hash du mot de passe). */
export async function profileView(userId: string, isAdmin: boolean) {
  const [user, credential] = await Promise.all([
    ensureUserProfile(userId),
    prisma.userCredential.findUnique({ where: { userId }, select: { userId: true } }),
  ]);
  return {
    id: user.id,
    name: user.name,
    sessionMode: user.sessionMode as 'TWO_SESSIONS' | 'ONE_SESSION',
    morningTime: user.morningTime,
    eveningTime: user.eveningTime,
    singleSessionTime: user.singleSessionTime,
    reminders: user.notificationSettings?.desktopEnabled ?? true,
    /** Le mot de passe personnel se change ici (testeurs connectés avec un mot de passe). */
    canChangePassword: isAuthEnabled() && !isAdmin && Boolean(credential),
  };
}

export type ProfileView = Awaited<ReturnType<typeof profileView>>;
