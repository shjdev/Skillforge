import { Badge, ProgressBar } from '@/components/ui/feedback';
import { ButtonLink } from '@/components/ui/button';
import { plural } from '@/lib/format';
import type { BookDetail } from '@/lib/library';

type Topic = BookDetail['topics'][number];

const LEVELS = ['', 'Débutant', 'Facile', 'Intermédiaire', 'Avancé', 'Expert'];

const STATE_BADGE: Record<Topic['state'], { label: string; tone: 'neutral' | 'accent' | 'success' | 'warning' }> = {
  GENERATING: { label: 'En génération', tone: 'warning' },
  PENDING: { label: 'À venir', tone: 'neutral' },
  ACTIVE: { label: 'En cours', tone: 'accent' },
  IN_PROGRESS: { label: 'Commencé', tone: 'neutral' },
  COMPLETED: { label: 'Validé', tone: 'success' },
  NOT_STARTED: { label: 'Pas commencé', tone: 'neutral' },
};

/**
 * Un thème du livre. `blockedBy` = nom du thème actif ailleurs : un seul thème
 * à la fois, jusqu'à la réussite de son quiz.
 */
export function TopicRow({ topic, blockedBy }: { topic: Topic; blockedBy: string | null }) {
  const pct = topic.totalLessons ? (topic.doneLessons / topic.totalLessons) * 100 : 0;
  const badge = STATE_BADGE[topic.state];
  const ready = topic.state !== 'GENERATING' && topic.state !== 'PENDING';
  const blocked = ready && blockedBy !== null && topic.state !== 'COMPLETED' && topic.state !== 'ACTIVE';
  const cta =
    topic.state === 'COMPLETED' ? 'Revoir' : topic.state === 'ACTIVE' || topic.doneLessons > 0 ? 'Continuer' : 'Commencer';

  return (
    <li className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
      <span className="font-serif text-3xl font-light text-ink-3 sm:w-8" aria-hidden>
        {topic.position}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-xl leading-tight">{topic.name}</h3>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
        {topic.description && <p className="mt-1 text-sm text-ink-2">{topic.description}</p>}
        <p className="mt-2 text-sm text-ink-3">
          {plural(topic.days, 'jour')} · {plural(topic.totalLessons, 'leçon')} ·{' '}
          {topic.quizQuestions ? `quiz de ${plural(topic.quizQuestions, 'question')}` : 'quiz en préparation'} ·{' '}
          {LEVELS[topic.maxDifficultyLevel] ?? 'Intermédiaire'}
        </p>
        {ready && topic.doneLessons > 0 && (
          <ProgressBar
            value={pct}
            tone={topic.state === 'COMPLETED' ? 'success' : 'accent'}
            label={`Avancement du thème « ${topic.name} »`}
            className="mt-3 max-w-sm"
          />
        )}
        {blocked && <p className="mt-2 text-sm text-ink-3">Terminez d’abord « {blockedBy} » pour commencer ce thème.</p>}
      </div>
      {ready && !blocked && (
        <ButtonLink
          href={`/learn/${topic.slug}`}
          variant={topic.state === 'COMPLETED' ? 'secondary' : 'accent'}
          className="self-start sm:self-center"
        >
          {cta}
        </ButtonLink>
      )}
    </li>
  );
}
