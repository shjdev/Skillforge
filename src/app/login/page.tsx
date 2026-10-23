'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { L, EMBER } from '@/lib/theme';

function LoginContent() {
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const isAdminPrompt = params.get('admin') === '1';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authEnabled, setAuthEnabled] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/login')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.authEnabled === 'boolean') setAuthEnabled(d.authEnabled);
      })
      .catch(() => {});
  }, []);

  const canSubmit = !loading && (authEnabled ? !!password : !!name.trim() || true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Mot de passe incorrect.');
      }
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: L.paper, color: L.ink, fontFamily: 'var(--font-mono-ui)' }}>
      <form onSubmit={handleSubmit} style={{ width: 340, maxWidth: '100%', padding: '0 20px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 11, height: 11, background: EMBER }} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.20em' }}>SKILLFORGE</span>
        </div>

        <div style={{ fontSize: 11, color: L.ink2, lineHeight: 1.6, marginBottom: 24 }}>
          {isAdminPrompt
            ? 'Accès administrateur requis. Saisissez le mot de passe administrateur.'
            : 'Entrez votre prénom pour accéder à votre espace personnel (ou retrouver votre progression et vos livres importés).'}
        </div>

        {!isAdminPrompt && (
          <>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 8 }}>PRÉNOM / PROFIL</div>
            <input
              type="text"
              autoFocus
              placeholder="Ex. Lucas (vide = profil principal)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                width: '100%',
                fontSize: 16,
                borderBottom: `1px solid ${L.ink}`,
                paddingBottom: 8,
                marginBottom: 22,
                cursor: 'text',
              }}
            />
          </>
        )}

        {authEnabled && (
          <>
            <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 8 }}>
              {isAdminPrompt ? 'MOT DE PASSE ADMIN' : "CODE D'ACCÈS"}
            </div>
            <input
              type="password"
              autoFocus={isAdminPrompt}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                all: 'unset',
                boxSizing: 'border-box',
                width: '100%',
                fontSize: 20,
                borderBottom: `1px solid ${L.ink}`,
                paddingBottom: 8,
                marginBottom: 22,
                cursor: 'text',
              }}
            />
          </>
        )}

        {error && <div style={{ fontSize: 11, color: 'oklch(0.62 0.13 30)', marginBottom: 16 }}>{error}</div>}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            cursor: !canSubmit ? 'default' : 'pointer',
            display: 'block',
            width: '100%',
            textAlign: 'center',
            background: L.ink,
            color: L.paper,
            fontSize: 12,
            letterSpacing: '0.16em',
            padding: '15px 0',
            opacity: !canSubmit ? 0.6 : 1,
          }}
        >
          {loading ? 'CONNEXION…' : 'ENTRER'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
