'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import { EMBER, VERDANT, L, FONT_SERIF } from '@/lib/theme';
import { LessonProse } from '@/components/learn/LessonProse';
import { MSkeleton, Ticks } from '@/components/mobile/kit';
import type { DomainSummary, TopicDetailResponse } from '@/types/models';

type View = 'loading' | 'empty' | 'verrou' | 'lesson' | 'quiz' | 'resultat' | 'termine';

interface LockPayload {
  message?: string;
  lockedDomain?: { name: string; slug: string };
  lockedTopic?: { name: string; slug: string };
}

function AtelierContent() {
  const router = useRouter();
  const params = useSearchParams();
  const setUserProfile = useAppStore((state) => state.setUserProfile);
  const sessionMode = useAppStore((state) => state.userProfile?.sessionMode);
  const domainSlugParam = params.get('domain');
  const topicSlugParam = params.get('topic');

  const [view, setView] = useState<View>('loading');
  const [detail, setDetail] = useState<TopicDetailResponse | null>(null);
  const [lock, setLock] = useState<LockPayload | null>(null);
  const [lockDetail, setLockDetail] = useState<TopicDetailResponse | null>(null);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);

  // Quiz local state
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ percentage: number; score: number; maxScore: number; passed: boolean; passingScore?: number } | null>(null);

  const loadDetail = useCallback(async (slug: string) => {
    setView('loading');
    try {
      const res = await fetch(`/api/topics/${slug}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 423) {
          setLock(data as LockPayload);
          setDetail(null);
          setView('verrou');
          return;
        }
        throw new Error(data.error || 'Erreur');
      }
      setDetail(data as TopicDetailResponse);
      setLock(null);
      const d = data as TopicDetailResponse;
      if (d.progress.status === 'COMPLETED' && !d.activeLesson) {
        setView('termine');
      } else if (!d.activeLesson && d.allLessonsCompleted && d.quiz) {
        setView('quiz');
      } else {
        setView(d.activeLesson ? 'lesson' : 'empty');
      }
    } catch {
      setView('empty');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profileRes, domainsRes] = await Promise.all([
        fetch('/api/profile').then((r) => r.json()).catch(() => null),
        fetch('/api/domains').then((r) => r.json()).catch(() => null),
      ]);
      if (cancelled) return;
      const ds: DomainSummary[] = domainsRes?.domains || [];
      setDomains(ds);

      const domain =
        ds.find((d) => d.slug === domainSlugParam) ||
        ds.find((d) => d.id === profileRes?.currentActiveDomainId) ||
        ds[0];
      if (!domain) {
        setView('empty');
        return;
      }
      const topic =
        domain.topics.find((t) => t.slug === topicSlugParam) ||
        domain.topics.find((t) => t.id === profileRes?.currentActiveTopicId) ||
        domain.topics[0];
      if (!topic) {
        setView('empty');
        return;
      }
      await loadDetail(topic.slug);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainSlugParam, topicSlugParam]);

  // Détail du domaine verrouillé (stats RESTE / PUIS / ESTIM.)
  useEffect(() => {
    const lockedSlug = lock?.lockedTopic?.slug || lock?.lockedDomain?.slug;
    if (!lockedSlug) return;
    fetch(`/api/topics/${lockedSlug}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        setLockDetail(data);
      })
      .catch(() => {});
  }, [lock]);

  const refreshProfile = async () => {
    const data = await fetch('/api/profile').then((r) => r.json());
    setUserProfile({
      id: data.id,
      name: data.name,
      sessionMode: data.sessionMode,
      morningTime: data.morningTime,
      eveningTime: data.eveningTime,
      singleSessionTime: data.singleSessionTime,
      currentActiveDomainId: data.currentActiveDomainId,
      currentActiveTopicId: data.currentActiveTopicId,
      totalXp: data.totalXp,
      currentStreak: data.currentStreak,
    });
  };

  const handleValidate = async () => {
    if (!detail?.activeLesson || validating) return;
    setValidating(true);
    try {
      const res = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: detail.activeLesson.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (detail.activeLesson.sessionType === 'MORNING' && typeof window !== 'undefined') {
        localStorage.setItem(`skillforge-reminder-fired-morning-completed-${new Date().toISOString().slice(0, 10)}`, '1');
      }
      setValidated(true);
      await refreshProfile();
      // Recharge silencieux : révèle le quiz si toutes les leçons sont faites.
      const slug = detail.topic.slug;
      const fresh = await fetch(`/api/topics/${slug}`);
      if (fresh.ok) {
        const fd: TopicDetailResponse = await fresh.json();
        setDetail(fd);
      }
    } catch {
      /* silencieux */
    } finally {
      setValidating(false);
    }
  };

  const quiz = detail?.quiz;
  const questions = useMemo(() => quiz?.questions || [], [quiz]);
  const question = questions[qi];

  const submitQuiz = async () => {
    if (!quiz || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quiz/${quiz.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setView('resultat');
      await refreshProfile();
    } catch {
      /* silencieux */
    } finally {
      setSubmitting(false);
    }
  };

  const restartQuiz = () => {
    setAnswers({});
    setQi(0);
    setResult(null);
    setView('quiz');
  };

  // ---------------- Verrou ----------------
  if (view === 'verrou') {
    const remaining = lockDetail ? lockDetail.progress.totalLessons - lockDetail.progress.completedLessons : null;
    const passingScore = lockDetail?.quiz?.passingScore;
    const sessionsPerDay = sessionMode === 'ONE_SESSION' ? 1 : 2;
    const estimatedDays = remaining != null ? Math.max(1, Math.ceil(remaining / sessionsPerDay)) : null;
    const activeName = lock?.lockedTopic?.name || lock?.lockedDomain?.name || 'le domaine actif';
    return (
      <div style={{ minHeight: 'calc(100dvh - 136px)', display: 'flex', flexDirection: 'column', background: 'repeating-linear-gradient(135deg, oklch(0.940 0.008 85) 0 10px, oklch(0.920 0.010 82) 10px 20px)' }}>
        <div style={{ flex: 1, minHeight: 90 }} />
        <div style={{ background: L.paper2, borderTop: `1px solid ${L.ink}`, padding: '24px 20px 26px' }}>
          <div style={{ width: 38, height: 3, background: L.ruleFaint, margin: '0 auto 20px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 11, height: 11, border: `2px solid ${L.ink}` }} />
            <span style={{ fontSize: 10, letterSpacing: '0.18em' }}>DOMAINE VERROUILLÉ</span>
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 28, lineHeight: 1.12, marginBottom: 12 }}>
            {(lock?.lockedDomain?.name || lock?.lockedTopic?.name || 'Ce domaine')} reste fermé pour l&apos;instant
          </div>
          <div style={{ fontSize: 13, color: L.ink2, lineHeight: 1.7, marginBottom: 22 }}>
            SkillForge ne laisse qu&apos;un seul foyer allumé. <span style={{ color: L.ink, fontWeight: 600 }}>{activeName}</span> est en cours.
          </div>
          {remaining != null && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: L.rule, border: `1px solid ${L.rule}`, marginBottom: 22 }}>
              <div style={{ background: L.paper2, padding: '13px 12px' }}>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', color: L.ink3, marginBottom: 6 }}>RESTE</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{remaining} leçon{remaining > 1 ? 's' : ''}</div>
              </div>
              <div style={{ background: L.paper2, padding: '13px 12px' }}>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', color: L.ink3, marginBottom: 6 }}>PUIS</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{passingScore ? `1 quiz · ${passingScore}%` : 'Fin auto.'}</div>
              </div>
              <div style={{ background: L.paper2, padding: '13px 12px' }}>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', color: L.ink3, marginBottom: 6 }}>ESTIM.</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{estimatedDays != null ? `${estimatedDays} jour${estimatedDays > 1 ? 's' : ''}` : '—'}</div>
              </div>
            </div>
          )}
          <button
            onClick={() => router.push('/learn')}
            style={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%',
              textAlign: 'center', background: L.ink, color: L.paper, fontSize: 12, letterSpacing: '0.14em',
              padding: '18px 0', marginBottom: 10,
            }}
          >
            REVENIR À {activeName.toUpperCase()}
          </button>
          <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', fontSize: 11, letterSpacing: '0.14em', color: L.ink2, padding: '14px 0', textDecoration: 'none' }}>
            FERMER
          </Link>
        </div>
      </div>
    );
  }

  // ---------------- Terminé ----------------
  if (view === 'termine' && detail) {
    const totalLessons = detail.progress.totalLessons;
    const points = totalLessons * 50 + (detail.quizAttempt?.passed ? 100 : 0);
    const nextChoices = domains.filter((d) => d.id !== detail.topic.domain.id);
    const todayLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).toUpperCase();
    return (
      <div style={{ padding: '24px 20px 26px' }}>
        <div style={{ borderTop: `2px solid ${EMBER}`, paddingTop: 22 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', color: EMBER, marginBottom: 14 }}>THÈME TERMINÉ · {todayLabel}</div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 40, fontWeight: 300, lineHeight: 1.02, letterSpacing: '-0.015em', marginBottom: 16 }}>
            {detail.topic.name}, forgé.
          </div>
          <div style={{ fontSize: 13, color: L.ink2, lineHeight: 1.7, marginBottom: 24 }}>
            {totalLessons} leçon{totalLessons > 1 ? 's' : ''}
            {detail.quizAttempt ? `, un quiz réussi à ${Math.round(detail.quizAttempt.percentage)}%` : ''}. Le foyer s&apos;éteint : les domaines sont de nouveau ouverts.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: L.rule, border: `1px solid ${L.rule}`, marginBottom: 26 }}>
            {[
              { label: 'LEÇONS', value: String(totalLessons) },
              { label: 'POINTS', value: String(points) },
              { label: 'QUIZ', value: detail.quizAttempt ? `${Math.round(detail.quizAttempt.percentage)} %` : '—' },
              { label: 'NIVEAU DOMAINES', value: `${domains.length} ouverts` },
            ].map((k) => (
              <div key={k.label} style={{ background: L.paper2, padding: '16px 16px 18px' }}>
                <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 600, marginBottom: 12 }}>ALLUMER LE PROCHAIN FOYER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {nextChoices.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/learn?domain=${c.slug}`)}
                style={{
                  all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 14, border: `1px solid ${L.rule}`, background: L.paper2, padding: '16px 16px', minHeight: 56,
                }}
              >
                <span style={{ fontFamily: FONT_SERIF, fontSize: 19 }}>{c.name}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: L.ink2, whiteSpace: 'nowrap' }}>
                  {c.topics.length} sujet{c.topics.length > 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
          <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', marginTop: 22, fontSize: 11, letterSpacing: '0.14em', color: L.ink3, textDecoration: 'none' }}>
            ← ACCUEIL
          </Link>
        </div>
      </div>
    );
  }

  // ---------------- Résultat quiz ----------------
  if (view === 'resultat' && result) {
    const passed = result.passed;
    return (
      <div style={{ padding: '24px 20px 26px' }}>
        <div style={{ border: `1px solid ${passed ? VERDANT : 'oklch(0.62 0.13 30)'}`, background: L.paper2, padding: '26px 20px 28px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 10 }}>SCORE</div>
          <div style={{ fontSize: 82, fontWeight: 500, lineHeight: 0.78, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', marginBottom: 14 }}>
            {Math.round(result.percentage)}
            <span style={{ fontSize: 26, letterSpacing: 0 }}>%</span>
          </div>
          <div style={{ fontSize: 12, color: L.ink2, marginBottom: 22 }}>
            {result.score} / {result.maxScore} points
          </div>
          <div style={{ height: 1, background: L.rule, marginBottom: 22 }} />
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 10 }}>RÉSULTAT</div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 30, lineHeight: 1.12, marginBottom: 12 }}>
            {passed ? 'Thème validé' : 'Seuil non atteint'}
          </div>
          <div style={{ fontSize: 13, color: L.ink2, lineHeight: 1.7 }}>
            {passed
              ? "Le foyer s'éteint : tous les domaines redeviennent disponibles."
              : `Il faut ${result.passingScore ?? 70}% pour valider. Repassez le quiz quand vous voulez.`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 20 }}>
          {passed && (
            <button
              onClick={() => loadDetail(detail!.topic.slug)}
              style={{
                all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%',
                textAlign: 'center', background: L.ink, color: L.paper, fontSize: 12, letterSpacing: '0.14em', padding: '18px 0',
              }}
            >
              VOIR LE BILAN DU THÈME
            </button>
          )}
          <button
            onClick={restartQuiz}
            style={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%',
              textAlign: 'center', border: `1px solid ${L.ruleFaint}`, fontSize: 12, letterSpacing: '0.14em', padding: '17px 0',
            }}
          >
            REFAIRE LE QUIZ
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Quiz ----------------
  if (view === 'quiz' && quiz && question) {
    const answered = answers[question.id] != null;
    const isLast = qi === questions.length - 1;
    return (
      <>
        <div style={{ padding: '20px 20px 24px' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: EMBER, marginBottom: 10 }}>VALIDATION DE THÈME</div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 28, fontWeight: 400, lineHeight: 1.12, marginBottom: 20 }}>{quiz.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: `1px solid ${L.rule}`, marginBottom: 22 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.14em', color: L.ink2, whiteSpace: 'nowrap' }}>
              QUESTION {qi + 1} / {questions.length}
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {questions.map((_, i) => (
                <div key={i} style={{ width: 16, height: 4, background: i < qi ? L.ink : i === qi ? EMBER : L.ruleFaint2 }} />
              ))}
            </div>
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 23, lineHeight: 1.35, marginBottom: 22 }}>{question.questionText}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {question.options.map((opt, i) => {
              const sel = answers[question.id] === opt;
              return (
                <button
                  key={i}
                  onClick={() => setAnswers((a) => ({ ...a, [question.id]: opt }))}
                  style={{
                    all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', gap: 13, alignItems: 'center',
                    padding: '15px 14px', minHeight: 56, border: `1px solid ${sel ? L.ink : L.rule}`,
                    background: sel ? L.paperActive : 'transparent',
                  }}
                >
                  <span
                    style={{
                      width: 26, height: 26, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, border: `1px solid ${sel ? EMBER : L.ruleFaint}`, background: sel ? EMBER : 'transparent',
                      color: sel ? L.paper2 : L.ink2,
                    }}
                  >
                    {i < 26 ? String.fromCharCode(65 + i) : i + 1}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.45, textAlign: 'left', color: L.ink }}>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          style={{
            position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430,
            borderTop: `1px solid ${L.rule}`, background: L.paper2, padding: '12px 16px 14px',
            display: 'flex', alignItems: 'center', gap: 12, zIndex: 45,
          }}
        >
          <span style={{ fontSize: 11, color: L.ink3, flex: '0 1 auto' }}>{answered ? 'Réponse enregistrée' : 'Sélectionnez une réponse'}</span>
          <div style={{ flex: 1 }} />
          <button
            disabled={!answered || submitting}
            onClick={() => (isLast ? submitQuiz() : setQi((q) => q + 1))}
            style={{
              all: 'unset', boxSizing: 'border-box', cursor: answered && !submitting ? 'pointer' : 'not-allowed',
              fontSize: 11, letterSpacing: '0.14em', padding: '16px 22px', flex: '0 0 auto',
              background: answered ? L.ink : 'transparent', color: answered ? L.paper2 : L.ink3,
              border: `1px solid ${answered ? L.ink : L.ruleFaint2}`,
            }}
          >
            {submitting ? 'ENVOI…' : isLast ? 'TERMINER' : 'SUIVANTE →'}
          </button>
        </div>
      </>
    );
  }

  // ---------------- Leçon ----------------
  const activeLesson = detail?.activeLesson;

  return (
    <>
      <div style={{ padding: '20px 20px 24px' }}>
        {view === 'loading' && (
          <>
            <MSkeleton h={24} />
            <MSkeleton h={40} />
            <MSkeleton h={260} />
          </>
        )}

        {view === 'empty' && (
          <div style={{ border: `1px dashed ${L.ruleFaint}`, padding: '40px 20px', textAlign: 'center', color: L.ink3, fontSize: 12 }}>
            Aucun foyer actif. Allumez un domaine depuis l&apos;accueil.
            <div style={{ marginTop: 16 }}>
              <Link href="/dashboard" style={{ color: EMBER, textDecoration: 'none' }}>← ACCUEIL</Link>
            </div>
          </div>
        )}

        {view === 'lesson' && detail && activeLesson && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
              <div style={{ width: 8, height: 8, background: EMBER }} />
              <span style={{ fontSize: 10, letterSpacing: '0.16em', color: EMBER }}>
                {activeLesson.sessionType === 'EVENING' ? 'SOIR' : 'MATIN'} · {activeLesson.durationMinutes} MIN · JOUR {activeLesson.dayNumber}
              </span>
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: L.ink3, marginBottom: 10 }}>
              {detail.topic.domain.name.toUpperCase()} / {detail.topic.name.toUpperCase()}
            </div>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 32, fontWeight: 400, lineHeight: 1.1, marginBottom: 18 }}>{activeLesson.title}</div>

            {activeLesson.bookReference && (
              <div style={{ borderLeft: `2px solid ${EMBER}`, paddingLeft: 13, fontSize: 11, lineHeight: 1.65, color: L.ink2, marginBottom: 24 }}>
                Source de la leçon
                <br />
                <span style={{ fontFamily: FONT_SERIF, fontSize: 15, fontStyle: 'italic', color: L.ink }}>{activeLesson.bookReference.title}</span>{' '}
                <span style={{ color: L.ink }}>— {activeLesson.bookReference.author}{activeLesson.chapterCitation ? `, ${activeLesson.chapterCitation}` : ''}</span>
              </div>
            )}

            <LessonProse content={activeLesson.contentMd} />

            {(() => {
              let concepts: string[] = [];
              try {
                concepts = JSON.parse(activeLesson.keyConcepts || '[]');
              } catch {}
              if (concepts.length === 0) return null;
              return (
                <div style={{ marginTop: 22, border: `1px solid ${L.rule}`, background: L.paper2, padding: '18px 16px' }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 12 }}>CONCEPTS CLÉS</div>
                  {concepts.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${L.rule2}` }}>
                      <span style={{ fontSize: 10, color: EMBER, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{String(i + 1).padStart(2, '0')}</span>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {detail.progress.totalLessons > 0 && (
              <div style={{ marginTop: 22 }}>
                <Ticks total={detail.progress.totalLessons} done={detail.progress.completedLessons} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Barre de validation fixe */}
      {view === 'lesson' && activeLesson && (
        <div
          style={{
            position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430,
            borderTop: `1px solid ${L.rule}`, background: L.paper2, padding: '12px 16px 14px', zIndex: 45,
          }}
        >
          {!(validated && !detail?.activeLesson) && detail?.activeLesson ? (
            <button
              onClick={handleValidate}
              disabled={validating}
              style={{
                all: 'unset', boxSizing: 'border-box', cursor: validating ? 'default' : 'pointer', display: 'block',
                width: '100%', textAlign: 'center', background: L.ink, color: L.paper, fontSize: 12,
                letterSpacing: '0.14em', padding: '18px 0', opacity: validating ? 0.6 : 1,
              }}
            >
              {validating ? 'ENREGISTREMENT…' : 'VALIDER · +50 PTS'}
            </button>
          ) : (
            <button
              onClick={() => setView('quiz')}
              style={{
                all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%',
                textAlign: 'center', border: `1px solid ${L.ink}`, fontSize: 12, letterSpacing: '0.14em', padding: '17px 0',
              }}
            >
              PASSER AU QUIZ →
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default function MobileAtelier() {
  return (
    <AtelierContent />
  );
}
