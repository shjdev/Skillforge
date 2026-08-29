'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/stores/useAppStore';
import { useMounted } from '@/hooks/useMounted';
import { useIsMobile } from '@/hooks/useIsMobile';
import { L, EMBER, formatPoints } from '@/lib/theme';
import type { DomainSummary } from '@/types/models';
import MobileAccueil from '@/components/mobile/screens/Accueil';

const DOMAIN_COUNT = 5;

export default function DashboardPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileAccueil />;
  return <DashboardDesktop />;
}

function DashboardDesktop() {
  const userProfile = useAppStore((state) => state.userProfile);
  const mounted = useMounted();
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [activeLock, setActiveLock] = useState<{ domainId: string | null; topicId: string | null }>({
    domainId: null,
    topicId: null,
  });
  const [completedSessionsCount, setCompletedSessionsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/domains').then((r) => r.json()),
      fetch('/api/profile').then((r) => r.json()),
    ])
      .then(([domainsData, profileData]) => {
        if (domainsData.domains) setDomains(domainsData.domains);
        if (domainsData.activeLock) setActiveLock(domainsData.activeLock);
        if (typeof profileData.completedSessionsCount === 'number') {
          setCompletedSessionsCount(profileData.completedSessionsCount);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dashboard:', err);
        setLoading(false);
      });
  }, []);

  const firstName = mounted ? (userProfile?.name || 'Apprenant').split(' ')[0] : '';
  const streak = mounted ? userProfile?.currentStreak || 0 : 0;
  const streakBars = Array.from({ length: 21 }, (_, i) => {
    const on = i >= 21 - Math.min(streak, 21);
    return { h: 6 + (on ? (i % 4) * 3 + 6 : 0), on };
  });

  const activeTopic = activeLock.topicId
    ? domains.flatMap((d) => d.topics).find((t) => t.id === activeLock.topicId)
    : undefined;
  const activeDomain = activeLock.domainId ? domains.find((d) => d.id === activeLock.domainId) : undefined;
  const activeProgress = activeTopic?.userProgresses?.[0];

  const modeTitle = userProfile?.sessionMode === 'ONE_SESSION' ? 'Session unique' : 'Matin et soir';
  const modeDetail =
    userProfile?.sessionMode === 'ONE_SESSION'
      ? `${userProfile?.singleSessionTime} · 30 min, sans rattrapage`
      : `${userProfile?.morningTime} et ${userProfile?.eveningTime} · rattrapage du soir possible`;

  const dateLabel = mounted
    ? new Date()
        .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        .toUpperCase()
    : '';

  return (
    <div style={{ padding: '44px 52px 90px', maxWidth: 1240 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 38, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: L.ink3, marginBottom: 10 }}>{dateLabel}</div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif-display)', fontWeight: 300, fontSize: 46, lineHeight: 1.05, letterSpacing: '-0.01em' }}>
            Bonjour, {firstName}.
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 6 }}>CAPITAL CUMULÉ</div>
          <div style={{ fontSize: 38, fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {mounted ? formatPoints(userProfile?.totalXp || 0) : '0'}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 1,
          background: L.rule,
          border: `1px solid ${L.rule}`,
          marginBottom: 44,
        }}
      >
        <div style={{ background: L.paper2, padding: '20px 22px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 12 }}>SÉRIE EN COURS</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span style={{ fontSize: 32, fontWeight: 500, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>{streak}</span>
            <span style={{ fontSize: 11, color: L.ink2, paddingBottom: 3 }}>jours consécutifs</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', marginTop: 16 }}>
            {streakBars.map((b, i) => (
              <div key={i} style={{ width: 5, height: b.h, background: b.on ? EMBER : L.ruleFaint2 }} />
            ))}
          </div>
        </div>
        <div style={{ background: L.paper2, padding: '20px 22px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 12 }}>RYTHME CHOISI</div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>{mounted ? modeTitle : ''}</div>
          <div style={{ fontSize: 11, color: L.ink2, marginTop: 8, lineHeight: 1.6 }}>{mounted ? modeDetail : ''}</div>
          <Link href="/schedule" style={{ display: 'inline-block', marginTop: 14, fontSize: 10, letterSpacing: '0.12em', color: EMBER, borderBottom: `1px solid ${EMBER}`, paddingBottom: 2, textDecoration: 'none' }}>
            MODIFIER
          </Link>
        </div>
        <div style={{ background: L.paper2, padding: '20px 22px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 12 }}>SESSIONS VALIDÉES</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span style={{ fontSize: 32, fontWeight: 500, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>{completedSessionsCount}</span>
            <span style={{ fontSize: 11, color: L.ink2, paddingBottom: 3 }}>au total</span>
          </div>
          <div style={{ fontSize: 11, color: L.ink2, marginTop: 16, lineHeight: 1.6 }}>Sessions du matin et du soir confondues.</div>
        </div>
      </div>

      <div style={{ border: `1px solid ${L.ink}`, padding: '26px 28px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginBottom: 46 }}>
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 13, height: 13, background: EMBER }} />
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink2, writingMode: 'vertical-rl', height: 70 }}>UN SEUL FOYER</div>
        </div>

        {activeDomain && activeTopic ? (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: EMBER, marginBottom: 10 }}>FOYER ALLUMÉ</div>
              <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 30, fontWeight: 400, lineHeight: 1.15, marginBottom: 6 }}>
                {activeDomain.name} — {activeTopic.name}
              </div>
              <div style={{ fontSize: 11, color: L.ink2, lineHeight: 1.7, maxWidth: 560 }}>
                Les quatre autres domaines restent verrouillés jusqu&rsquo;à la fin de ce thème : toutes les leçons faites, puis quiz de validation réussi.
              </div>
            </div>
            <div style={{ flex: '0 0 auto', width: 230 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.12em', color: L.ink2, marginBottom: 9 }}>
                <span>PROGRESSION</span>
                <span style={{ color: L.ink, fontWeight: 600 }}>{Math.round(activeProgress?.completionPct ?? 0)}%</span>
              </div>
              <div style={{ height: 6, background: L.ruleFaint3, width: '100%' }}>
                <div style={{ height: 6, width: `${Math.round(activeProgress?.completionPct ?? 0)}%`, background: L.ink }} />
              </div>
              <Link
                href={`/learn?domain=${activeDomain.slug}`}
                style={{
                  marginTop: 20,
                  display: 'block',
                  width: '100%',
                  textAlign: 'center',
                  background: L.ink,
                  color: L.paper,
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  padding: '13px 0',
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                }}
              >
                REPRENDRE LA SESSION
              </Link>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', color: L.ink3, marginBottom: 10 }}>AUCUN FOYER ALLUMÉ</div>
            <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 30, fontWeight: 400, lineHeight: 1.15, marginBottom: 6 }}>
              Choisissez le domaine à travailler
            </div>
            <div style={{ fontSize: 11, color: L.ink2, lineHeight: 1.7, maxWidth: 560 }}>
              Les cinq domaines sont ouverts. Dès que l&rsquo;un démarre, les autres se verrouillent jusqu&rsquo;à sa validation.
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 11, letterSpacing: '0.20em', fontWeight: 600 }}>LES CINQ DOMAINES</h2>
        <div style={{ flex: 1, height: 1, background: L.rule }} />
        <span style={{ fontSize: 10, color: L.ink3, letterSpacing: '0.1em' }}>
          {activeDomain ? '1 en cours · 4 verrouillés' : '5 ouverts'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', color: L.ink3, fontSize: 12 }}>Chargement...</div>
      ) : (
        domains.slice(0, DOMAIN_COUNT).map((domain, i) => {
          const isActive = activeLock.domainId === domain.id;
          const isLockedOut = !!activeLock.domainId && !isActive;
          const level = domain.placementResults?.[0]?.assignedLevel ?? 0;
          const state = isActive ? 'EN COURS' : isLockedOut ? 'VERROUILLÉ' : 'DISPONIBLE';
          const chipStyles: Record<string, React.CSSProperties> = {
            'EN COURS': { color: L.paper2, background: EMBER, border: `1px solid ${EMBER}` },
            DISPONIBLE: { color: L.ink, background: 'transparent', border: `1px solid ${L.ink}` },
            VERROUILLÉ: { color: L.ink3, background: 'transparent', border: `1px dashed ${L.rule3}` },
          };

          return (
            <div
              key={domain.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '30px minmax(200px,1fr) 126px 196px',
                gap: 16,
                alignItems: 'center',
                padding: '20px 14px 20px 0',
                borderBottom: `1px solid ${L.rule}`,
                background: isActive ? L.paperActive : 'transparent',
                opacity: isLockedOut ? 0.62 : 1,
              }}
            >
              <div style={{ fontSize: 11, color: L.ink3, fontVariantNumeric: 'tabular-nums', paddingTop: 4 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 23, fontWeight: 400, lineHeight: 1.1, color: L.ink }}>
                  {domain.name}
                </div>
                <div style={{ fontSize: 11, color: L.ink2, lineHeight: 1.6, marginTop: 5, maxWidth: 430 }}>{domain.description}</div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', color: L.ink3, marginTop: 7 }}>
                  {domain.topics.length} sujet{domain.topics.length > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 7, whiteSpace: 'nowrap' }}>
                  {level ? `NIVEAU ${level} / 5` : 'NON ÉVALUÉ'}
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <div
                      key={k}
                      style={{ width: 17, height: 5, background: k < level ? (isActive ? EMBER : L.ink) : L.ruleFaint3 }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', padding: '5px 9px', whiteSpace: 'nowrap', ...chipStyles[state] }}>
                  {state}
                </div>
                <Link
                  href={`/learn?domain=${domain.slug}`}
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    padding: '9px 14px',
                    textDecoration: 'none',
                    border: `1px solid ${isActive ? L.ink : L.ruleFaint}`,
                    background: isActive ? L.ink : 'transparent',
                    color: isActive ? L.paper2 : L.ink2,
                  }}
                >
                  {isActive ? 'CONTINUER →' : isLockedOut ? 'POURQUOI ?' : 'ALLUMER →'}
                </Link>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
