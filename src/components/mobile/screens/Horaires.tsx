'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { toErrorMessage } from '@/lib/errors';
import { EMBER, VERDANT, L, FONT_SERIF } from '@/lib/theme';
import { MSkeleton } from '@/components/mobile/kit';

interface ProfileData {
  id: string;
  name: string;
  sessionMode: 'TWO_SESSIONS' | 'ONE_SESSION';
  morningTime: string;
  eveningTime: string;
  singleSessionTime: string;
}

export default function MobileHoraires() {
  const setUserProfile = useAppStore((state) => state.setUserProfile);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [mode, setMode] = useState<'TWO_SESSIONS' | 'ONE_SESSION'>('TWO_SESSIONS');
  const [name, setName] = useState('');
  const [t1, setT1] = useState('07:30');
  const [t2, setT2] = useState('20:00');
  const [single, setSingle] = useState('19:00');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.error) return;
        setProfile(data);
        setName(data.name);
        setMode(data.sessionMode);
        setT1(data.morningTime);
        setT2(data.eveningTime);
        setSingle(data.singleSessionTime);
      });
  }, []);

  const isDouble = mode === 'TWO_SESSIONS';

  const planCard = (on: boolean): React.CSSProperties => ({
    all: 'unset',
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'block',
    width: '100%',
    padding: '18px 16px',
    border: `1px solid ${on ? L.ink : L.rule}`,
    background: on ? L.paper2 : 'transparent',
  });
  const planDot = (on: boolean): React.CSSProperties => ({
    width: 12,
    height: 12,
    flex: '0 0 auto',
    border: `1px solid ${on ? EMBER : L.ruleFaint}`,
    background: on ? EMBER : 'transparent',
  });

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
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
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error);
      setProfile(updated);
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
      setSavedMsg(`Enregistré · rappels à ${isDouble ? `${t1} et ${t2}` : single}`);
      setTimeout(() => setSavedMsg(''), 4000);
    } catch (err) {
      setErrorMsg(toErrorMessage(err, "Échec de l'enregistrement."));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div style={{ padding: '20px 20px 26px' }}>
        <MSkeleton h={120} />
        <MSkeleton h={160} />
      </div>
    );
  }

  const timeInputStyle: React.CSSProperties = {
    all: 'unset',
    boxSizing: 'border-box',
    fontSize: 28,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    borderBottom: `1px solid ${L.ink}`,
    paddingBottom: 4,
    cursor: 'text',
  };

  return (
    <div style={{ padding: '20px 20px 26px' }}>
      <div style={{ fontFamily: FONT_SERIF, fontSize: 32, fontWeight: 300, lineHeight: 1.05, marginBottom: 8 }}>Horaires</div>
      <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.65, marginBottom: 22 }}>
        Le rythme conditionne les rappels et le découpage des leçons.
      </div>

      {/* Profil */}
      <div style={{ border: `1px solid ${L.rule}`, background: L.paper2, padding: '18px 16px', marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 12 }}>VOTRE NOM</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            all: 'unset', boxSizing: 'border-box', width: '100%', fontFamily: FONT_SERIF, fontSize: 24,
            borderBottom: `1px solid ${L.ink}`, paddingBottom: 4, cursor: 'text',
          }}
        />
      </div>

      {/* Rythme */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <button onClick={() => setMode('TWO_SESSIONS')} style={planCard(isDouble)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={planDot(isDouble)} />
            <span style={{ fontSize: 10, letterSpacing: '0.16em' }}>DEUX SESSIONS PAR JOUR</span>
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 24, marginBottom: 8 }}>Matin et soir</div>
          <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.65 }}>
            2 × 30 min. La session du matin manquée est rattrapable le soir avant minuit.
          </div>
        </button>
        <button onClick={() => setMode('ONE_SESSION')} style={planCard(!isDouble)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={planDot(!isDouble)} />
            <span style={{ fontSize: 10, letterSpacing: '0.16em' }}>SESSION UNIQUE</span>
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 24, marginBottom: 8 }}>Une fois par jour</div>
          <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.65 }}>
            1 × 30 min. Pas de rattrapage : la série se rompt si la journée est vide.
          </div>
        </button>
      </div>

      {/* Heures */}
      <div style={{ border: `1px solid ${L.rule}`, background: L.paper2, padding: '20px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 18 }}>RÉGLAGE DES HEURES</div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: L.ink2, marginBottom: 7 }}>{isDouble ? 'Session du matin' : 'Session quotidienne'}</div>
            <input type="time" value={isDouble ? t1 : single} onChange={(e) => (isDouble ? setT1(e.target.value) : setSingle(e.target.value))} style={timeInputStyle} />
          </div>
          {isDouble && (
            <div>
              <div style={{ fontSize: 11, color: L.ink2, marginBottom: 7 }}>Session du soir</div>
              <input type="time" value={t2} onChange={(e) => setT2(e.target.value)} style={timeInputStyle} />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          all: 'unset', boxSizing: 'border-box', cursor: saving ? 'default' : 'pointer', display: 'block',
          width: '100%', textAlign: 'center', background: L.ink, color: L.paper, fontSize: 12,
          letterSpacing: '0.16em', padding: '18px 0', opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'ENREGISTREMENT…' : 'ENREGISTRER'}
      </button>
      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14 }}>
          <div style={{ width: 8, height: 8, background: 'oklch(0.62 0.13 30)', marginTop: 5, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11, color: L.ink2, lineHeight: 1.6 }}>{errorMsg}</span>
        </div>
      )}
      {savedMsg && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14 }}>
          <div style={{ width: 8, height: 8, background: VERDANT, marginTop: 5, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11, color: L.ink2, lineHeight: 1.6 }}>{savedMsg}</span>
        </div>
      )}
    </div>
  );
}
