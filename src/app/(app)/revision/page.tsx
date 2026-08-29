'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/useIsMobile';
import { L, EMBER } from '@/lib/theme';
import MobileAccueil from '@/components/mobile/screens/Accueil';

function SkeletonLine({ w, h = 11 }: { w?: number | string; h?: number }) {
  return <div style={{ width: w ?? '100%', height: h, background: L.paper2, border: `1px solid ${L.ruleFaint3}`, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />;
}
function SkeletonCard() {
  return <div style={{ minHeight: 110, background: L.paper2, border: `1px solid ${L.ruleFaint3}`, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />;
}

interface RevisionLesson {
  lessonId: string;
  title: string;
  dayNumber: number;
  chapterCitation: string | null;
  bookTitle: string | null;
  concepts: string[];
  note: string | null;
  topicName: string;
  domainName: string;
  domainColor: string;
  completedAt: string | null;
}

export default function RevisionPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileAccueil />;
  return <RevisionDesktop />;
}

function RevisionDesktop() {
  const [lessons, setLessons] = useState<RevisionLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/revision')
      .then((res) => res.json())
      .then((data) => {
        if (data.lessons) setLessons(data.lessons);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalCards = lessons.reduce((acc, l) => acc + l.concepts.length, 0);
  const toggleFlip = (key: string) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '44px 52px 90px', maxWidth: 980 }}>
        <SkeletonLine w={130} />
        <div style={{ height: 18 }} />
        <SkeletonLine w={220} h={32} />
        <div style={{ height: 30 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '44px 52px 90px', maxWidth: 980 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.20em', color: EMBER, marginBottom: 16 }}>RÉVISION ESPACÉE</div>
      <h1 style={{ margin: '0 0 14px', fontFamily: 'var(--font-serif-display)', fontWeight: 400, fontSize: 42, lineHeight: 1.1 }}>
        Flashcards
      </h1>
      <p style={{ margin: '0 0 36px', fontSize: 13, lineHeight: 1.7, color: L.ink2, maxWidth: '58ch' }}>
        Chaque concept clé des leçons que tu as validées devient une carte. Clique sur une carte pour révéler
        la leçon dont elle vient : si tu ne t&apos;en souviens plus, c&apos;est qu&apos;il faut la repasser.
      </p>

      {totalCards === 0 ? (
        <div style={{ border: `1px dashed ${L.rule3}`, padding: '44px', textAlign: 'center', color: L.ink3, fontSize: 12 }}>
          Aucune carte pour l&apos;instant : valide ta première leçon dans{' '}
          <Link href="/learn" style={{ color: EMBER, textDecoration: 'none' }}>l&apos;atelier du jour</Link>.        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', color: L.ink3, marginBottom: 26 }}>
            {lessons.length} LEÇON{lessons.length > 1 ? 'S' : ''} · {totalCards} CARTES
          </div>
          {lessons.map((lesson) => (
            <div key={lesson.lessonId} style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, background: lesson.domainColor || EMBER }} />
                <span style={{ fontSize: 10, letterSpacing: '0.14em', color: L.ink2 }}>
                  {lesson.domainName.toUpperCase()} / {lesson.topicName.toUpperCase()} · JOUR {lesson.dayNumber}
                </span>
              </div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', color: L.ink3, marginBottom: 14 }}>{lesson.title.toUpperCase()}</div>
              {lesson.note && (
                <div style={{ borderLeft: `2px solid ${EMBER}`, padding: '4px 0 4px 14px', marginBottom: 16, fontSize: 12, lineHeight: 1.7, color: L.ink2, fontStyle: 'italic' }}>
                  {lesson.note}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                {lesson.concepts.map((concept, ci) => {
                  const key = `${lesson.lessonId}-${ci}`;
                  const isFlipped = flipped.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleFlip(key)}
                      style={{
                        all: 'unset',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        border: `1px solid ${isFlipped ? L.rule3 : L.rule}`,
                        background: isFlipped ? L.paper2 : L.paper,
                        padding: '20px 18px',
                        minHeight: 110,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ fontSize: isFlipped ? 11 : 13, lineHeight: 1.6, fontWeight: isFlipped ? 400 : 600, color: isFlipped ? L.ink2 : L.ink }}>
                        {isFlipped ? `Vu dans : ${lesson.title}${lesson.bookTitle ? `\n(${lesson.bookTitle})` : ''}` : concept}
                      </div>
                      <div style={{ fontSize: 8, letterSpacing: '0.16em', color: L.ink3 }}>
                        {isFlipped ? 'CLIQUE POUR REVENIR' : 'CLIQUE POUR VÉRIFIER'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
