'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { useMounted } from '@/hooks/useMounted';
import { L, EMBER, formatPoints } from '@/lib/theme';

const navItems = [
  { name: 'Tableau de bord', href: '/dashboard' },
  { name: 'Atelier du jour', href: '/learn' },
  { name: 'Révision', href: '/revision' },
  { name: 'Statistiques', href: '/stats' },
  { name: 'Bibliothèque', href: '/library' },
  { name: 'Horaires', href: '/schedule' },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const userProfile = useAppStore((state) => state.userProfile);
  const mounted = useMounted();

  return (
    <aside
      style={{
        width: 212,
        flex: '0 0 auto',
        borderRight: `1px solid ${L.rule}`,
        padding: '26px 0',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        background: L.paper,
        color: L.ink,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px 22px' }}>
        <div style={{ width: 11, height: 11, background: EMBER, flex: '0 0 auto' }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.20em' }}>SKILLFORGE</span>
      </div>

      <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, padding: '0 22px 12px' }}>
        ESPACE APPRENANT
      </div>

      {navItems.map((item) => {
        const isActive = pathname ? pathname.startsWith(item.href) : false;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '9px 22px',
              textDecoration: 'none',
            }}
          >
            <div style={{ width: 3, height: 14, background: isActive ? EMBER : 'transparent', flex: '0 0 auto' }} />
            <span
              style={{
                fontSize: 12,
                letterSpacing: '0.05em',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? L.ink : L.ink2,
              }}
            >
              {item.name}
            </span>
          </Link>
        );
      })}

      <div style={{ flex: 1 }} />

      <div style={{ padding: '0 22px' }}>
        <div style={{ height: 1, background: L.rule, marginBottom: 16 }} />
        <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, lineHeight: 1.7, marginBottom: 12 }}>
          CAPITAL
          <br />
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 0, color: L.ink, fontVariantNumeric: 'tabular-nums' }}>
            {mounted ? formatPoints(userProfile?.totalXp || 0) : '0'}
          </span>{' '}
          <span style={{ fontSize: 10, letterSpacing: '0.1em', color: L.ink2 }}>PTS</span>
        </div>
        <Link
          href="/admin/dashboard"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            color: L.ink2,
            borderBottom: `1px solid ${L.rule3}`,
            paddingBottom: 2,
            textDecoration: 'none',
          }}
        >
          ATELIER → ADMIN
        </Link>
      </div>
    </aside>
  );
};
