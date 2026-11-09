import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const IMPORT_STEPS = ['Fichier', 'Analyse', 'Validation', 'Génération'] as const;

/** Repère des 4 étapes de l'import (étape courante annoncée aux lecteurs d'écran). */
export function ImportStepper({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2 text-sm" aria-label="Étapes de l'import">
      {IMPORT_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs',
                done && 'border-ink bg-ink text-paper',
                active && 'border-ember bg-ember text-white',
                !done && !active && 'border-rule-strong text-ink-3',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn('truncate', active ? 'font-medium text-ink' : 'text-ink-3', 'hidden sm:inline')}>
              {label}
            </span>
            {i < IMPORT_STEPS.length - 1 && <span className="h-px flex-1 bg-rule" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
