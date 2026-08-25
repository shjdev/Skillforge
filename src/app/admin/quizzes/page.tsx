'use client';

import React, { useState, useEffect } from 'react';
import { D, EMBER, VERDANT } from '@/lib/theme';
import type { DomainSummary } from '@/types/models';

const labelStyle: React.CSSProperties = { fontSize: 9, letterSpacing: '0.14em', color: D.text3, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  all: 'unset',
  boxSizing: 'border-box',
  width: '100%',
  fontSize: 12,
  color: 'oklch(0.94 0.006 85)',
  borderBottom: `1px solid ${D.border3}`,
  paddingBottom: 6,
};

interface QuizQuestionRow {
  id: string;
  questionText: string;
  options: string;
  correctAnswer: string;
  explanation: string;
  points: number;
}

interface QuizRow {
  id: string;
  title: string;
  passingScore: number;
  quizType: string;
  topic: { id: string; name: string; domain: { name: string } };
  questions: QuizQuestionRow[];
}

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newTopicId, setNewTopicId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newPassingScore, setNewPassingScore] = useState(80);

  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState(0);
  const [qExplanation, setQExplanation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const refreshQuizzes = () => {
    fetch('/api/admin/quizzes')
      .then((res) => res.json())
      .then((data) => {
        if (data.quizzes) setQuizzes(data.quizzes);
      })
      .finally(() => setInitialLoading(false));
  };

  useEffect(() => {
    refreshQuizzes();
    fetch('/api/domains')
      .then((res) => res.json())
      .then((data) => {
        if (data.domains) {
          setDomains(data.domains);
          const first = data.domains.flatMap((d: DomainSummary) => d.topics || [])[0];
          if (first) setNewTopicId(first.id);
        }
      });
  }, []);

  const flash = (text: string, kind: 'success' | 'error') => {
    setNotice({ text, kind });
    setTimeout(() => setNotice(null), 4000);
  };

  const allTopics = domains.flatMap((d) => (d.topics || []).map((t) => ({ ...t, domainName: d.name })));

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicId || newTitle.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: newTopicId, title: newTitle.trim(), passingScore: newPassingScore, quizType: 'WEEKLY' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setNewTitle('');
      flash('Quiz créé.', 'success');
      refreshQuizzes();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm('Supprimer ce quiz et toutes ses questions ?')) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/quizzes/${id}`, { method: 'DELETE' });
      flash('Quiz supprimé.', 'success');
      refreshQuizzes();
    } finally {
      setBusy(false);
    }
  };

  const resetQuestionForm = () => {
    setQText('');
    setQOptions(['', '', '', '']);
    setQCorrect(0);
    setQExplanation('');
  };

  const handleAddQuestion = async (quizId: string) => {
    const options = qOptions.map((o) => o.trim()).filter(Boolean);
    if (qText.trim().length < 5 || options.length < 2) {
      flash('Question trop courte ou moins de 2 réponses.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: qText.trim(),
          options,
          correctAnswer: options[qCorrect],
          explanation: qExplanation.trim(),
          points: 20,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Erreur');
      resetQuestionForm();
      flash('Question ajoutée.', 'success');
      refreshQuizzes();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/admin/questions/${questionId}`, { method: 'DELETE' });
      flash('Question supprimée.', 'success');
      refreshQuizzes();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '30px 34px 70px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 13, letterSpacing: '0.20em', fontWeight: 600 }}>QUIZ &amp; QUESTIONS</h1>
        {notice && (
          <span style={{ fontSize: 11, color: notice.kind === 'success' ? VERDANT : 'oklch(0.62 0.13 30)' }}>{notice.text}</span>
        )}
      </div>

      <form onSubmit={handleCreateQuiz} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 90px auto', gap: 18, alignItems: 'end', border: `1px solid ${D.border}`, background: D.panel2, padding: 20, marginBottom: 30 }}>
        <div>
          <div style={labelStyle}>THÈME</div>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={newTopicId} onChange={(e) => setNewTopicId(e.target.value)}>
            {allTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.domainName} / {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={labelStyle}>TITRE DU QUIZ</div>
          <input style={inputStyle} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Quiz hebdo — Fondamentaux" />
        </div>
        <div>
          <div style={labelStyle}>SEUIL %</div>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={100}
            value={newPassingScore}
            onChange={(e) => setNewPassingScore(Number(e.target.value))}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            cursor: busy ? 'default' : 'pointer',
            background: EMBER,
            color: 'oklch(0.98 0.005 85)',
            fontSize: 11,
            letterSpacing: '0.14em',
            padding: '12px 22px',
            opacity: busy ? 0.6 : 1,
          }}
        >
          CRÉER LE QUIZ
        </button>
      </form>

      {initialLoading ? (
        <div>
          {[0, 1].map((i) => (
            <div key={i} style={{ height: 54, background: D.panel2, border: `1px solid ${D.border2}`, marginBottom: 10, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      ) : quizzes.length === 0 && (
        <div style={{ border: `1px dashed ${D.border3}`, padding: '40px', textAlign: 'center', color: D.text3, fontSize: 12 }}>
          Aucun quiz. Créez-en un ci-dessus ou ingérez un livre (génération automatique).
        </div>
      )}

      {quizzes.map((quiz) => {
        const expanded = expandedId === quiz.id;
        return (
          <div key={quiz.id} style={{ border: `1px solid ${D.border}`, marginBottom: 14, background: D.panel2 }}>
            <div
              onClick={() => setExpandedId(expanded ? null : quiz.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 20px', cursor: 'pointer', borderBottom: expanded ? `1px solid ${D.border}` : 'none' }}
            >
              <div style={{ width: 7, height: 7, background: expanded ? EMBER : D.border3, flex: '0 0 auto' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{quiz.title}</div>
                <div style={{ fontSize: 10, color: D.text3, marginTop: 4 }}>
                  {quiz.topic.domain.name} / {quiz.topic.name} · seuil {quiz.passingScore}% · {quiz.questions.length} question{quiz.questions.length > 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteQuiz(quiz.id);
                }}
                disabled={busy}
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  color: 'oklch(0.62 0.13 30)',
                  border: `1px solid oklch(0.62 0.13 30 / 0.4)`,
                  padding: '6px 10px',
                }}
              >
                SUPPRIMER
              </button>
            </div>

            {expanded && (
              <div style={{ padding: '18px 20px 24px' }}>
                {quiz.questions.map((question, qi) => {
                  let options: string[] = [];
                  try {
                    options = JSON.parse(question.options);
                  } catch {
                    options = [];
                  }
                  return (
                    <div key={question.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '13px 0', borderTop: qi === 0 ? 'none' : `1px solid ${D.border}` }}>
                      <span style={{ fontSize: 10, color: D.text4, fontVariantNumeric: 'tabular-nums', paddingTop: 3 }}>{String(qi + 1).padStart(2, '0')}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>{question.questionText}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {options.map((o, oi) => (
                            <span
                              key={oi}
                              style={{
                                fontSize: 10,
                                padding: '4px 9px',
                                border: `1px solid ${o === question.correctAnswer ? VERDANT : D.border3}`,
                                color: o === question.correctAnswer ? VERDANT : D.text2,
                              }}
                            >
                              {o}
                            </span>
                          ))}
                        </div>
                        {question.explanation && (
                          <div style={{ fontSize: 10, color: D.text3, marginTop: 7, fontStyle: 'italic' }}>→ {question.explanation}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        disabled={busy}
                        style={{
                          all: 'unset',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          fontSize: 9,
                          letterSpacing: '0.1em',
                          color: D.text3,
                          paddingTop: 3,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                <div style={{ borderTop: `1px solid ${D.border}`, marginTop: 8, paddingTop: 18 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.16em', color: D.text3, marginBottom: 14 }}>AJOUTER UNE QUESTION</div>
                  <textarea
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    placeholder="Énoncé de la question…"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 18px', marginBottom: 16 }}>
                    {qOptions.map((opt, oi) => (
                      <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="radio"
                          name={`correct-${quiz.id}`}
                          checked={qCorrect === oi}
                          onChange={() => setQCorrect(oi)}
                          style={{ accentColor: VERDANT, flex: '0 0 auto' }}
                          title="Marquer comme réponse correcte"
                        />
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          value={opt}
                          onChange={(e) => setQOptions((prev) => prev.map((p, i) => (i === oi ? e.target.value : p)))}
                          placeholder={`Réponse ${String.fromCharCode(65 + oi)}${qCorrect === oi ? ' — correcte' : ''}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>EXPLICATION (OPTIONNELLE)</div>
                      <input style={inputStyle} value={qExplanation} onChange={(e) => setQExplanation(e.target.value)} placeholder="Pourquoi cette réponse…" />
                    </div>
                    <button
                      onClick={() => handleAddQuestion(quiz.id)}
                      disabled={busy}
                      style={{
                        all: 'unset',
                        boxSizing: 'border-box',
                        cursor: busy ? 'default' : 'pointer',
                        border: `1px solid ${EMBER}`,
                        color: EMBER,
                        fontSize: 10,
                        letterSpacing: '0.14em',
                        padding: '10px 18px',
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      AJOUTER LA QUESTION
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
