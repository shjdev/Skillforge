'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notice, Skeleton } from '@/components/ui/feedback';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { QuizResult } from '@/lib/learn';

interface Quiz {
  id: string;
  title: string;
  passingScore: number;
  questions: { id: string; questionText: string; options: string[]; dayNumber: number }[];
}

/** Quiz de validation : toutes les questions, puis la correction détaillée. */
export function QuizPanel({ quizId, onSubmitted }: { quizId: string; onSubmitted: (result: QuizResult) => void }) {
  const query = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => fetchJson<{ quiz: Quiz }>(`/api/quiz/${quizId}`).then((r) => r.quiz),
  });
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const submit = useMutation({
    mutationFn: () => fetchJson<QuizResult>(`/api/quiz/${quizId}/submit`, { method: 'POST', json: { answers } }),
    onSuccess: (result) => {
      onSubmitted(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });
  const result = submit.data;

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <Notice tone="danger" title="Quiz indisponible">
        {toErrorMessage(query.error)}
      </Notice>
    );
  }

  const quiz = query.data;
  const answered = quiz.questions.filter((q) => answers[q.id]).length;
  const corrections = new Map(result?.corrections.map((c) => [c.id, c]));

  const retry = () => {
    setAnswers({});
    submit.reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <p className="kicker mb-3">Quiz de validation</p>
      <h1 className="font-serif text-3xl font-light leading-tight sm:text-4xl">{quiz.title}</h1>
      <p className="mt-3 text-ink-2">
        {plural(quiz.questions.length, 'question')} sur l’ensemble du thème. Il faut {quiz.passingScore} % de bonnes réponses pour
        valider le thème.
      </p>

      {result && (
        <Notice
          tone={result.passed ? 'success' : 'warning'}
          title={result.passed ? `Thème validé : ${result.percentage} %` : `${result.percentage} % — il faut ${result.passingScore} %`}
          className="mt-6"
          action={!result.passed && <Button size="sm" onClick={retry}>Réessayer</Button>}
        >
          {result.passed
            ? `Bravo !${result.xpAwarded ? ` +${result.xpAwarded} points.` : ''} Vous pouvez commencer un nouveau thème.`
            : 'Relisez les corrections ci-dessous et les leçons concernées, puis retentez le quiz.'}
        </Notice>
      )}

      <ol className="mt-8 flex flex-col gap-6">
        {quiz.questions.map((q, i) => {
          const correction = corrections.get(q.id);
          return (
            <li key={q.id} className="rounded-lg border border-rule bg-paper-raised p-5">
              <fieldset disabled={Boolean(result)}>
                <legend className="font-medium">
                  <span className="mr-2 font-mono text-sm text-ink-3">{i + 1}.</span>
                  {q.questionText}
                </legend>
                <div className="mt-3 flex flex-col gap-2">
                  {q.options.map((option) => {
                    const chosen = answers[q.id] === option;
                    const isRight = correction && option === correction.correctAnswer;
                    const isWrong = correction && chosen && !correction.correct;
                    return (
                      <label
                        key={option}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
                          !correction && (chosen ? 'border-ember bg-ember-soft' : 'border-rule hover:border-rule-strong'),
                          isRight && 'border-success/40 bg-success-soft',
                          isWrong && 'border-danger/40 bg-danger-soft',
                          correction && !isRight && !isWrong && 'border-rule opacity-70',
                        )}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={option}
                          checked={chosen}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: option }))}
                          className="mt-0.5 accent-[var(--color-ember)]"
                        />
                        <span className="flex-1">{option}</span>
                        {isRight && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Bonne réponse" />}
                        {isWrong && <XCircle className="size-4 shrink-0 text-danger" aria-label="Votre réponse, incorrecte" />}
                      </label>
                    );
                  })}
                </div>
                {correction?.explanation && (
                  <p className="mt-3 text-sm text-ink-2">
                    <span className="font-medium text-ink">Explication : </span>
                    {correction.explanation}
                  </p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!result && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-3" aria-live="polite">
            {answered}/{quiz.questions.length} réponses
          </p>
          {submit.isError && (
            <p className="text-sm text-danger" role="alert">
              {toErrorMessage(submit.error)}
            </p>
          )}
          <Button variant="accent" size="lg" loading={submit.isPending} disabled={answered < quiz.questions.length} onClick={() => submit.mutate()}>
            Valider mes réponses
          </Button>
        </div>
      )}
    </div>
  );
}
