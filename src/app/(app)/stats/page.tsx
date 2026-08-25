'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { L, EMBER } from '@/lib/theme';

interface DayStat {
  date: string;
  label: string;
  sessions: number;
  minutes: number;
  points: number;
}

interface StatsData {
  days: DayStat[];
  totals: {
    periodSessions: number;
    periodMinutes: number;
    periodPoints: number;
    totalXp: number;
    currentStreak: number;
  };
}

const cardStyle: React.CSSProperties = { background: L.paper2, border: `1px solid ${L.rule}`, padding: '20px 22px' };

function SkeletonLine({ w, h = 11 }: { w?: number | string; h?: number }) {
  return <div style={{ width: w ?? '100%', height: h, background: L.paper2, border: `1px solid ${L.ruleFaint2}`, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />;
}
function SkeletonBlock({ h }: { h: number }) {
  return <div style={{ width: '100%', height: h, background: L.paper2, border: `1px solid ${L.ruleFaint2}`, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />;
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((d) => {
        if (d.days) setData(d);
      });
  }, []);

  if (!data) {
    return (
      <div style={{ padding: '44px 52px 90px', maxWidth: 1020 }}>
        <SkeletonLine w={140} />
        <div style={{ height: 20 }} />
        <SkeletonLine w={260} h={34} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, margin: '36px 0' }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} h={86} />
          ))}
        </div>
        <SkeletonBlock h={300} />
      </div>
    );
  }

  const t = data.totals;
  const avgPerWeek = Math.round((t.periodSessions / 30) * 7 * 10) / 10;

  return (
    <div style={{ padding: '44px 52px 90px', maxWidth: 1020 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.20em', color: EMBER, marginBottom: 16 }}>PROGRESSION</div>
      <h1 style={{ margin: '0 0 36px', fontFamily: 'var(--font-serif-display)', fontWeight: 400, fontSize: 42, lineHeight: 1.1 }}>
        Statistiques
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 40 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>SÉRIE ACTUELLE</div>
          <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{t.currentStreak} j</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>CAPITAL TOTAL</div>
          <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{t.totalXp}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>SESSIONS · 30 JOURS</div>
          <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{t.periodSessions}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>RYTHME / SEMAINE</div>
          <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{avgPerWeek}</div>
        </div>
      </div>

      <div style={{ border: `1px solid ${L.rule}`, background: L.paper2, padding: '24px 22px 14px', marginBottom: 30 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 18 }}>
          SESSIONS VALIDÉES · 30 DERNIERS JOURS
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.days} margin={{ top: 4, right: 4, bottom: 4, left: -22 }}>
            <CartesianGrid stroke={L.rule2} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: L.ink3 }} interval={4} tickLine={false} axisLine={{ stroke: L.rule }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: L.ink3 }} tickLine={false} axisLine={{ stroke: L.rule }} />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={{ fontSize: 11, border: `1px solid ${L.rule}`, borderRadius: 0 }}
              formatter={(value) => [`${Number(value)} session${Number(value) > 1 ? 's' : ''}`, '']}
              labelFormatter={(label) => `Jour ${String(label)}`}
            />
            <Bar dataKey="sessions" fill={EMBER} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>TEMPS ÉTUDIÉ · 30 JOURS</div>
          <div style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{Math.round(t.periodMinutes / 60)} h {t.periodMinutes % 60} min</div>
          <div style={{ fontSize: 10, color: L.ink2, marginTop: 6 }}>estimation à 30 min par session non chronométrée</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>POINTS GAGNÉS · 30 JOURS</div>
          <div style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>+{t.periodPoints}</div>
          <div style={{ fontSize: 10, color: L.ink2, marginTop: 6 }}>soit {Math.round(t.periodPoints / Math.max(t.totalXp, 1) * 100)}% du capital total</div>
        </div>
      </div>
    </div>
  );
}
