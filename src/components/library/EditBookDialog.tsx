'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';

export interface BookFields {
  title: string;
  author: string;
  category: string;
}

/** Modifier le titre, l'auteur et la catégorie d'un livre. */
export function EditBookDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: BookFields;
  onSave: (values: BookFields) => Promise<void>;
}) {
  const [values, setValues] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const titleMissing = !values.title.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (titleMissing) return;
    setPending(true);
    setError(null);
    try {
      await onSave(values);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Modifier le livre">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Titre" error={titleMissing ? 'Le titre est obligatoire.' : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} maxLength={200} value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
          )}
        </Field>
        <Field label="Auteur">
          {({ id }) => <Input id={id} maxLength={160} value={values.author} onChange={(e) => setValues({ ...values, author: e.target.value })} />}
        </Field>
        <Field label="Catégorie">
          {({ id }) => <Input id={id} maxLength={60} value={values.category} onChange={(e) => setValues({ ...values, category: e.target.value })} />}
        </Field>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" loading={pending} disabled={titleMissing}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
