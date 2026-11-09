'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, KeyRound, ListChecks, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Badge, Notice, Skeleton } from '@/components/ui/feedback';
import { SectionTitle } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { toast } from '@/components/ui/toast';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { formatDateTime, formatPoints, plural } from '@/lib/format';
import type { ActivityItem, AdminOverview, AdminProfile } from '@/lib/admin';

const OVERVIEW_KEY = ['admin', 'overview'];
const ACTIVITY_KEY = ['admin', 'activity'];

type Pending = { profile: AdminProfile; action: 'reset-password' | 'delete' } | null;

export function AdminView() {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: OVERVIEW_KEY, queryFn: () => fetchJson<AdminOverview>('/api/admin/users') });
  const [pending, setPending] = React.useState<Pending>(null);

  const runAction = async () => {
    if (!pending) return;
    await fetchJson('/api/admin/users', { method: 'POST', json: { userId: pending.profile.id, action: pending.action } });
    toast.success(pending.action === 'delete' ? `Profil « ${pending.profile.name} » supprimé.` : 'Mot de passe réinitialisé.');
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  if (overview.isPending) return <Skeleton className="h-64 w-full" />;
  if (overview.isError) {
    return (
      <Notice tone="danger" title="Chargement impossible" action={<Button size="sm" onClick={() => overview.refetch()}>Réessayer</Button>}>
        {toErrorMessage(overview.error)}
      </Notice>
    );
  }

  const { totals, profiles } = overview.data;

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Profils" value={String(totals.profiles)} />
        <StatTile label="Livres" value={String(totals.books)} />
        <StatTile label="Imports (24 h)" value={String(totals.importsToday)} />
        <StatTile label="Appels IA (30 j)" value={String(totals.aiCalls)} />
      </dl>

      <section>
        <SectionTitle>Profils</SectionTitle>
        <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-paper-raised">
          {profiles.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="truncate">{p.name}</span>
                  {p.isSelf && <Badge tone="accent">Vous</Badge>}
                  {p.hasPassword && <Badge>Mot de passe perso</Badge>}
                </p>
                <p className="mt-1 text-sm text-ink-3">
                  {plural(p.books, 'livre')} · {plural(p.lessonsDone, 'leçon faite', 'leçons faites')} · {formatPoints(p.points)} pts
                  {p.importsToday > 0 && ` · ${plural(p.importsToday, 'import')} aujourd’hui`}
                </p>
                <p className="text-sm text-ink-3">
                  {p.lastActivity ? `Dernière activité : ${formatDateTime(p.lastActivity)}` : 'Aucune activité'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {p.hasPassword && (
                  <Button variant="secondary" size="sm" onClick={() => setPending({ profile: p, action: 'reset-password' })}>
                    <KeyRound aria-hidden />
                    Réinitialiser
                  </Button>
                )}
                {!p.isSelf && (
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setPending({ profile: p, action: 'delete' })}>
                    <Trash2 aria-hidden />
                    Supprimer
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ActivityFeed />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.action === 'delete' ? `Supprimer « ${pending.profile.name} » ?` : 'Réinitialiser le mot de passe ?'}
        description={
          pending?.action === 'delete'
            ? 'Ses livres, leçons, progression et historique seront supprimés définitivement. S’il se reconnecte, il repartira d’un profil vide.'
            : `${pending?.profile.name ?? 'Ce testeur'} saisira le code d’invitation à sa prochaine connexion, puis choisira un nouveau mot de passe.`
        }
        confirmLabel={pending?.action === 'delete' ? 'Supprimer le profil' : 'Réinitialiser'}
        onConfirm={runAction}
      />
    </div>
  );
}

const KIND: Record<ActivityItem['kind'], { label: string; icon: React.ReactNode }> = {
  LESSON: { label: 'Leçon', icon: <BookOpen aria-hidden /> },
  QUIZ: { label: 'Quiz', icon: <ListChecks aria-hidden /> },
  IMPORT: { label: 'Import', icon: <Upload aria-hidden /> },
};

function ActivityFeed() {
  const query = useQuery({
    queryKey: ACTIVITY_KEY,
    queryFn: () => fetchJson<{ activity: ActivityItem[] }>('/api/admin/activity'),
  });

  return (
    <section>
      <SectionTitle>Activité récente</SectionTitle>
      {query.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : query.isError ? (
        <Notice tone="danger" title="Activité indisponible">
          {toErrorMessage(query.error)}
        </Notice>
      ) : query.data.activity.length === 0 ? (
        <p className="text-ink-2">Aucune activité pour l’instant.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-paper-raised">
          {query.data.activity.map((a, i) => (
            <li key={`${a.at}-${i}`} className="flex items-start gap-3 px-4 py-3 text-sm">
              <span className="mt-0.5 text-ink-3 [&_svg]:size-4" title={KIND[a.kind].label}>
                {KIND[a.kind].icon}
                <span className="sr-only">{KIND[a.kind].label}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium">{a.who}</span> · {a.text}
                </p>
                <p className="text-ink-3">{formatDateTime(a.at)}</p>
              </div>
              <span className="shrink-0 font-mono text-ink-2">{a.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
