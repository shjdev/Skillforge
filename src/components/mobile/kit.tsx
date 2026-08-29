'use client';

import React from 'react';
import { EMBER, L } from '@/lib/theme';

export function Chip({ label }: { label: string }) {
  const on = label === 'EN COURS';
  return (
    <span
      style={{
        fontSize: 9,
        letterSpacing: '0.12em',
        padding: '5px 8px',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
        color: on ? L.paper2 : L.ink3,
        background: on ? EMBER : 'transparent',
        border: `1px solid ${on ? EMBER : L.ruleFaint}`,
      }}
    >
      {label}
    </span>
  );
}

export function Segs({ level, wide, locked }: { level: number; wide?: boolean; locked?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 3, flex: '0 0 auto' }}>
      {Array.from({ length: 5 }, (_, k) => (
        <div
          key={k}
          style={{
            width: wide ? 20 : 11,
            height: 5,
            background: k < level ? (locked ? L.ink : EMBER) : L.ruleFaint3,
          }}
        />
      ))}
    </div>
  );
}

export function Ticks({ total, done }: { total: number; done: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: Math.max(total, 1) }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 20,
            background: i < done ? L.ink : 'transparent',
            border: `1px solid ${i < done ? L.ink : L.ruleFaint}`,
          }}
        />
      ))}
    </div>
  );
}

export function WeekMarks({ streak }: { streak: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', marginTop: 12 }}>
      {Array.from({ length: 7 }, (_, i) => {
        const on = i >= 7 - Math.min(streak, 7);
        return (
          <div key={i} style={{ width: 4, height: on ? 15 : 7, background: on ? EMBER : L.ruleFaint }} />
        );
      })}
    </div>
  );
}

export function MSkeleton({ h = 60 }: { h?: number }) {
  return (
    <div style={{ height: h, background: L.paper2, border: `1px solid ${L.rule}`, marginBottom: 12, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />
  );
}
