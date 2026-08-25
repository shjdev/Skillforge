'use client';

import React, { useState } from 'react';
import { L, EMBER, VERDANT, DANGER } from '@/lib/theme';
import type { QuizQuestionOption } from '@/types/models';

interface TestResult {
  score: number;
  maxScore?: number;
  percentage: number;
  passed?: boolean;
  passingScore?: number;
  assignedLevel?: number;
}

interface TestFlowProps {
  kicker: string;
  title: string;
  intro: string;
  questions: QuizQuestionOption[];
  isPlacement: boolean;
  onSubmit: (answers: Record<string, string>) => void;
  pending: boolean;
  result: TestResult | null;
  onReset: () => void;
  onPrimaryCta: () => void;
  primaryCtaLabel: string;
}

export function TestFlow({
  kicker,
  title,
  intro,
  questions,
  isPlacement,
  onSubmit,
  pending,
  result,
  onReset,
  onPrimaryCta,
  primaryCtaLabel,
}: TestFlowProps) {
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const total = questions.length;
  const question = questions[qi];
  const answered = question ? answers[question.id] != null : false;
  const isLast = qi === total - 1;

  if (result) {
    const passed = isPlacement ? true : !!result.passed;
    return (
      <div
        style={{
          border: `1px solid ${isPlacement ? L.ink : passed ? VERDANT : DANGER}`,
          background: L.paper2,
          padding: '34px 32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 10 }}>SCORE</div>
            <div style={{ fontSize: 66, fontWeight: 500, lineHeight: 0.85, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(result.percentage)}
              <span style={{ fontSize: 24 }}>%</span>
            </div>
            <div style={{ fontSize: 11, color: L.ink2, marginTop: 12 }}>
              {result.score}
              {result.maxScore ? ` / ${result.maxScore} points` : ''}
            </div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: L.rule }} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 10 }}>
              {isPlacement ? 'NIVEAU ASSIGNÉ' : 'RÉSULTAT'}
            </div>
            <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 32, lineHeight: 1.15, marginBottom: 12 }}>
              {isPlacement ? `Niveau ${result.assignedLevel} sur 5` : passed ? 'Thème validé' : 'Seuil non atteint'}
            </div>
            <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.7, maxWidth: '44ch' }}>
              {isPlacement
                ? 'Les leçons du thème démarreront à ce niveau. Le placement est refaisable une fois par thème.'
                : passed
                ? "Le foyer s'éteint : les cinq domaines redeviennent disponibles et vous pouvez en allumer un nouveau."
                : `Il faut ${result.passingScore ?? 70}% pour valider. Les leçons restent accessibles ; repassez le quiz quand vous voulez.`}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
              {(isPlacement || passed) && (
                <button
                  onClick={onPrimaryCta}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    background: L.ink,
                    color: L.paper,
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    padding: '13px 24px',
                  }}
                >
                  {primaryCtaLabel}
                </button>
              )}
              {!isPlacement && !passed && (
                <button
                  onClick={() => {
                    setQi(0);
                    setAnswers({});
                    onReset();
                  }}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    border: `1px solid ${L.rule3}`,
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    padding: '13px 20px',
                  }}
                >
                  REFAIRE
                </button>
              )}
              {isPlacement && (
                <button
                  onClick={() => {
                    setQi(0);
                    setAnswers({});
                    onReset();
                  }}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    border: `1px solid ${L.rule3}`,
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    padding: '13px 20px',
                  }}
                >
                  REFAIRE
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: EMBER, marginBottom: 12 }}>{kicker}</div>
      <h1 style={{ margin: '0 0 8px', fontFamily: 'var(--font-serif-display)', fontWeight: 400, fontSize: 38, lineHeight: 1.1 }}>{title}</h1>
      <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.7, marginBottom: 34, maxWidth: '58ch' }}>{intro}</div>

      <div style={{ border: `1px solid ${L.ink}`, background: L.paper2 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderBottom: `1px solid ${L.rule}`,
          }}
        >
          <span style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink2, whiteSpace: 'nowrap' }}>
            QUESTION {qi + 1} SUR {total}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: total }, (_, i) => (
              <div key={i} style={{ width: 18, height: 4, background: i < qi ? L.ink : i === qi ? EMBER : L.ruleFaint2 }} />
            ))}
          </div>
        </div>

        <div style={{ padding: '32px 24px 28px' }}>
          <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 25, lineHeight: 1.35, marginBottom: 28, maxWidth: '56ch' }}>
            {question?.questionText}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {question?.options.map((opt, i) => {
              const sel = answers[question.id] === opt;
              return (
                <button
                  key={i}
                  onClick={() => setAnswers((a) => ({ ...a, [question.id]: opt }))}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    padding: '14px 16px',
                    border: `1px solid ${sel ? L.ink : L.rule}`,
                    background: sel ? L.paperActive : 'transparent',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      flex: '0 0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      letterSpacing: '0.04em',
                      border: `1px solid ${sel ? EMBER : L.rule3}`,
                      background: sel ? EMBER : 'transparent',
                      color: sel ? L.paper2 : L.ink2,
                    }}
                  >
                    {i < 26 ? String.fromCharCode(65 + i) : i + 1}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.5 }}>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            borderTop: `1px solid ${L.rule}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {qi > 0 && (
              <button
                disabled={pending}
                onClick={() => setQi((q) => q - 1)}
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  cursor: pending ? 'default' : 'pointer',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  color: L.ink2,
                  borderBottom: `1px solid ${L.rule3}`,
                  paddingBottom: 2,
                }}
              >
                ← QUESTION PRÉCÉDENTE
              </button>
            )}
            <span style={{ fontSize: 11, color: L.ink3 }}>{answered ? 'Réponse enregistrée' : 'Sélectionnez une réponse'}</span>
          </div>
          <button
            disabled={!answered || pending}
            onClick={() => {
              if (isLast) {
                onSubmit(answers);
              } else {
                setQi((q) => q + 1);
              }
            }}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: answered && !pending ? 'pointer' : 'not-allowed',
              fontSize: 11,
              letterSpacing: '0.14em',
              padding: '11px 20px',
              background: answered ? L.ink : 'transparent',
              color: answered ? L.paper2 : L.ink3,
              border: `1px solid ${answered ? L.ink : L.rule3}`,
            }}
          >
            {pending ? 'ENVOI...' : isLast ? 'TERMINER' : 'QUESTION SUIVANTE →'}
          </button>
        </div>
      </div>
    </div>
  );
}
