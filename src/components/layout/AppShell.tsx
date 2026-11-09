'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Home,
  LogOut,
  Plus,
  RotateCcw,
  Settings,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMe } from '@/hooks/useMe';
import { formatPoints } from '@/lib/format';
import { ButtonLink } from '@/components/ui/button';
import { ShjSignature } from '@/components/brand/ShjSignature';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Préfixes de route qui rendent l'entrée active */
  match?: string[];
}

const NAV: NavItem[] = [
  { label: "Aujourd'hui", href: '/dashboard', icon: Home },
  { label: 'Bibliothèque', href: '/library', icon: BookOpen, match: ['/library', '/learn'] },
  { label: 'Révision', href: '/revision', icon: RotateCcw },
  { label: 'Statistiques', href: '/stats', icon: BarChart3 },
  { label: 'Réglages', href: '/settings', icon: Settings },
];

const IMPORT_HREF = '/library/import';

function isActive(pathname: string, item: NavItem): boolean {
  if (pathname.startsWith(IMPORT_HREF)) return false;
  return (item.match ?? [item.href]).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login';
}

/** Coquille unique de l'appli : barre latérale sur bureau, barre d'onglets sur mobile. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const { data: me } = useMe();

  return (
    <div className="flex min-h-screen w-full">
      {/* Barre latérale (≥ 768 px) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-rule bg-paper md:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-6 pb-6 pt-7">
          <span className="size-3 bg-ember" aria-hidden />
          <span className="font-mono text-sm font-semibold tracking-[0.2em]">SKILLFORGE</span>
        </Link>

        <div className="px-4 pb-4">
          <ButtonLink href={IMPORT_HREF} variant="accent" className="w-full">
            <Plus /> Importer un livre
          </ButtonLink>
        </div>

        <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors',
                  active ? 'bg-paper-sunken font-medium text-ink' : 'text-ink-2 hover:bg-paper-sunken/60 hover:text-ink',
                )}
              >
                <item.icon className={cn('size-[18px]', active ? 'text-ember' : 'text-ink-3')} aria-hidden />
                {item.label}
              </Link>
            );
          })}
          {me?.isAdmin && (
            <Link
              href="/admin"
              aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
              className={cn(
                'mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors',
                pathname.startsWith('/admin')
                  ? 'bg-paper-sunken font-medium text-ink'
                  : 'text-ink-2 hover:bg-paper-sunken/60 hover:text-ink',
              )}
            >
              <Shield className="size-[18px] text-ink-3" aria-hidden />
              Administration
            </Link>
          )}
        </nav>

        <div className="mt-auto px-6 pb-6">
          <div className="border-t border-rule pt-5">
            <div className="kicker">Profil</div>
            <div className="mt-1 truncate text-[15px] font-medium">{me?.name ?? '—'}</div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-semibold tabular-nums">{formatPoints(me?.totalXp ?? 0)}</span>
              <span className="kicker">pts</span>
              {me && me.currentStreak > 0 && (
                <span className="ml-auto font-mono text-xs text-ink-2">série {me.currentStreak} j</span>
              )}
            </div>
            {me?.authEnabled && (
              <button
                onClick={logout}
                className="mt-4 inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink"
              >
                <LogOut className="size-4" aria-hidden /> Se déconnecter
              </button>
            )}
          </div>
          <ShjSignature className="mt-6" />
        </div>
      </aside>

      {/* Contenu */}
      <main className="min-w-0 flex-1">{children}</main>

      {/* Barre d'onglets (< 768 px) */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {[NAV[0], NAV[1]].map((item) => (
          <TabLink key={item.href} item={item} active={isActive(pathname, item)} />
        ))}
        <Link
          href={IMPORT_HREF}
          aria-label="Importer un livre"
          className="flex flex-col items-center justify-center gap-0.5 py-2"
        >
          <span className="grid size-10 place-items-center rounded-full bg-ember text-white shadow-raised">
            <Plus className="size-5" aria-hidden />
          </span>
        </Link>
        {[NAV[2], NAV[4]].map((item) => (
          <TabLink key={item.href} item={item} active={isActive(pathname, item)} />
        ))}
      </nav>
    </div>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn('flex flex-col items-center justify-center gap-1 py-2 text-[11px]', active ? 'text-ink' : 'text-ink-3')}
    >
      <item.icon className={cn('size-5', active && 'text-ember')} aria-hidden />
      {item.label}
    </Link>
  );
}
