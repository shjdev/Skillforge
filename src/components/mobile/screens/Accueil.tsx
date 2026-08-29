'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { useMounted } from '@/hooks/useMounted';
import { EMBER, L, FONT_SERIF, formatPoints, initialsOf } from '@/lib/theme';
import { Segs, Ticks, WeekMarks, MSkeleton } from '@/components/mobile/kit';
import type { DomainSummary, TopicDetailResponse } from '@/types/models';

export default function MobileAccueil() {
  const router = useRouter();
  const mounted = useMounted();
  const profile = useAppStore((state) => state.userProfile);

  const [domains, setDomains] = useState<DomainSummary[] | null>(null);
  const [activeDetail, setActiveDetail] = useState<TopicDetailResponse | null>(null);
  const [activeDomainName, setActiveDomainName] = useState('');

  useEffect(() => {
    fetch('/api/domains')
      .then((res) => res.json())
      .then((data) => setDomains(data.domains || []));
  }, []);

  // Foyer actif : détail de progression (total / complétées) pour la carte principale.
  useEffect(() => {
    if (!profile?.currentActiveTopicId || !domains) return;
    const domain = domains.find((d) => d.id === profile.currentActiveDomainId);
    const topic =
      domain?.topics?.find((t) => t.id === profile.currentActiveTopicId) ||
      domains.flatMap((d) => d.topics).find((t) => t.id === profile.currentActiveTopicId);
    if (!topic) return;
    fetch(`/api/topics/${topic.slug}`)
      .then((res) => res.json())
      .then((data: TopicDetailResponse) => {
        setActiveDetail(data);
        setActiveDomainName(domain?.name || '');
      })
      .catch(() => setActiveDetail(null));
  }, [profile?.currentActiveDomainId, profile?.currentActiveTopicId, domains]);

  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const firstName = (mounted ? profile?.name || 'Apprenant' : 'Apprenant').split(' ')[0];
  const initials = initialsOf(mounted ? profile?.name || 'A' : 'A');
  const activeSlug =
    domains
      ?.find((d) => d.id === profile?.currentActiveDomainId)
      ?.topics?.find((t) => t.id === profile?.currentActiveTopicId)?.slug || null;

  return (
    <div style={{ padding: '22px 20px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 8 }}>{dateLabel}</div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 34, fontWeight: 300, lineHeight: 1 }}>
            Bonjour,
            <br />
            {firstName}.
          </div>
        </div>
        <Link
          href="/schedule"
          style={{
            width: 44,
            height: 44,
            border: `1px solid ${L.ink}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: L.ink,
            textDecoration: 'none',
            flex: '0 0 auto',
          }}
        >
          {initials}
        </Link>
      </div>

      {!mounted || !domains ? (
        <>
          <MSkeleton h={110} />
          <MSkeleton h={200} />
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: L.rule, border: `1px solid ${L.rule}`, marginBottom: 22 }}>
            <div style={{ background: L.paper2, padding: '16px 16px 18px' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 10 }}>SÉRIE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 30, fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{profile?.currentStreak || 0}</span>
                <span style={{ fontSize: 12, color: L.ink2 }}>jours</span>
              </div>
              <WeekMarks streak={profile?.currentStreak || 0} />
            </div>
            <div style={{ background: L.paper2, padding: '16px 16px 18px' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 10 }}>CAPITAL</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 30, fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatPoints(profile?.totalXp || 0)}</span>
                <span style={{ fontSize: 12, color: L.ink2 }}>pts</span>
              </div>
              <div style={{ fontSize: 11, color: L.ink2, marginTop: 14, lineHeight: 1.5 }}>
                {activeDetail ? `${activeDetail.progress.completedLessons} leçon${activeDetail.progress.completedLessons > 1 ? 's' : ''} en cours` : '—'}
              </div>
            </div>
          </div>

          {/* Foyer allumé */}
          {activeDetail && activeDetail.progress.status !== 'COMPLETED' && (
            <div style={{ border: `1px solid ${L.ink}`, padding: '20px 18px', marginBottom: 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, background: EMBER }} />
                <span style={{ fontSize: 10, letterSpacing: '0.16em', color: EMBER }}>FOYER ALLUMÉ · UN SEUL</span>
              </div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 26, lineHeight: 1.15, marginBottom: 8 }}>{activeDetail.topic.name}</div>
              <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.65, marginBottom: 18 }}>
                Les autres domaines restent verrouillés jusqu&apos;au quiz de validation.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.12em', color: L.ink2, marginBottom: 8 }}>
                <span>PROGRESSION</span>
                <span style={{ color: L.ink, fontWeight: 600 }}>
                  {activeDetail.progress.completedLessons} / {activeDetail.progress.totalLessons}
                </span>
              </div>
              <div style={{ marginBottom: 20 }}>
                <Ticks total={activeDetail.progress.totalLessons} done={activeDetail.progress.completedLessons} />
              </div>
              <button
                onClick={() => router.push(`/learn?domain=${activeDetail.topic.domain.slug}&topic=${activeDetail.topic.slug}`)}
                style={{
                  all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%',
                  textAlign: 'center', background: L.ink, color: L.paper, fontSize: 12, letterSpacing: '0.16em', padding: '18px 0',
                }}
              >
                REPRENDRE · 30 MIN
              </button>
            </div>
          )}

          {/* Les cinq domaines */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 600 }}>LES DOMAINES</span>
            <div style={{ flex: 1, height: 1, background: L.rule }} />
          </div>
          {domains.map((d, i) => {
            const locked = d.id !== profile?.currentActiveDomainId;
            const level = d.placementResults?.[0]?.assignedLevel || 0;
            return (
              <button
                key={d.id}
                onClick={() =>
                  locked
                    ? router.push(`/learn?domain=${d.slug}`)
                    : activeSlug
                      ? router.push(`/learn?domain=${d.slug}&topic=${activeSlug}`)
                      : router.push(`/learn?domain=${d.slug}`)
                }
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  display: 'block',
                  width: '100%',
                  padding: '19px 17px',
                  marginBottom: 10,
                  border: `1px solid ${locked ? L.rule : L.ink}`,
                  background: locked ? 'transparent' : L.paper2,
                  opacity: locked ? 0.74 : 1,
                  boxShadow: locked ? 'none' : '0 12px 26px -20px oklch(0.235 0.014 60)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
                  <span style={{ fontSize: 10, color: L.ink3, fontVariantNumeric: 'tabular-nums' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Chip label={locked ? 'VERROUILLÉ' : 'EN COURS'} />
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3 }}>
                    {level ? `NIVEAU ${level} / 5` : 'NON ÉVALUÉ'}
                  </span>
                </div>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 25, lineHeight: 1.1, marginBottom: 8, textAlign: 'left' }}>{d.name}</div>
                <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.65, marginBottom: 16, textAlign: 'left' }}>{d.description}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Segs level={level} wide locked={locked} />
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, letterSpacing: '0.14em', color: locked ? L.ink2 : EMBER, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {locked ? 'POURQUOI ?' : 'CONTINUER →'}
                  </span>
                </div>
              </button>
            );
          })}
          {activeDomainName && (
            <div style={{ marginTop: 4, fontSize: 10, color: L.ink3, textAlign: 'center' }}>Foyer actif : {activeDomainName}</div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  const on = label === 'EN COURS';
  return (
    <span
      style={{
        fontSize: 9,
        letterSpacing: '0.14em',
        padding: '5px 9px',
        whiteSpace: 'nowrap',
        color: on ? L.paper2 : L.ink3,
        background: on ? EMBER : 'transparent',
        border: on ? `1px solid ${EMBER}` : `1px dashed ${L.rule3}`,
      }}
    >
      {label}
    </span>
  );
}
