import { CheckCircle2, Circle, Lock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopicView } from '@/lib/learn';

type View = Extract<TopicView, { locked: false }>;
export type Selection = { kind: 'lesson'; id: string } | { kind: 'quiz' };

export const SESSION_LABEL: Record<string, string> = { MORNING: 'Cours', EVENING: 'Pratique', FULL_DAY: 'Leçon' };

/** Sommaire du thème : leçons regroupées par jour, puis le quiz. */
export function DayList({ view, selection, onSelect }: { view: View; selection: Selection; onSelect: (s: Selection) => void }) {
  const days = new Map<number, View['lessons']>();
  for (const l of view.lessons) days.set(l.dayNumber, [...(days.get(l.dayNumber) ?? []), l]);
  const quiz = view.quiz;

  return (
    <nav aria-label="Sommaire du thème" className="flex flex-col gap-4">
      {[...days.entries()].map(([day, lessons]) => (
        <div key={day}>
          <p className="kicker mb-1.5">Jour {day}</p>
          <ul className="flex flex-col">
            {lessons.map((l) => {
              const current = selection.kind === 'lesson' && selection.id === l.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => onSelect({ kind: 'lesson', id: l.id })}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      current ? 'bg-paper-sunken text-ink' : 'text-ink-2 hover:bg-paper-sunken/60 hover:text-ink',
                    )}
                  >
                    {l.done ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Faite" />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-ink-3" aria-label="À faire" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] uppercase tracking-wider text-ink-3">{SESSION_LABEL[l.sessionType] ?? 'Leçon'}</span>
                      <span className={cn('line-clamp-2', current && 'font-medium')}>{l.title}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {quiz && (
        <button
          type="button"
          disabled={!quiz.available && view.topic.status !== 'COMPLETED'}
          aria-current={selection.kind === 'quiz' ? 'page' : undefined}
          onClick={() => onSelect({ kind: 'quiz' })}
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed',
            selection.kind === 'quiz' ? 'border-ember bg-ember-soft' : 'border-rule hover:border-rule-strong',
            !quiz.available && view.topic.status !== 'COMPLETED' && 'text-ink-3',
          )}
        >
          {quiz.available || view.topic.status === 'COMPLETED' ? (
            <Trophy className="size-4 shrink-0 text-ember" aria-hidden />
          ) : (
            <Lock className="size-4 shrink-0" aria-hidden />
          )}
          <span>
            <span className="block font-medium text-ink">Quiz de validation</span>
            <span className="text-ink-3">
              {view.topic.status === 'COMPLETED'
                ? 'Réussi'
                : quiz.available
                  ? `${quiz.questionCount} questions · ${quiz.passingScore} % requis`
                  : 'Après toutes les leçons'}
            </span>
          </span>
        </button>
      )}
    </nav>
  );
}
