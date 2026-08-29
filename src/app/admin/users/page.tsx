'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/useIsMobile';
import { D, EMBER, VERDANT, formatPoints } from '@/lib/theme';
import type { AdminUserOverview } from '@/types/models';
import MobileAdmin from '@/components/mobile/screens/Admin';

const inputStyle: React.CSSProperties = {
  all: 'unset',
  boxSizing: 'border-box',
  width: '100%',
  fontSize: 22,
  fontWeight: 500,
  color: 'oklch(0.96 0.006 85)',
  borderBottom: `1px solid ${D.border3}`,
  paddingBottom: 5,
};

function ProfileCell({ user }: { user: AdminUserOverview['user'] }) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(user.name);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sessionMode: user.sessionMode,
          morningTime: user.morningTime,
          eveningTime: user.eveningTime,
          singleSessionTime: user.singleSessionTime,
        }),
      });
      if (!res.ok) throw new Error('Failed to update name');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-user-overview'] }),
  });

  return (
    <div style={{ background: D.panel, padding: '20px 22px', flex: '1.6 1 220px', minWidth: 0 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text3, marginBottom: 10 }}>NOM AFFICHÉ</div>
      <input
        style={inputStyle}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== user.name && name && saveMutation.mutate()}
      />
      <div style={{ fontSize: 10, color: D.text3, marginTop: 9 }}>
        {saveMutation.isPending ? 'Enregistrement…' : "Modifiable · s'applique aux rappels"}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileAdmin />;
  return <AdminUsersDesktop />;
}

function AdminUsersDesktop() {
  const { data, isLoading, error } = useQuery<AdminUserOverview>({
    queryKey: ['admin-user-overview'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
  });

  if (isLoading) {
    return <div style={{ padding: '30px 34px', color: D.text3, fontSize: 12 }}>Chargement…</div>;
  }
  if (error || !data?.user) {
    return <div style={{ padding: '30px 34px', color: 'oklch(0.62 0.13 30)', fontSize: 12 }}>Une erreur est survenue.</div>;
  }

  const { user, completedSessionsCount } = data;

  return (
    <div style={{ padding: '30px 34px 70px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 13, letterSpacing: '0.20em', fontWeight: 600 }}>UTILISATEUR</h1>
        <span style={{ fontSize: 10, color: D.text3, letterSpacing: '0.1em' }}>PROFIL UNIQUE</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, background: D.border, border: `1px solid ${D.border}`, marginBottom: 26 }}>
        <ProfileCell user={user} />
        <div style={{ background: D.panel, padding: '20px 22px', flex: '1 1 110px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text3, marginBottom: 12 }}>POINTS</div>
          <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{formatPoints(user.totalXp)}</div>
        </div>
        <div style={{ background: D.panel, padding: '20px 22px', flex: '1 1 100px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text3, marginBottom: 12 }}>SÉRIE</div>
          <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{user.currentStreak} j</div>
        </div>
        <div style={{ background: D.panel, padding: '20px 22px', flex: '1 1 100px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text3, marginBottom: 12 }}>SESSIONS</div>
          <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{completedSessionsCount}</div>
        </div>
        <div style={{ background: D.panel, padding: '20px 22px', flex: '1.3 1 150px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text3, marginBottom: 12 }}>VERROU</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 9, height: 9, background: user.currentActiveDomainId ? EMBER : D.text4 }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{user.currentActiveDomainId ? 'ACTIF' : 'LIBRE'}</span>
          </div>
          <div style={{ fontSize: 10, color: D.text3, marginTop: 9 }}>
            {user.currentActiveDomainId ? 'Déverrouillage au quiz' : 'Aucun domaine engagé'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(430px,1fr))', gap: 26, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: D.text3, marginBottom: 12 }}>PROGRESSION PAR THÈME</div>
          <div style={{ border: `1px solid ${D.border}` }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px,1fr) minmax(76px,104px) minmax(88px,100px) 42px',
                gap: 14,
                padding: '9px 16px',
                borderBottom: `1px solid ${D.border}`,
                fontSize: 9,
                letterSpacing: '0.14em',
                color: D.text3,
              }}
            >
              <span>THÈME</span>
              <span>DOMAINE</span>
              <span>STATUT</span>
              <span style={{ textAlign: 'right' }}>%</span>
            </div>
            {user.progresses.length === 0 ? (
              <div style={{ padding: 20, fontSize: 11, color: D.text3 }}>Aucun thème entamé.</div>
            ) : (
              user.progresses.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px,1fr) minmax(76px,104px) minmax(88px,100px) 42px',
                    gap: 14,
                    padding: '11px 16px',
                    borderBottom: `1px solid ${D.border2}`,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 11 }}>{p.topic.name}</span>
                  <span style={{ fontSize: 10, color: D.text2 }}>{p.topic.domain.name}</span>
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      padding: '3px 7px',
                      textAlign: 'center',
                      border: `1px solid ${p.status === 'COMPLETED' ? VERDANT : p.status === 'IN_PROGRESS' ? EMBER : D.border3}`,
                      color: p.status === 'COMPLETED' ? VERDANT : p.status === 'IN_PROGRESS' ? EMBER : D.text3,
                    }}
                  >
                    {p.status}
                  </span>
                  <span style={{ fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(p.completionPct)}%</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: D.text3, marginBottom: 12 }}>HISTORIQUE DES TESTS</div>
          <div style={{ border: `1px solid ${D.border}` }}>
            {user.placementResults.length === 0 && user.quizAttempts.length === 0 ? (
              <div style={{ padding: 20, fontSize: 11, color: D.text3 }}>Aucun test passé.</div>
            ) : (
              <>
                {user.placementResults.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: `1px solid ${D.border2}` }}>
                    <span style={{ fontSize: 9, letterSpacing: '0.08em', width: 62, flex: '0 0 auto', color: D.text3 }}>PLACEMENT</span>
                    <span style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.domain.name}</span>
                    <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', width: 40, flex: '0 0 auto', textAlign: 'right' }}>{r.score}%</span>
                  </div>
                ))}
                {user.quizAttempts.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: `1px solid ${D.border2}` }}>
                    <span style={{ fontSize: 9, letterSpacing: '0.08em', width: 62, flex: '0 0 auto', color: EMBER }}>QUIZ</span>
                    <span style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.quiz.title}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontVariantNumeric: 'tabular-nums',
                        width: 40,
                        flex: '0 0 auto',
                        textAlign: 'right',
                        color: a.passed ? 'oklch(0.92 0.008 85)' : 'oklch(0.62 0.13 30)',
                      }}
                    >
                      {Math.round(a.percentage)}%
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
