import * as React from 'react';

/** Chiffre clé avec son libellé. À placer dans un `<dl>`. */
export function StatTile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-paper-raised px-4 py-3">
      <dt className="flex items-center gap-1.5 text-sm text-ink-3 [&_svg]:size-4 [&_svg]:text-ember">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-serif text-2xl leading-tight sm:text-3xl">{value}</dd>
    </div>
  );
}
