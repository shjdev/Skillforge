'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { toast } from '@/components/ui/toast';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';

const MIN_LENGTH = 8;

/** Changer son mot de passe personnel (testeurs). */
export function PasswordSettings() {
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const change = useMutation({
    mutationFn: () => fetchJson('/api/profile/password', { method: 'POST', json: { current, next } }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Mot de passe modifié.');
    },
  });

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = current && next.length >= MIN_LENGTH && confirm === next;

  return (
    <Card>
      <CardHeader kicker="Sécurité" title="Mot de passe" />
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) change.mutate();
          }}
        >
          <Field label="Mot de passe actuel">
            {({ id }) => <Input id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          </Field>
          <Field label="Nouveau" error={tooShort ? `${MIN_LENGTH} caractères minimum.` : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} value={next} onChange={(e) => setNext(e.target.value)} />
            )}
          </Field>
          <Field label="Confirmation" error={mismatch ? 'Les deux saisies diffèrent.' : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="password" autoComplete="new-password" aria-describedby={describedBy} aria-invalid={invalid} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            )}
          </Field>
          {change.isError && (
            <p className="text-sm text-danger sm:col-span-3" role="alert">
              {toErrorMessage(change.error)}
            </p>
          )}
          <div className="flex justify-end sm:col-span-3">
            <Button type="submit" variant="secondary" loading={change.isPending} disabled={!ready}>
              Changer le mot de passe
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
