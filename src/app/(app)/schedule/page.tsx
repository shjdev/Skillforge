'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { L, EMBER, VERDANT } from '@/lib/theme';
import MobileHoraires from '@/components/mobile/screens/Horaires';

interface ProfileData {
  id: string;
  name: string;
  sessionMode: 'TWO_SESSIONS' | 'ONE_SESSION';
  morningTime: string;
  eveningTime: string;
  singleSessionTime: string;
  notificationSettings?: { accumulationReminder: boolean } | null;
}

function planCardStyle(on: boolean): React.CSSProperties {
  return {
    all: 'unset',
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'block',
    padding: '24px 26px',
    border: `1px solid ${on ? L.ink : L.rule}`,
    background: on ? L.paper2 : 'transparent',
  };
}

function planDotStyle(on: boolean): React.CSSProperties {
  return { width: 11, height: 11, border: `1px solid ${on ? EMBER : L.rule3}`, background: on ? EMBER : 'transparent' };
}

function ScheduleForm({ profile }: { profile: ProfileData }) {
  const setUserProfile = useAppStore((state) => state.setUserProfile);

  const [mode, setMode] = useState<'TWO_SESSIONS' | 'ONE_SESSION'>(profile.sessionMode);
  const [name, setName] = useState(profile.name);
  const [t1, setT1] = useState(profile.morningTime);
  const [t2, setT2] = useState(profile.eveningTime);
  const [single, setSingle] = useState(profile.singleSessionTime);
  const [catchUp, setCatchUp] = useState(profile.notificationSettings?.accumulationReminder ?? true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDouble = mode === 'TWO_SESSIONS';

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sessionMode: mode,
          morningTime: t1,
          eveningTime: t2,
          singleSessionTime: single,
          accumulationReminder: catchUp,
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error);

      setUserProfile({
        id: updated.id,
        name: updated.name,
        sessionMode: updated.sessionMode,
        morningTime: updated.morningTime,
        eveningTime: updated.eveningTime,
        singleSessionTime: updated.singleSessionTime,
        currentActiveDomainId: updated.currentActiveDomainId,
        currentActiveTopicId: updated.currentActiveTopicId,
        totalXp: updated.totalXp,
        currentStreak: updated.currentStreak,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      console.error('Failed to save schedule settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ border: `1px solid ${L.rule}`, background: L.paper2, padding: '26px 28px', marginBottom: 26 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: L.ink3, marginBottom: 22 }}>PROFIL</div>
        <div style={{ display: 'flex', gap: 44, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: L.ink2, marginBottom: 8 }}>Votre nom</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apprenant"
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                fontSize: 26,
                fontWeight: 500,
                borderBottom: `1px solid ${L.ink}`,
                paddingBottom: 4,
                cursor: 'text',
                minWidth: 220,
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: L.ink3, lineHeight: 1.6, paddingBottom: 6, maxWidth: '40ch' }}>
            Ce nom apparaît dans l&apos;en-tête et dans vos rappels de session.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 36 }}>
        <button onClick={() => setMode('TWO_SESSIONS')} style={planCardStyle(isDouble)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={planDotStyle(isDouble)} />
            <span style={{ fontSize: 10, letterSpacing: '0.16em' }}>DEUX SESSIONS PAR JOUR</span>
          </div>
          <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 26, marginBottom: 10 }}>Matin et soir</div>
          <div style={{ fontSize: 11, color: L.ink2, lineHeight: 1.7 }}>
            2 × 30 min. Si la session du matin est manquée, elle est rattrapable le soir avant minuit.
          </div>
        </button>
        <button onClick={() => setMode('ONE_SESSION')} style={planCardStyle(!isDouble)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={planDotStyle(!isDouble)} />
            <span style={{ fontSize: 10, letterSpacing: '0.16em' }}>SESSION UNIQUE</span>
          </div>
          <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 26, marginBottom: 10 }}>Une fois par jour</div>
          <div style={{ fontSize: 11, color: L.ink2, lineHeight: 1.7 }}>
            1 × 30 min, à l&rsquo;heure de votre choix. Pas de rattrapage : la série se rompt si la journée est vide.
          </div>
        </button>
      </div>

      <div style={{ border: `1px solid ${L.rule}`, background: L.paper2, padding: '26px 28px', marginBottom: 26 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: L.ink3, marginBottom: 22 }}>RÉGLAGE DES HEURES</div>
        <div style={{ display: 'flex', gap: 44, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: L.ink2, marginBottom: 8 }}>{isDouble ? 'Session du matin' : 'Session quotidienne'}</div>
            <input
              type="time"
              value={isDouble ? t1 : single}
              onChange={(e) => (isDouble ? setT1(e.target.value) : setSingle(e.target.value))}
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                fontSize: 30,
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                borderBottom: `1px solid ${L.ink}`,
                paddingBottom: 4,
                cursor: 'text',
              }}
            />
          </div>
          {isDouble && (
            <>
              <div>
                <div style={{ fontSize: 11, color: L.ink2, marginBottom: 8 }}>Session du soir</div>
                <input
                  type="time"
                  value={t2}
                  onChange={(e) => setT2(e.target.value)}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    fontSize: 30,
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    borderBottom: `1px solid ${L.ink}`,
                    paddingBottom: 4,
                    cursor: 'text',
                  }}
                />
              </div>
              <div style={{ borderLeft: `1px solid ${L.rule}`, paddingLeft: 36 }}>
                <div style={{ fontSize: 11, color: L.ink2, marginBottom: 12 }}>Rattrapage du soir</div>
                <button
                  onClick={() => setCatchUp((c) => !c)}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    padding: '10px 18px',
                    border: `1px solid ${catchUp ? L.ink : L.rule3}`,
                    background: catchUp ? L.ink : 'transparent',
                    color: catchUp ? L.paper : L.ink2,
                  }}
                >
                  {catchUp ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            cursor: saving ? 'default' : 'pointer',
            background: L.ink,
            color: L.paper,
            fontSize: 11,
            letterSpacing: '0.16em',
            padding: '15px 30px',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER'}
        </button>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, background: VERDANT }} />
            <span style={{ fontSize: 11, color: L.ink2 }}>
              Horaires enregistrés · rappels reprogrammés à {isDouble ? `${t1} et ${t2}` : single}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export default function SchedulePage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileHoraires />;
  return <ScheduleDesktop />;
}

function ScheduleDesktop() {
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setProfile(data);
      })
      .catch((err) => console.error('Failed to load profile:', err));
  }, []);

  return (
    <div style={{ padding: '44px 52px 90px', maxWidth: 900 }}>
      <h1 style={{ margin: '0 0 10px', fontFamily: 'var(--font-serif-display)', fontWeight: 300, fontSize: 42, lineHeight: 1.05 }}>
        Horaires
      </h1>
      <p style={{ margin: '0 0 36px', fontSize: 12, color: L.ink2, lineHeight: 1.7, maxWidth: '58ch' }}>
        Le rythme conditionne les rappels et la façon dont les leçons sont découpées.
      </p>

      {profile ? (
        <ScheduleForm key={profile.id} profile={profile} />
      ) : (
        <div>
          <SkeletonLine w={120} />
          <div style={{ height: 24 }} />
          <SkeletonBlock h={100} />
          <div style={{ height: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <SkeletonBlock h={120} />
            <SkeletonBlock h={120} />
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonLine({ w, h = 11 }: { w?: number | string; h?: number }) {
  return <div style={{ width: w ?? '100%', height: h, background: L.paper2, border: `1px solid ${L.ruleFaint3}`, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />;
}
function SkeletonBlock({ h }: { h: number }) {
  return <div style={{ width: '100%', height: h, background: L.paper2, border: `1px solid ${L.ruleFaint3}`, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />;
}
