'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { toast } from '@/components/ui/toast';
import { PROFILE_KEY } from '@/hooks/useProfile';
import { requestNotificationPermission, useNotificationPermission } from '@/hooks/useNotificationScheduler';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { ProfileView } from '@/lib/profile';

/** Nom, rythme d'apprentissage et rappels. */
export function ProfileSettings({ profile }: { profile: ProfileView }) {
  const queryClient = useQueryClient();
  const [values, setValues] = React.useState(profile);
  const permission = useNotificationPermission();
  const set = (patch: Partial<ProfileView>) => setValues((v) => ({ ...v, ...patch }));
  const twoSessions = values.sessionMode === 'TWO_SESSIONS';

  const save = useMutation({
    mutationFn: () =>
      fetchJson<ProfileView>('/api/profile', {
        method: 'PUT',
        json: {
          name: values.name,
          sessionMode: values.sessionMode,
          morningTime: values.morningTime,
          eveningTime: values.eveningTime,
          singleSessionTime: values.singleSessionTime,
          reminders: values.reminders,
        },
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(PROFILE_KEY, next);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Réglages enregistrés.');
    },
    onError: (err) => toast.error(toErrorMessage(err)),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-6"
    >
      <Card>
        <CardHeader kicker="Profil" title="Votre nom" />
        <CardBody>
          <Field label="Nom affiché" error={!values.name.trim() ? 'Le nom est obligatoire.' : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} maxLength={60} value={values.name} onChange={(e) => set({ name: e.target.value })} />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader kicker="Rythme" title="Quand apprenez-vous ?" />
        <CardBody className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Rythme des séances">
            {(
              [
                ['TWO_SESSIONS', 'Deux séances par jour', 'Le cours le matin, la pratique le soir.'],
                ['ONE_SESSION', 'Une séance par jour', 'Le cours et la pratique à la suite.'],
              ] as const
            ).map(([mode, title, text]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={values.sessionMode === mode}
                onClick={() => set({ sessionMode: mode })}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors',
                  values.sessionMode === mode ? 'border-ember bg-ember-soft' : 'border-rule hover:border-rule-strong',
                )}
              >
                <span className="block font-medium">{title}</span>
                <span className="text-sm text-ink-2">{text}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {twoSessions ? (
              <>
                <Field label="Séance du matin">
                  {({ id }) => <Input id={id} type="time" value={values.morningTime} onChange={(e) => set({ morningTime: e.target.value })} />}
                </Field>
                <Field label="Séance du soir">
                  {({ id }) => <Input id={id} type="time" value={values.eveningTime} onChange={(e) => set({ eveningTime: e.target.value })} />}
                </Field>
              </>
            ) : (
              <Field label="Heure de la séance">
                {({ id }) => <Input id={id} type="time" value={values.singleSessionTime} onChange={(e) => set({ singleSessionTime: e.target.value })} />}
              </Field>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-rule p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={values.reminders}
                onChange={(e) => set({ reminders: e.target.checked })}
                className="mt-1 size-4 accent-[var(--color-ember)]"
              />
              <span>
                <span className="block font-medium">Me rappeler l’heure de la séance</span>
                <span className="text-sm text-ink-2">Une notification de ce navigateur, quand SkillForge est ouvert.</span>
              </span>
            </label>
            {values.reminders && permission === 'default' && (
              <Button variant="secondary" size="sm" onClick={() => requestNotificationPermission()}>
                <Bell className="size-4" aria-hidden /> Autoriser les notifications
              </Button>
            )}
            {values.reminders && permission === 'denied' && (
              <p className="text-sm text-warning">Notifications bloquées : autorisez-les dans les réglages du navigateur.</p>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={!values.name.trim()}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
