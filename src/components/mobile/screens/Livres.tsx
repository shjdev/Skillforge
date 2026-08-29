'use client';

import React, { useEffect, useState } from 'react';
import { EMBER, L, FONT_SERIF } from '@/lib/theme';
import { MSkeleton } from '@/components/mobile/kit';

interface BookRow {
  id: string;
  title: string;
  author: string;
  lessonsCount: number;
  topics: string[];
}

export default function MobileLivres() {
  const [books, setBooks] = useState<BookRow[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/books')
      .then((res) => res.json())
      .then((data) => setBooks(data.books || []))
      .catch(() => setBooks([]));
  }, []);

  return (
    <div style={{ padding: '20px 20px 26px' }}>
      <div style={{ fontFamily: FONT_SERIF, fontSize: 32, fontWeight: 300, lineHeight: 1.05, marginBottom: 8 }}>Bibliothèque</div>
      <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.65, marginBottom: 22 }}>
        Les ouvrages importés par l&apos;administrateur. Chaque leçon cite sa source.
      </div>

      {books === null ? (
        <>
          <MSkeleton h={80} />
          <MSkeleton h={80} />
          <MSkeleton h={80} />
        </>
      ) : books.length === 0 ? (
        <div style={{ border: `1px dashed ${L.ruleFaint}`, padding: '36px 20px', textAlign: 'center', color: L.ink3, fontSize: 12 }}>
          Aucun ouvrage pour le moment.
        </div>
      ) : (
        books.map((b) => {
          const indexed = b.lessonsCount > 0;
          return (
            <div key={b.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 0', borderBottom: `1px solid ${L.rule}` }}>
              <div style={{ width: 32, height: 58, background: 'oklch(0.90 0.012 78)', borderLeft: `3px solid ${EMBER}`, flex: '0 0 auto' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 19, fontStyle: 'italic', lineHeight: 1.2 }}>{b.title}</div>
                <div style={{ fontSize: 11, color: L.ink2, marginTop: 5 }}>{b.author}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 10, color: L.ink3 }}>
                    {b.topics[0] || '—'} · {indexed ? `${b.lessonsCount} leçons` : 'à générer'}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      padding: '4px 8px',
                      whiteSpace: 'nowrap',
                      border: `1px solid ${indexed ? L.ruleFaint : EMBER}`,
                      color: indexed ? L.ink2 : EMBER,
                    }}
                  >
                    {indexed ? 'INDEXÉ' : 'EN COURS'}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
