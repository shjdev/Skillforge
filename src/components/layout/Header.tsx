'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/stores/useAppStore';
import { useMounted } from '@/hooks/useMounted';
import { requestNotificationPermission, useNotificationPermission } from '@/hooks/useNotificationScheduler';
import { L, EMBER, VERDANT, initialsOf } from '@/lib/theme';

interface SearchResult {
  lessonId: string;
  title: string;
  dayNumber: number;
  snippet: string;
  matchedConcept: string | null;
  topicName: string;
  topicSlug: string;
  domainName: string;
  domainSlug: string;
}

export const Header = () => {
  const userProfile = useAppStore((state) => state.userProfile);
  const mounted = useMounted();
  const detectedPermission = useNotificationPermission();
  const [permissionOverride, setPermissionOverride] = useState<NotificationPermission | 'unsupported' | null>(null);
  const permission = permissionOverride ?? detectedPermission;
  const notifsActive = permission === 'granted';

  const handleBellClick = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      window.electronAPI.sendNotification({
        title: 'SkillForge — Notification',
        body: 'Rappel de session configuré avec succès !',
      });
      return;
    }

    const result = await requestNotificationPermission();
    setPermissionOverride(result === 'unsupported' ? 'unsupported' : result);

    if (result === 'granted') {
      new Notification('SkillForge — Notification', {
        body: 'Rappels activés ! Vous serez notifié à vos horaires configurés.',
      });
    } else if (result === 'denied') {
      alert('Notifications bloquées par le navigateur. Autorisez-les dans les paramètres du site pour recevoir vos rappels.');
    } else {
      alert('Les notifications ne sont pas prises en charge par ce navigateur.');
    }
  };

  const streak = mounted ? userProfile?.currentStreak || 0 : 0;
  const weekMarks = Array.from({ length: 7 }, (_, i) => i >= 7 - Math.min(streak, 7));
  const modeLabel =
    mounted && userProfile
      ? userProfile.sessionMode === 'ONE_SESSION'
        ? `1 SESSION · ${userProfile.singleSessionTime}`
        : `2 SESSIONS · ${userProfile.morningTime} / ${userProfile.eveningTime}`
      : '';

  const divider = <div style={{ width: 1, height: 22, background: L.rule, flex: '0 0 auto' }} />;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const q = value.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
    } else {
      setSearchLoading(true);
    }
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchResults(null);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        height: 64,
        padding: '0 22px',
        borderBottom: `1px solid ${L.rule}`,
        flex: '0 0 auto',
        overflow: 'hidden',
        background: L.paper,
        color: L.ink,
      }}
    >
      <div
        ref={searchBoxRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          flex: '1 1 90px',
          minWidth: 0,
          maxWidth: 320,
          borderBottom: `1px solid ${L.rule}`,
          paddingBottom: 5,
          position: 'relative',
        }}
      >
        {searchLoading ? (
          <span style={{ fontSize: 11, color: EMBER, animation: 'sf-pulse 1s ease-in-out infinite' }}>⌕</span>
        ) : (
          <span style={{ fontSize: 11, color: L.ink3 }}>⌕</span>
        )}
        <input
          placeholder="Rechercher un concept, une leçon..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            color: L.ink,
          }}
        />
        {searchResults !== null && searchQuery.trim().length >= 2 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: -60,
              marginTop: 10,
              background: L.paper,
              border: `1px solid ${L.rule}`,
              maxHeight: 340,
              overflowY: 'auto',
              zIndex: 50,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            }}
          >
            {searchResults.length === 0 ? (
              <div style={{ padding: '14px 16px', fontSize: 11, color: L.ink3 }}>Aucun résultat pour « {searchQuery.trim()} »</div>
            ) : (
              searchResults.map((r) => (
                <Link
                  key={r.lessonId}
                  href={`/learn?domain=${r.domainSlug}&topic=${r.topicSlug}`}
                  onClick={() => {
                    setSearchResults(null);
                    setSearchQuery('');
                  }}
                  style={{ display: 'block', padding: '12px 16px', textDecoration: 'none', color: L.ink, borderBottom: `1px solid ${L.ruleFaint}` }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.title}</div>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', color: L.ink3, margin: '4px 0' }}>
                    {r.domainName.toUpperCase()} / {r.topicName.toUpperCase()} · JOUR {r.dayNumber}
                  </div>
                  {r.matchedConcept && (
                    <div style={{ fontSize: 11, color: EMBER, marginBottom: 4 }}>◆ {r.matchedConcept}</div>
                  )}
                  {r.snippet && (
                    <div style={{ fontSize: 10, color: L.ink2, lineHeight: 1.5 }}>…{r.snippet}…</div>
                  )}
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ flex: '1 1 0', minWidth: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: L.ink3 }}>SÉRIE</span>
        <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{streak}</span>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', marginLeft: 2 }}>
          {weekMarks.map((on, i) => (
            <div
              key={i}
              style={{ width: 3, height: on ? 13 : 6, background: on ? EMBER : L.ruleFaint }}
            />
          ))}
        </div>
      </div>

      {divider}

      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          color: L.ink2,
          whiteSpace: 'nowrap',
          flex: '0 1 auto',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {modeLabel}
      </span>

      {divider}

      <button
        onClick={handleBellClick}
        title={notifsActive ? 'Notifications activées — cliquer pour tester' : 'Activer les notifications de rappel'}
        style={{
          all: 'unset',
          boxSizing: 'border-box',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: '0 1 auto',
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: notifsActive ? VERDANT : L.ink3,
            flex: '0 0 auto',
          }}
        />
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            color: L.ink2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {notifsActive ? 'RAPPELS ACTIFS' : 'RAPPELS INACTIFS'}
        </span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 2, flex: '0 0 auto' }}>
        <div
          style={{
            width: 26,
            height: 26,
            border: `1px solid ${L.ink}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          {mounted && userProfile?.name ? initialsOf(userProfile.name) : 'A'}
        </div>
        <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
          {mounted ? userProfile?.name || 'Apprenant' : 'Apprenant'}
        </span>
      </div>
    </header>
  );
};
