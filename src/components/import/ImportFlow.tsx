'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookCheck, Loader2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, Notice, ProgressBar, Skeleton } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toast';
import { useMe } from '@/hooks/useMe';
import { fetchJson } from '@/lib/api';
import { parseJsonResponse, toErrorMessage } from '@/lib/errors';
import { plural } from '@/lib/format';
import { getUploadMode, importHeaders, readPersonalKey, startImport } from '@/lib/import/upload-client';
import { FileStep, formatBytes } from './FileStep';
import { ImportStepper } from './ImportStepper';
import { ReviewStep, type ReviewValues } from './ReviewStep';
import { GenerationStep } from './GenerationStep';
import type { ImportJob, ImportsOverview } from './types';

const OVERVIEW_KEY = ['imports'] as const;
const jobKey = (id: string | null) => ['import', id] as const;
/** Appels sans progrès d'affilée avant de mettre en pause (clé invalide, quota IA…). */
const MAX_STALLS = 3;
/** Attentes successives quand l'IA est surchargée (secondes), puis pause. */
const BUSY_DELAYS_S = [15, 30, 45, 60];
const MAX_BUSY_RETRIES = 8;

type JobResponse = { job: ImportJob };

export function ImportFlow() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const jobId = useSearchParams().get('job');
  const me = useMe();
  const [personalKey] = React.useState(() => Boolean(readPersonalKey()));

  const overview = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => fetchJson<ImportsOverview>('/api/imports', { headers: importHeaders() }),
    enabled: !jobId,
  });
  const uploadMode = useQuery({ queryKey: ['upload-mode'], queryFn: getUploadMode, staleTime: Infinity });
  const jobQuery = useQuery({
    queryKey: jobKey(jobId),
    queryFn: () => fetchJson<JobResponse>(`/api/imports/${jobId}`),
    enabled: Boolean(jobId),
    refetchOnWindowFocus: false,
  });
  const job = jobId ? jobQuery.data?.job : undefined;
  const setJob = React.useCallback(
    (next: ImportJob) => queryClient.setQueryData(jobKey(next.id), { job: next }),
    [queryClient],
  );

  // ─── 1. Envoi + analyse ───────────────────────────────────────────────────
  const [uploadPct, setUploadPct] = React.useState<number | null>(null);
  const start = useMutation({
    mutationFn: (file: File) =>
      startImport<JobResponse>({
        file,
        userId: me.data!.userId,
        mode: uploadMode.data!.mode,
        onUploadProgress: setUploadPct,
      }),
    onSuccess: ({ job: created }) => {
      setJob(created);
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      router.replace(`/library/import?job=${created.id}`);
    },
    onSettled: () => setUploadPct(null),
  });

  // ─── 2. Validation ────────────────────────────────────────────────────────
  const confirm = useMutation({
    mutationFn: (values: ReviewValues) =>
      fetchJson<JobResponse>(`/api/imports/${jobId}/confirm`, { method: 'POST', json: values }),
    onSuccess: ({ job: next }) => setJob(next),
    onError: (err) => toast.error(toErrorMessage(err)),
  });

  const cancel = async () => {
    if (!jobId) return;
    const { job: next } = await fetchJson<JobResponse>(`/api/imports/${jobId}`, { method: 'DELETE' });
    setJob(next);
    queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    queryClient.invalidateQueries({ queryKey: ['books'] });
  };
  const abandonReview = async () => {
    try {
      await cancel();
      router.replace('/library/import');
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  };

  // ─── 3. Génération, jour par jour, tant que la page est ouverte ──────────
  const [paused, setPaused] = React.useState(false);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [confirmStop, setConfirmStop] = React.useState(false);
  const jobRef = React.useRef(job);
  React.useEffect(() => {
    jobRef.current = job;
  });

  const generating = job?.status === 'GENERATING';
  React.useEffect(() => {
    if (!generating || paused) return;
    let stopped = false;
    (async () => {
      let stalls = 0;
      let busyRetries = 0;
      let current = jobRef.current!;
      while (!stopped && current.status === 'GENERATING') {
        try {
          const res = await fetch(`/api/imports/${current.id}/step`, { method: 'POST', headers: importHeaders() });
          // IA surchargée : rien n'est perdu, on attend puis on réessaie.
          if (res.status === 503 && busyRetries < MAX_BUSY_RETRIES) {
            const { error } = (await res.json().catch(() => ({}))) as { error?: string };
            const delay = BUSY_DELAYS_S[Math.min(busyRetries, BUSY_DELAYS_S.length - 1)];
            busyRetries++;
            setStepError(`${error || 'L’IA est très sollicitée.'} Nouvel essai dans ${delay} s.`);
            await new Promise((resolve) => setTimeout(resolve, delay * 1000));
            continue;
          }
          const { job: next } = await parseJsonResponse<JobResponse>(res, 'La génération a échoué.');
          if (stopped) return;
          busyRetries = 0;
          stalls = next.progress.done > current.progress.done ? 0 : stalls + 1;
          setJob(next);
          setStepError(next.error);
          current = next;
          if (stalls >= MAX_STALLS) {
            setPaused(true);
            return;
          }
        } catch (err) {
          if (!stopped) {
            setStepError(toErrorMessage(err));
            setPaused(true);
          }
          return;
        }
      }
      if (!stopped) queryClient.invalidateQueries({ queryKey: ['books'] });
    })();
    return () => {
      stopped = true;
    };
  }, [generating, paused, setJob, queryClient]);

  // Prévient avant de quitter pendant l'envoi ou la génération.
  const busy = start.isPending || (generating && !paused);
  React.useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  // ─── Rendu ────────────────────────────────────────────────────────────────
  if (jobId && jobQuery.isPending) return <LoadingCard />;
  if (jobId && jobQuery.isError) {
    return (
      <Notice tone="danger" title="Import introuvable" action={<ButtonLink href="/library/import" size="sm">Nouvel import</ButtonLink>}>
        {toErrorMessage(jobQuery.error)}
      </Notice>
    );
  }

  if (!job) {
    if (start.isPending) {
      return (
        <>
          <ImportStepper current={1} />
          <AnalyzingCard uploadPct={uploadPct} />
        </>
      );
    }
    if (overview.isPending || uploadMode.isPending || me.isPending) return <LoadingCard />;
    const loadError = overview.error || uploadMode.error || me.error;
    if (loadError) {
      return (
        <Notice tone="danger" title="Chargement impossible" action={<Button size="sm" onClick={() => overview.refetch()}>Réessayer</Button>}>
          {toErrorMessage(loadError)}
        </Notice>
      );
    }
    return (
      <>
        <ImportStepper current={0} />
        {start.isError && (
          <Notice tone="danger" title="L’import n’a pas pu démarrer" className="mb-6">
            {toErrorMessage(start.error)}
          </Notice>
        )}
        {!overview.data!.serverKey && !personalKey && (
          <Notice tone="warning" title="Aucune clé IA sur le serveur" className="mb-6">
            Ajoutez votre propre clé Gemini dans les réglages pour importer un livre.
          </Notice>
        )}
        <FileStep
          quota={overview.data!.quota}
          personalKey={personalKey}
          maxBytes={uploadMode.data!.maxBytes}
          activeJobs={overview.data!.jobs}
          onSubmit={(file) => start.mutate(file)}
        />
      </>
    );
  }

  switch (job.status) {
    case 'ANALYZING':
      return (
        <>
          <ImportStepper current={1} />
          <AnalyzingCard uploadPct={null} onRefresh={() => jobQuery.refetch()} />
        </>
      );
    case 'REVIEW':
      return (
        <>
          <ImportStepper current={2} />
          <ReviewStep job={job} pending={confirm.isPending} onConfirm={(v) => confirm.mutate(v)} onCancel={abandonReview} />
        </>
      );
    case 'GENERATING':
      return (
        <>
          <ImportStepper current={3} />
          <GenerationStep
            job={job}
            paused={paused}
            error={stepError}
            onResume={() => {
              setStepError(null);
              setPaused(false);
            }}
            onCancel={() => setConfirmStop(true)}
          />
          <ConfirmDialog
            open={confirmStop}
            onOpenChange={setConfirmStop}
            title="Arrêter l’import ?"
            description="Les jours déjà générés restent dans votre bibliothèque ; les autres ne seront pas créés. Vous ne pourrez pas reprendre cet import."
            confirmLabel="Arrêter"
            onConfirm={async () => {
              setPaused(true);
              await cancel();
              setConfirmStop(false);
            }}
          />
        </>
      );
    case 'DONE':
      return (
        <>
          <ImportStepper current={4} />
          <EmptyState
            icon={<BookCheck />}
            title="Votre parcours est prêt"
            action={job.bookId && <ButtonLink href={`/library/${job.bookId}`} variant="accent">Ouvrir le livre</ButtonLink>}
          >
            « {job.analysis?.title || job.fileName} » : {plural(job.lessonsCreated, 'leçon')} et{' '}
            {plural(job.questionsCreated, 'question')} de quiz.
            {job.skipped > 0 && ` ${plural(job.skipped, 'jour n’a pas pu être généré', 'jours n’ont pas pu être générés')} et a été ignoré.`}
          </EmptyState>
        </>
      );
    case 'CANCELLED':
      return (
        <Notice
          tone="info"
          title="Import arrêté"
          action={
            job.bookId ? (
              <ButtonLink href={`/library/${job.bookId}`} size="sm">Voir le livre</ButtonLink>
            ) : (
              <ButtonLink href="/library/import" size="sm">Nouvel import</ButtonLink>
            )
          }
        >
          {job.bookId ? `${plural(job.lessonsCreated, 'leçon a été conservée', 'leçons ont été conservées')}.` : 'Aucun contenu n’a été créé.'}
        </Notice>
      );
    default:
      return (
        <Notice tone="danger" title="L’import a échoué" action={<ButtonLink href="/library/import" size="sm">Importer un autre fichier</ButtonLink>}>
          {job.error || 'Une erreur est survenue.'} ({job.fileName}, {formatBytes(job.fileSize)})
        </Notice>
      );
  }
}

function LoadingCard() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

function AnalyzingCard({ uploadPct, onRefresh }: { uploadPct: number | null; onRefresh?: () => void }) {
  const uploading = uploadPct !== null && uploadPct < 100;
  return (
    <Card>
      <CardBody className="flex flex-col items-center py-12 text-center" aria-live="polite">
        <Loader2 className="mb-4 size-8 animate-spin text-ember" aria-hidden />
        <p className="font-serif text-2xl">{uploading ? 'Envoi du fichier…' : 'Analyse du document…'}</p>
        <p className="mt-2 max-w-md text-ink-2">
          {uploading
            ? 'Le fichier est envoyé de façon sécurisée.'
            : 'L’IA lit le livre pour trouver son titre, sa catégorie et ses thèmes. Comptez une à deux minutes pour un gros livre.'}
        </p>
        {uploading && <ProgressBar value={uploadPct} label="Envoi du fichier" className="mt-6 max-w-xs" />}
        {onRefresh && (
          <Button variant="ghost" size="sm" className="mt-6" onClick={onRefresh}>
            Actualiser
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
