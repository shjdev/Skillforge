'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileShell } from '@/components/mobile/MobileShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import { L } from '@/lib/theme';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileShell>{children}</MobileShell>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: L.paper, color: L.ink }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
