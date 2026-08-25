'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { D, EMBER, VERDANT, formatPoints } from '@/lib/theme';
import type { AdminUserOverview, CourseDomain } from '@/types/models';

interface ActivityRow {
  time: string;
  tag: 'SESSION' | 'QUIZ' | 'PLACEMENT' | 'IMPORT';
  text: string;
  val: string;
}

export default function AdminDashboardPage() {
  const { data: courses } = useQuery<CourseDomain[]>({
    queryKey: ['admin-domains'],
    queryFn: async () => {
      const res = await fetch('/api/admin/courses');
      if (!res.ok) throw new Error('Failed to fetch courses');
      return res.json();
    },
  });

  const { data: overview } = useQuery<AdminUserOverview>({
    queryKey: ['admin-user-overview'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
  });

  const { data: activityData } = useQuery<{ activity: ActivityRow[] }>({
    queryKey: ['admin-activity'],
    queryFn: async () => {
      const res = await fetch('/api/admin/activity');
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
  });

  const activeDomains = courses?.filter((d) => d.isActive).length ?? 0;
  const totalTopics = courses?.reduce((sum, d) => sum + d.topics.length, 0) ?? 0;
  const totalLessons = courses?.reduce((sum, d) => sum + d.topics.reduce((s, t) => s + t.lessons.length, 0), 0) ?? 0;

  const kpis = [
    { label: 'DOMAINES ACTIFS', value: String(activeDomains), sub: `sur ${courses?.length ?? 0} au total` },
    { label: 'THÈMES', value: String(totalTopics), sub: `${totalLessons} leçons au total` },
    { label: 'LEÇONS', value: String(totalLessons), sub: 'toutes sources confondues' },
    { label: 'CAPITAL APPRENANT', value: formatPoints(overview?.user.totalXp ?? 0), sub: `série de ${overview?.user.currentStreak ?? 0} jours` },
    { label: 'SESSIONS COMPLÉTÉES', value: String(overview?.completedSessionsCount ?? 0), sub: 'depuis le début' },
  ];

  const activity = activityData?.activity || [];

  const contentState = (courses || []).map((d) => {
    const topicsWithLessons = d.topics.filter((t) => t.lessons.length > 0).length;
    const pct = d.topics.length > 0 ? Math.round((topicsWithLessons / d.topics.length) * 100) : 0;
    const lessonsCount = d.topics.reduce((s, t) => s + t.lessons.length, 0);
    return {
      name: d.name,
      count: `${d.topics.length} thème${d.topics.length > 1 ? 's' : ''} · ${lessonsCount} leçon${lessonsCount > 1 ? 's' : ''}`,
      pct,
    };
  });

  return (
    <div style={{ padding: '30px 34px 70px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 13, letterSpacing: '0.20em', fontWeight: 600 }}>SYNTHÈSE</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: D.border, border: `1px solid ${D.border}`, marginBottom: 30 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: D.panel, padding: '18px 18px 20px' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text3, marginBottom: 14 }}>{k.label}</div>
            <div style={{ fontSize: 30, fontWeight: 500, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            <div style={{ fontSize: 10, color: D.text2, marginTop: 10 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 26, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: D.text3, marginBottom: 12 }}>ACTIVITÉ RÉCENTE</div>
          <div style={{ border: `1px solid ${D.border}` }}>
            {activity.length === 0 ? (
              <div style={{ padding: 20, fontSize: 11, color: D.text3 }}>Aucune activité pour le moment.</div>
            ) : (
              activity.map((a, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderBottom: i < activity.length - 1 ? `1px solid ${D.border2}` : 'none' }}
                >
                  <span style={{ fontSize: 10, color: D.text3, fontVariantNumeric: 'tabular-nums', width: 96, flex: '0 0 auto' }}>{a.time}</span>
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      padding: '3px 7px',
                      width: 84,
                      textAlign: 'center',
                      flex: '0 0 auto',
                      border: `1px solid ${a.tag === 'SESSION' ? D.border3 : EMBER}`,
                      color: a.tag === 'SESSION' ? D.text2 : EMBER,
                    }}
                  >
                    {a.tag}
                  </span>
                  <span style={{ fontSize: 11, color: 'oklch(0.88 0.008 85)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.text}
                  </span>
                  <span style={{ fontSize: 10, color: D.text3, fontVariantNumeric: 'tabular-nums' }}>{a.val}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: D.text3, marginBottom: 12 }}>ÉTAT DU CONTENU</div>
          <div style={{ border: `1px solid ${D.border}`, padding: 18 }}>
            {contentState.length === 0 ? (
              <div style={{ fontSize: 11, color: D.text3 }}>Aucun domaine.</div>
            ) : (
              contentState.map((c, i) => (
                <div key={c.name} style={{ padding: '11px 0', borderBottom: i < contentState.length - 1 ? `1px solid ${D.border2}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                    <span style={{ fontSize: 11 }}>{c.name}</span>
                    <span style={{ fontSize: 10, color: D.text2, fontVariantNumeric: 'tabular-nums' }}>{c.count}</span>
                  </div>
                  <div style={{ height: 3, background: D.border2 }}>
                    <div style={{ width: `${c.pct}%`, height: 3, background: c.pct === 100 ? VERDANT : EMBER }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
