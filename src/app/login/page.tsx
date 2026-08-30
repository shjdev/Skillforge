'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { L, EMBER } from '@/lib/theme';

function LoginContent() {
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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
      <form onSubmit={handleSubmit} style={{ width: 320, maxWidth: '100%', padding: '0 20px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 34 }}>
          <div style={{ width: 11, height: 11, background: EMBER }} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.20em' }}>SKILLFORGE</span>
        </div>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 10 }}>MOT DE PASSE</div>
        <input
          type="password"
          autoFocus
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
        {error && <div style={{ fontSize: 11, color: 'oklch(0.62 0.13 30)', marginBottom: 16 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            cursor: loading || !password ? 'default' : 'pointer',
            display: 'block',
            width: '100%',
            textAlign: 'center',
            background: L.ink,
            color: L.paper,
            fontSize: 12,
            letterSpacing: '0.16em',
            padding: '15px 0',
            opacity: loading || !password ? 0.6 : 1,
          }}
        >
          {loading ? 'VÉRIFICATION…' : 'ENTRER'}
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
