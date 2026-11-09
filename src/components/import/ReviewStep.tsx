'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { plural } from '@/lib/format';
import { topicDays, type ImportJob } from './types';

export interface ReviewValues {
  title: string;
  author: string;
  category: string;
  topicNames: string[];
}

const LEVELS = ['', 'Débutant', 'Facile', 'Intermédiaire', 'Avancé', 'Expert'];

/** Plan proposé par l'IA, modifiable avant de lancer la génération. */
export function ReviewStep({
  job,
  pending,
  onConfirm,
  onCancel,
}: {
  job: ImportJob;
  pending: boolean;
  onConfirm: (values: ReviewValues) => void;
  onCancel: () => void;
}) {
  const analysis = job.analysis!;
  const [values, setValues] = React.useState<ReviewValues>({
    title: analysis.title,
    author: analysis.author,
    category: analysis.category,
    topicNames: analysis.topics.map((t) => t.name),
  });
  const titleMissing = !values.title.trim();
  const set = (patch: Partial<ReviewValues>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titleMissing) onConfirm(values);
      }}
    >
      <Card>
        <CardHeader kicker="Le livre" title="Vérifiez les informations" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre" error={titleMissing ? 'Le titre est obligatoire.' : undefined} className="sm:col-span-2">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={values.title}
                maxLength={200}
                onChange={(e) => set({ title: e.target.value })}
              />
            )}
          </Field>
          <Field label="Auteur" hint="Laissez vide si inconnu.">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} value={values.author} maxLength={160} onChange={(e) => set({ author: e.target.value })} />
            )}
          </Field>
          <Field label="Catégorie" hint="Sert à classer vos livres dans la bibliothèque.">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} value={values.category} maxLength={60} onChange={(e) => set({ category: e.target.value })} />
            )}
          </Field>
          {analysis.summary && <p className="text-sm text-ink-2 sm:col-span-2">{analysis.summary}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          kicker="Le parcours"
          title={`${plural(analysis.topics.length, 'thème')}, ${plural(analysis.totalDays, 'jour')}`}
        />
        <CardBody>
          <ol className="flex flex-col divide-y divide-rule">
            {analysis.topics.map((topic, i) => (
              <li key={i} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
                <span className="font-mono text-sm text-ink-3 sm:w-6 sm:pt-2.5">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Input
                    aria-label={`Nom du thème ${i + 1}`}
                    value={values.topicNames[i]}
                    maxLength={120}
                    onChange={(e) =>
                      set({ topicNames: values.topicNames.map((n, j) => (j === i ? e.target.value : n)) })
                    }
                  />
                  {topic.description && <p className="mt-1.5 text-sm text-ink-2">{topic.description}</p>}
                </div>
                <div className="flex gap-2 sm:pt-2">
                  <Badge>{plural(topicDays(topic), 'jour')}</Badge>
                  <Badge tone="accent">{LEVELS[topic.maxDifficultyLevel] ?? 'Intermédiaire'}</Badge>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-ink-3">
            Chaque jour comprend une leçon de cours et une mise en pratique. Chaque thème se termine par un quiz.
          </p>
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Abandonner
        </Button>
        <Button type="submit" variant="accent" loading={pending} disabled={titleMissing}>
          Lancer la génération
        </Button>
      </div>
    </form>
  );
}
