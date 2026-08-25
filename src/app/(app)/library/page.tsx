'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { L, EMBER } from '@/lib/theme';

interface LibraryBook {
  id: string;
  title: string;
  author: string;
  domain: string;
  lessonsCount: number;
}

export default function LibraryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async (): Promise<LibraryBook[]> => {
      const res = await fetch('/api/books');
      const data = await res.json();
      return data.books || [];
    },
  });

  return (
    <div style={{ padding: '44px 52px 90px', maxWidth: 1100 }}>
      <h1 style={{ margin: '0 0 10px', fontFamily: 'var(--font-serif-display)', fontWeight: 300, fontSize: 42, lineHeight: 1.05 }}>
        Bibliothèque
      </h1>
      <p style={{ margin: '0 0 34px', fontSize: 12, color: L.ink2, lineHeight: 1.7, maxWidth: '60ch' }}>
        Les ouvrages de référence importés par l&rsquo;administrateur. Chaque leçon cite la source dont elle est tirée.
      </p>

      {isLoading ? (
        <div style={{ color: L.ink3, fontSize: 12 }}>Chargement…</div>
      ) : !data || data.length === 0 ? (
        <div style={{ border: `1px dashed ${L.rule3}`, padding: 40, textAlign: 'center', color: L.ink3, fontSize: 12 }}>
          Aucun ouvrage indexé pour le moment.
        </div>
      ) : (
        data.map((b) => (
          <div
            key={b.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px minmax(160px,1fr) minmax(104px,150px) minmax(74px,96px) minmax(88px,104px)',
              gap: 16,
              alignItems: 'center',
              padding: '20px 0',
              borderTop: `1px solid ${L.rule}`,
            }}
          >
            <div style={{ height: 64, background: L.ruleFaint3, borderLeft: `3px solid ${EMBER}` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 20, fontStyle: 'italic' }}>{b.title}</div>
              <div style={{ fontSize: 11, color: L.ink2, marginTop: 4 }}>{b.author}</div>
            </div>
            <div style={{ fontSize: 11, color: L.ink2, minWidth: 0 }}>{b.domain}</div>
            <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
              {b.lessonsCount} leçon{b.lessonsCount > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  padding: '5px 9px',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${b.lessonsCount > 0 ? L.rule3 : EMBER}`,
                  color: b.lessonsCount > 0 ? L.ink2 : EMBER,
                }}
              >
                {b.lessonsCount > 0 ? 'INDEXÉ' : 'SANS LEÇON'}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
