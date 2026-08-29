'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { useMounted } from '@/hooks/useMounted';
import { EMBER, L, D } from '@/lib/theme';

const TABS = [
  { href: '/dashboard', label: 'Accueil' },
  { href: '/learn', label: 'Atelier' },
  { href: '/library', label: 'Livres' },
  { href: '/schedule', label: 'Horaires' },
];

/**
 * The mobile chrome (compact header + bottom tab bar) used in place of the
 * desktop Sidebar/Header once the viewport narrows below 768px — see
 * useIsMobile(). Mirrors /m/layout.tsx's shell but targets the same URLs as
 * the desktop app (/dashboard, /learn, …) instead of a separate /m/* tree,
 * so the switch is a live viewport reflow, not a navigation.
 */
export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;
  const userProfile = useAppStore((state) => state.userProfile);
  const mounted = useMounted();

  return (
    <div
      style={{
        minHeight: '100dvh',
        maxWidth: 430,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: isAdmin ? D.bg : L.paper,
        color: isAdmin ? D.text : L.ink,
        fontFamily: 'var(--font-mono-ui)',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 52,
          padding: '0 20px',
          borderBottom: `1px solid ${isAdmin ? D.border : L.rule}`,
          background: isAdmin ? D.bg : L.paper,
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ width: 11, height: 11, background: EMBER, flex: '0 0 auto' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em' }}>SKILLFORGE</span>
        <div style={{ flex: 1 }} />
        {!isAdmin && (
          <>
            <span style={{ fontSize: 10, letterSpacing: '0.12em', color: L.ink3 }}>
              SÉRIE <span style={{ color: L.ink, fontWeight: 600 }}>{mounted ? userProfile?.currentStreak || 0 : 0}</span>
            </span>
            <Link href="/admin/dashboard" style={{ fontSize: 9, letterSpacing: '0.14em', color: EMBER, border: `1px solid ${L.ruleFaint}`, padding: '5px 8px', textDecoration: 'none' }}>
              ADMIN
            </Link>
          </>
        )}
        {isAdmin && (
          <span style={{ fontSize: 9, letterSpacing: '0.14em', color: D.text3 }}>SYNTHÈSE ADMIN</span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, paddingBottom: isAdmin ? 24 : 84 }}>{children}</div>

      {!isAdmin && (
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 430,
            borderTop: `1px solid ${L.rule}`,
            background: L.paper3,
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 50,
          }}
        >
          {TABS.map((t) => {
            const on = t.href === '/dashboard' ? pathname === '/dashboard' || pathname === '/' : pathname?.startsWith(t.href) ?? false;
            return (
              <Link
                key={t.href}
                href={t.href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  paddingTop: 11,
                  paddingBottom: 9,
                  minHeight: 56,
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    background: on ? EMBER : 'transparent',
                    border: `1px solid ${on ? EMBER : L.ruleFaint}`,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.10em',
                    color: on ? L.ink : L.ink2,
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
