'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ShjSignature } from '@/components/brand/ShjSignature';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Notice } from '@/components/ui/feedback';
import { safeNextPath } from '@/lib/safe-redirect';

function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const isAdminPrompt = params.get('admin') === '1';

  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  // Première connexion d'un testeur : le serveur demande un mot de passe personnel.
  const [needsNewPassword, setNeedsNewPassword] = React.useState(false);
  const [authEnabled, setAuthEnabled] = React.useState(true);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/auth/login')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.authEnabled === 'boolean') setAuthEnabled(d.authEnabled);
      })
      .catch(() => {
        // Sans réponse, on garde le formulaire complet : le serveur tranchera à l'envoi.
      });
  }, []);

  const canSubmit = !loading && (!authEnabled || (!!password && (!needsNewPassword || (!!newPassword && !!confirmPassword))));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (needsNewPassword && newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password, newPassword: needsNewPassword ? newPassword : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.needsPassword) setNeedsNewPassword(true);
        throw new Error(data.error || 'Mot de passe incorrect.');
      }
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
      setLoading(false);
    }
  };

  const intro = isAdminPrompt
    ? 'Cet espace est réservé à l’administrateur. Saisissez le mot de passe administrateur.'
    : needsNewPassword
      ? 'Première connexion : choisissez un mot de passe personnel. C’est lui qui protégera votre espace ; le code d’invitation ne suffira plus.'
      : 'Entrez votre prénom et votre mot de passe. Première visite ? Utilisez le code d’invitation reçu.';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="font-serif text-3xl leading-tight">{isAdminPrompt ? 'Administration' : 'Bon retour'}</h1>
        <p className="mt-2 text-ink-2">{intro}</p>
      </div>

      {!isAdminPrompt && (
        <Field label="Prénom">
          {({ id }) => (
            <Input
              id={id}
              autoFocus
              autoComplete="username"
              placeholder="Ex. Lucas"
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNeedsNewPassword(false);
              }}
            />
          )}
        </Field>
      )}

      {authEnabled && (
        <Field label={isAdminPrompt ? 'Mot de passe administrateur' : needsNewPassword ? 'Code d’invitation' : 'Mot de passe ou code d’invitation'}>
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoFocus={isAdminPrompt}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
      )}

      {authEnabled && needsNewPassword && !isAdminPrompt && (
        <>
          <Field label="Nouveau mot de passe" hint="8 caractères minimum.">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="password"
                autoFocus
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            )}
          </Field>
          <Field label="Confirmer le mot de passe">
            {({ id }) => (
              <Input id={id} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            )}
          </Field>
        </>
      )}

      {error && (
        <Notice tone="danger" title="Connexion refusée">
          {error}
        </Notice>
      )}

      <Button type="submit" variant="accent" size="lg" loading={loading} disabled={!canSubmit} className="w-full">
        {loading ? 'Connexion…' : 'Entrer'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2.5">
          <span className="size-3 bg-ember" aria-hidden />
          <span className="font-mono text-sm font-semibold tracking-[0.2em]">SKILLFORGE</span>
        </div>
        <React.Suspense fallback={null}>
          <LoginForm />
        </React.Suspense>
      </div>
      <ShjSignature className="mt-16" />
    </main>
  );
}
