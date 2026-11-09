import * as React from 'react';
import { cn } from '@/lib/utils';

/** En-tête de page : petite étiquette, titre serif, description, action principale. */
export function PageHeader({
  kicker,
  title,
  description,
  action,
  className,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {kicker && <div className="kicker mb-3">{kicker}</div>}
        <h1 className="font-serif text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-base text-ink-2">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

/** Conteneur de page : largeur max et marges cohérentes sur mobile et bureau. */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12 md:pb-16', className)} {...props} />;
}

/** Titre de section à l'intérieur d'une page. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="kicker !text-ink-2">{children}</h2>
      {action}
    </div>
  );
}
