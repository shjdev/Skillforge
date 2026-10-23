'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/useIsMobile';
import { D, EMBER, VERDANT, formatPoints } from '@/lib/theme';
import type { AdminUserOverview } from '@/types/models';
import MobileAdmin from '@/components/mobile/screens/Admin';

interface UserSummaryItem {
  id: string;
  name: string;
  totalXp: number;
  currentStreak: number;
  currentActiveDomainId: string | null;
}

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
  // Le parent remonte ce composant (key) à chaque changement de profil.
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
        {saveMutation.isPending ? 'Enregistrement…' : `ID: ${user.id}`}
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
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<
    AdminUserOverview & { users?: UserSummaryItem[]; hasPersonalPassword?: boolean }
  >({
    queryKey: ['admin-user-overview', selectedUserId],
    queryFn: async () => {
      const url = selectedUserId
        ? `/api/admin/users?userId=${encodeURIComponent(selectedUserId)}`
        : '/api/admin/users';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
  });

  const resetPassword = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reset-password' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Échec de la réinitialisation');
      return payload;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-user-overview'] }),
  });

  if (isLoading) {
    return <div style={{ padding: '30px 34px', color: D.text3, fontSize: 12 }}>Chargement…</div>;
  }
  if (error || !data?.user) {
    return <div style={{ padding: '30px 34px', color: 'oklch(0.62 0.13 30)', fontSize: 12 }}>Une erreur est survenue.</div>;
  }

  const { user, completedSessionsCount, users = [], hasPersonalPassword = false } = data;

  return (
    <div style={{ padding: '30px 34px 70px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 13, letterSpacing: '0.20em', fontWeight: 600 }}>PROFILS & TESTEURS</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {users.map((u) => {
            const active = u.id === user.id;
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  padding: '6px 11px',
                  border: `1px solid ${active ? EMBER : D.border3}`,
                  background: active ? D.panel2 : 'transparent',
                  color: active ? EMBER : D.text2,
                }}
              >
                {u.name.toUpperCase()} ({formatPoints(u.totalXp)})
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, background: D.border, border: `1px solid ${D.border}`, marginBottom: 26 }}>
        <ProfileCell key={`${user.id}:${user.name}`} user={user} />
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: -12, marginBottom: 26, fontSize: 10, letterSpacing: '0.12em', color: D.text3 }}>
        <span>
          MOT DE PASSE PERSONNEL :{' '}
          <span style={{ color: hasPersonalPassword ? VERDANT : D.text2 }}>
            {hasPersonalPassword ? 'DÉFINI' : 'NON DÉFINI (code d’invitation à la prochaine connexion)'}
          </span>
        </span>
        {hasPersonalPassword && (
          <button
            onClick={() => {
              if (window.confirm(`Réinitialiser le mot de passe de ${user.name} ? Il devra en choisir un nouveau avec le code d’invitation.`)) {
                resetPassword.mutate(user.id);
              }
            }}
            disabled={resetPassword.isPending}
            style={{
              all: 'unset',
              cursor: resetPassword.isPending ? 'default' : 'pointer',
              padding: '5px 10px',
              border: `1px solid ${D.border3}`,
              color: D.text2,
            }}
          >
            {resetPassword.isPending ? 'RÉINITIALISATION…' : 'RÉINITIALISER'}
          </button>
        )}
        {resetPassword.error && (
          <span style={{ color: 'oklch(0.62 0.13 30)' }}>{(resetPassword.error as Error).message}</span>
        )}
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
