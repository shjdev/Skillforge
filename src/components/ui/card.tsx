import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-rule bg-paper-raised', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />;
}

export function CardHeader({
  title,
  kicker,
  action,
  className,
}: {
  title: React.ReactNode;
  kicker?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6', className)}>
      <div className="min-w-0">
        {kicker && <div className="kicker mb-1">{kicker}</div>}
        <h2 className="font-serif text-xl leading-tight">{title}</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
