'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { useMounted } from '@/hooks/useMounted';
import { D, EMBER } from '@/lib/theme';

const navItems = [
  { name: 'Synthèse', href: '/admin/dashboard' },
  { name: 'Cours', href: '/admin/courses' },
  { name: 'Quiz', href: '/admin/quizzes' },
  { name: 'Import', href: '/admin/library' },
  { name: 'Utilisateur', href: '/admin/users' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const userProfile = useAppStore((state) => state.userProfile);
  const mounted = useMounted();

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', background: D.bg, color: D.text, fontFamily: 'var(--font-mono-ui)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26, height: 56, padding: '0 22px', borderBottom: `1px solid ${D.border}`, flex: '0 0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 180, flex: '0 0 auto' }}>
          <div style={{ width: 11, height: 11, background: EMBER }} />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.20em' }}>SKILLFORGE</span>
          <span style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text2, border: `1px solid ${D.border3}`, padding: '2px 5px' }}>ADMIN</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, letterSpacing: '0.12em', color: D.text2 }}>
          MONO-UTILISATEUR · {mounted ? userProfile?.name || 'Apprenant' : ''}
        </span>
        <div style={{ width: 1, height: 20, background: D.border }} />
        <Link
          href="/dashboard"
          style={{ fontSize: 10, letterSpacing: '0.14em', color: EMBER, border: `1px solid ${D.border3}`, padding: '7px 12px', textDecoration: 'none' }}
        >
          ← ESPACE APPRENANT
        </Link>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: 196, flex: '0 0 auto', borderRight: `1px solid ${D.border}`, padding: '22px 0' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: D.text3, padding: '0 20px 11px' }}>GESTION</div>
          {navItems.map((item) => {
            const isActive = pathname ? pathname.startsWith(item.href) : false;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 20px', textDecoration: 'none' }}
              >
                <div style={{ width: 3, height: 13, background: isActive ? EMBER : 'transparent', flex: '0 0 auto' }} />
                <span style={{ fontSize: 11, letterSpacing: '0.06em', fontWeight: isActive ? 600 : 400, color: isActive ? D.heading : D.text2 }}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
