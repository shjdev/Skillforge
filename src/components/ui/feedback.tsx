import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const badgeTone: Record<Tone, string> = {
  neutral: 'bg-paper-sunken text-ink-2',
  accent: 'bg-ember-soft text-ember-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

/** Pastille de statut douce : toujours un texte, jamais la couleur seule. */
export function Badge({ tone = 'neutral', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider',
        badgeTone[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Barre de progression avec valeur accessible. */
export function ProgressBar({
  value,
  tone = 'accent',
  label,
  className,
}: {
  value: number;
  tone?: 'accent' | 'success';
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-paper-sunken', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tone === 'success' ? 'bg-success' : 'bg-ember')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse-soft rounded-md bg-paper-sunken', className)} />;
}

const noticeStyle: Record<Exclude<Tone, 'neutral' | 'accent'> | 'info', { box: string; Icon: typeof Info }> = {
  info: { box: 'border-rule bg-paper-raised text-ink', Icon: Info },
  success: { box: 'border-success/30 bg-success-soft text-ink', Icon: CheckCircle2 },
  warning: { box: 'border-warning/30 bg-warning-soft text-ink', Icon: AlertTriangle },
  danger: { box: 'border-danger/30 bg-danger-soft text-ink', Icon: XCircle },
};

/** Message encadré (information, succès, avertissement, erreur). */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { box, Icon } = noticeStyle[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', box, className)}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-ink-3',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-ink-2')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** État vide : explique pourquoi c'est vide et propose l'étape suivante. */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-rule-strong px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <div className="mb-4 text-ember [&_svg]:size-8">{icon}</div>}
      <h2 className="font-serif text-2xl leading-tight">{title}</h2>
      {children && <div className="mt-2 max-w-md text-ink-2">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
