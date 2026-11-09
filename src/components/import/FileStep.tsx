'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileText, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Notice } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';
import { formatDateTime, plural } from '@/lib/format';
import type { ImportJob, Quota } from './types';

const ACCEPT = '.pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown';
const EXTENSIONS = ['.pdf', '.txt', '.md', '.markdown'];

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

/** Vérification locale avant envoi : format et taille. */
export function validateFile(file: File, maxBytes: number): string | null {
  const lower = file.name.toLowerCase();
  if (!EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'Format non pris en charge : choisissez un PDF, TXT ou Markdown.';
  if (file.size === 0) return 'Ce fichier est vide.';
  if (file.size > maxBytes) return `Fichier trop volumineux (${formatBytes(file.size)}) : ${formatBytes(maxBytes)} maximum.`;
  return null;
}

export function FileStep({
  quota,
  personalKey,
  maxBytes,
  activeJobs,
  onSubmit,
}: {
  quota: Quota | null;
  personalKey: boolean;
  maxBytes: number;
  activeJobs: ImportJob[];
  onSubmit: (file: File) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const blocked = quota ? !quota.allowed : false;

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = validateFile(f, maxBytes);
    setError(problem);
    setFile(problem ? null : f);
  };

  return (
    <div className="flex flex-col gap-6">
      {activeJobs.length > 0 && (
        <Notice tone="info" title={plural(activeJobs.length, 'import en cours', 'imports en cours')}>
          <ul className="mt-1 flex flex-col gap-1">
            {activeJobs.map((job) => (
              <li key={job.id}>
                <Link href={`/library/import?job=${job.id}`} className="font-medium text-ember-strong underline-offset-2 hover:underline">
                  {job.analysis?.title || job.fileName}
                </Link>{' '}
                <span className="text-ink-3">
                  — {job.status === 'REVIEW' ? 'à valider' : `${job.progress.done}/${job.progress.total} jours`} · {formatDateTime(job.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <Card>
        <CardBody>
          <div
            role="button"
            tabIndex={0}
            aria-describedby="import-file-help"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:border-ember focus-visible:outline-none',
              dragging ? 'border-ember bg-ember-soft' : 'border-rule-strong hover:border-ink-3',
            )}
          >
            <UploadCloud className="mb-3 size-9 text-ember" aria-hidden />
            <p className="font-medium">Déposez votre livre ici, ou cliquez pour le choisir</p>
            <p id="import-file-help" className="mt-1 text-sm text-ink-3">
              PDF, TXT ou Markdown · {formatBytes(maxBytes)} maximum
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-label="Choisir un fichier"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          {error && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-md border border-rule bg-paper-sunken px-3 py-2">
              <FileText className="size-5 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-sm text-ink-3">{formatBytes(file.size)}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Retirer le fichier" onClick={() => setFile(null)}>
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <QuotaLine quota={quota} personalKey={personalKey} />
            <Button variant="accent" disabled={!file || blocked} onClick={() => file && onSubmit(file)}>
              Analyser le fichier
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 text-sm text-ink-2 sm:grid-cols-3">
        <Explainer n="1" title="Analyse">
          L’IA lit le document, trouve son titre, sa catégorie et le découpe en thèmes.
        </Explainer>
        <Explainer n="2" title="Validation">
          Vous relisez le plan proposé et corrigez les noms si besoin.
        </Explainer>
        <Explainer n="3" title="Génération">
          Chaque jour du parcours reçoit une leçon de cours, une mise en pratique et des questions de quiz.
        </Explainer>
      </div>
    </div>
  );
}

function QuotaLine({ quota, personalKey }: { quota: Quota | null; personalKey: boolean }) {
  if (!quota) return <span />;
  if (quota.limit === null) {
    return <p className="text-sm text-ink-3">{personalKey ? 'Votre clé Gemini personnelle est utilisée : imports illimités.' : 'Imports illimités.'}</p>;
  }
  if (!quota.allowed) {
    return (
      <p className="text-sm text-danger" role="alert">
        Limite de {quota.limit} imports par 24 h atteinte.{' '}
        <Link href="/settings" className="underline underline-offset-2">
          Ajoutez votre clé Gemini
        </Link>{' '}
        pour continuer.
      </p>
    );
  }
  return (
    <p className="text-sm text-ink-3">
      {plural(quota.remaining ?? 0, 'import restant', 'imports restants')} sur les dernières 24 h.
    </p>
  );
}

function Explainer({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="kicker mb-1">
        {n}. {title}
      </p>
      <p>{children}</p>
    </div>
  );
}
