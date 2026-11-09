'use client';

import * as React from 'react';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Day {
  date: string; // AAAA-MM-JJ
  lessons: number;
  minutes: number;
}

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const short = (key: string) => parse(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const long = (key: string) => parse(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Leçons faites par jour : une colonne par jour, une seule série (pas de
 * légende, le titre la nomme). Survol ou focus clavier : valeur exacte.
 * Le tableau des données reste accessible sans survol.
 */
export function ActivityChart({ days }: { days: Day[] }) {
  const [active, setActive] = React.useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.lessons));
  const total = days.reduce((s, d) => s + d.lessons, 0);

  return (
    <figure>
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">Leçons faites par jour</span>
        <span className="text-sm text-ink-3">
          {plural(total, 'leçon')} sur {days.length} jours
        </span>
      </figcaption>

      <div className="relative">
        {/* Repère de la valeur maximale, discret */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2" aria-hidden>
          <span className="font-mono text-[11px] text-ink-3">{max}</span>
          <span className="h-px flex-1 border-t border-dashed border-rule" />
        </div>

        <div className="flex h-44 items-end gap-[2px] border-b border-rule-strong pt-5" onPointerLeave={() => setActive(null)}>
          {days.map((d, i) => {
            const pct = (d.lessons / max) * 100;
            return (
              <button
                key={d.date}
                type="button"
                aria-label={`${long(d.date)} : ${plural(d.lessons, 'leçon')}, ${d.minutes} min`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'block w-full max-w-6 rounded-t-[4px] bg-ember transition-opacity',
                    active !== null && active !== i && 'opacity-60',
                    'group-focus-visible:ring-2 group-focus-visible:ring-ink',
                  )}
                  style={{ height: d.lessons ? `${Math.max(pct, 3)}%` : 0 }}
                />
              </button>
            );
          })}
        </div>

        {active !== null && (
          <div
            role="status"
            className={cn(
              'pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-md border border-rule bg-paper-raised px-3 py-2 text-sm shadow-raised',
              // Aux extrémités, la bulle s'aligne sur le bord au lieu de déborder.
              active < 4 ? 'translate-x-0' : active > days.length - 5 ? '-translate-x-full' : '-translate-x-1/2',
            )}
            style={{
              left: `${((active < 4 ? active : active > days.length - 5 ? active + 1 : active + 0.5) / days.length) * 100}%`,
            }}
          >
            <p className="font-medium text-ink">{plural(days[active].lessons, 'leçon')}</p>
            <p className="whitespace-nowrap text-ink-3">
              {long(days[active].date)} · {days[active].minutes} min
            </p>
          </div>
        )}

        <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-3" aria-hidden>
          <span>{short(days[0].date)}</span>
          <span>{short(days[Math.floor(days.length / 2)].date)}</span>
          <span>Aujourd’hui</span>
        </div>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">Voir les données</summary>
        <table className="mt-3 w-full text-left">
          <thead>
            <tr className="border-b border-rule text-ink-3">
              <th className="py-1.5 font-medium">Jour</th>
              <th className="py-1.5 text-right font-medium">Leçons</th>
              <th className="py-1.5 text-right font-medium">Minutes</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.date} className="border-b border-rule/60">
                <td className="py-1.5">{long(d.date)}</td>
                <td className="py-1.5 text-right font-mono">{d.lessons}</td>
                <td className="py-1.5 text-right font-mono">{d.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
