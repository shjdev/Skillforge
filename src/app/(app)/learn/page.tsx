'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { L, EMBER, VERDANT } from '@/lib/theme';
import { useAppStore, type UserProfileState } from '@/stores/useAppStore';
import { todayKey } from '@/hooks/useNotificationScheduler';
import { LessonProse } from '@/components/learn/LessonProse';
import { TestFlow } from '@/components/learn/TestFlow';
import type { DomainSummary, PlacementTestInfo, TopicDetailResponse } from '@/types/models';

interface LockErrorPayload {
  error: string;
  message?: string;
  lockedDomain?: { name: string; slug: string };
  lockedTopic?: { name: string; slug: string };
}

class TopicFetchError extends Error {
  status: number;
  payload: LockErrorPayload;
  constructor(message: string, status: number, payload: LockErrorPayload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function refreshProfile(setUserProfile: (p: UserProfileState) => void) {
  const res = await fetch('/api/profile');
  const data = await res.json();
  if (data && !data.error) {
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
  }
}

const backLink: React.CSSProperties = { fontSize: 10, letterSpacing: '0.14em', color: L.ink2, marginBottom: 26, display: 'inline-block', textDecoration: 'none' };

function SkeletonLine({ w, h = 11 }: { w?: number | string; h?: number }) {
  return <div style={{ width: w ?? '100%', height: h, background: L.paper2, border: `1px solid ${L.ruleFaint3}`, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />;
}
function SkeletonBlock({ h }: { h: number }) {
  return <div style={{ width: '100%', height: h, background: L.paper2, border: `1px solid ${L.ruleFaint3}`, animation: 'sf-pulse 1.4s ease-in-out infinite' }} />;
}

function LearnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const domainSlug = searchParams.get('domain') || 'networking';
  const topicParam = searchParams.get('topic');
  const queryClient = useQueryClient();
  const setUserProfile = useAppStore((state) => state.setUserProfile);

  const [tab, setTab] = useState<'lesson' | 'placement' | 'quiz'>('lesson');
  const [sessionNotes, setSessionNotes] = useState('');

  const { data: domainData, isLoading: isLoadingDomain } = useQuery({
    queryKey: ['domain', domainSlug],
    queryFn: async (): Promise<DomainSummary | undefined> => {
      const res = await fetch('/api/domains');
      const data = await res.json();
      return data.domains?.find((d: DomainSummary) => d.slug === domainSlug) || data.domains?.[0];
    },
  });

  const { data: placementTest } = useQuery({
    queryKey: ['placement', domainData?.slug],
    queryFn: async (): Promise<PlacementTestInfo | null> => {
      if (!domainData?.slug) return null;
      const res = await fetch(`/api/placement?domain=${domainData.slug}`);
      const p = await res.json();
      return p.error ? null : p;
    },
    enabled: !!domainData?.slug,
  });

  const topics = domainData?.topics ?? [];
  const topicSlug = (topicParam && topics.find((t) => t.slug === topicParam)?.slug) || topics[0]?.slug;

  const { data: topicData, isLoading: isLoadingTopic, error: topicError } = useQuery({
    queryKey: ['topic', topicSlug],
    queryFn: async (): Promise<TopicDetailResponse> => {
      const res = await fetch(`/api/topics/${topicSlug}`);
      const data = await res.json();
      if (!res.ok) {
        throw new TopicFetchError(data.message || data.error || 'Erreur', res.status, data);
      }
      return data;
    },
    enabled: !!topicSlug,
    retry: false,
  });

  const isLocked = topicError instanceof TopicFetchError && topicError.status === 423;
  const lockPayload = topicError instanceof TopicFetchError ? topicError.payload : undefined;

  const { data: lockDetail } = useQuery({
    queryKey: ['lock-detail', lockPayload?.lockedDomain?.slug, lockPayload?.lockedTopic?.slug],
    queryFn: async () => {
      let slug = lockPayload?.lockedTopic?.slug;
      let domainName = lockPayload?.lockedTopic ? undefined : lockPayload?.lockedDomain?.name;
      const domainSlugForLink = lockPayload?.lockedDomain?.slug;

      if (!slug && lockPayload?.lockedDomain?.slug) {
        const res = await fetch('/api/domains');
        const data = await res.json();
        const d = data.domains?.find((x: DomainSummary) => x.slug === lockPayload.lockedDomain!.slug);
        slug = d?.topics?.[0]?.slug;
        domainName = d?.name;
      }
      if (!slug) return null;

      const res2 = await fetch(`/api/topics/${slug}`);
      if (!res2.ok) return null;
      const detail: TopicDetailResponse = await res2.json();
      return {
        ...detail,
        domainName: domainName ?? detail.topic.domain.name,
        domainSlug: domainSlugForLink ?? detail.topic.domain.slug,
      };
    },
    enabled: isLocked,
  });

  const { data: allDomains } = useQuery({
    queryKey: ['all-domains-for-next-choices'],
    queryFn: async (): Promise<DomainSummary[]> => {
      const res = await fetch('/api/domains');
      const data = await res.json();
      return data.domains || [];
    },
    enabled: topicData?.progress?.status === 'COMPLETED',
  });

  const placementMutation = useMutation({
    mutationFn: async (userAnswers: Record<string, string>) => {
      if (!domainData || !placementTest) throw new Error('Données manquantes');
      const res = await fetch('/api/placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId: domainData.id, testId: placementTest.testId, userAnswers }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain', domainSlug] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ lesson, alsoNext }: { lesson: { id: string; sessionType: string }; alsoNext?: boolean }) => {
      const res = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, alsoNext, notes: sessionNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      return { data, lesson };
    },
    onSuccess: async ({ lesson }) => {
      setSessionNotes('');
      if (lesson.sessionType === 'MORNING' && typeof window !== 'undefined') {
        localStorage.setItem(todayKey('morning-completed'), '1');
      }
      await queryClient.invalidateQueries({ queryKey: ['topic', topicSlug] });
      await refreshProfile(setUserProfile);
    },
  });

  const quizMutation = useMutation({
    mutationFn: async (answers: Record<string, string>) => {
      if (!topicData?.quiz) throw new Error('Quiz introuvable');
      const res = await fetch(`/api/quiz/${topicData.quiz.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['topic', topicSlug] });
      await queryClient.invalidateQueries({ queryKey: ['domain', domainSlug] });
      await refreshProfile(setUserProfile);
    },
  });

  if (isLoadingDomain || (topicSlug && isLoadingTopic)) {
    return (
      <div style={{ display: 'flex', minHeight: '100%' }}>
        <div style={{ flex: 1, minWidth: 0, padding: '40px 52px 90px', maxWidth: 820 }}>
          <SkeletonLine w={120} />
          <div style={{ height: 24 }} />
          <SkeletonLine w={300} h={30} />
          <div style={{ height: 28 }} />
          <SkeletonLine h={13} />
          <div style={{ height: 10 }} />
          <SkeletonLine h={13} />
          <div style={{ height: 10 }} />
          <SkeletonLine w="70%" h={13} />
          <div style={{ height: 26 }} />
          <SkeletonBlock h={120} />
        </div>
        <div style={{ width: 310, flex: '0 0 auto', borderLeft: `1px solid ${L.rule}`, padding: '40px 30px', background: L.paper3 }}>
          <SkeletonBlock h={90} />
        </div>
      </div>
    );
  }

  // ---------- Locked domain ----------
  if (isLocked) {
    const remaining = lockDetail ? lockDetail.progress.totalLessons - lockDetail.progress.completedLessons : null;
    const passingScore = lockDetail?.quiz?.passingScore;
    const activeName = lockPayload?.lockedTopic?.name || lockPayload?.lockedDomain?.name || '';
    const homeSlug = lockDetail?.domainSlug;

    return (
      <div style={{ padding: '44px 52px 90px', maxWidth: 820 }}>
        <Link href="/learn" style={backLink}>← RETOUR À L&rsquo;ATELIER</Link>
        <div
          style={{
            border: `1px solid ${L.rule3}`,
            background: 'repeating-linear-gradient(135deg, oklch(0.951 0.008 85) 0 9px, oklch(0.930 0.010 82) 9px 18px)',
            padding: '44px 40px',
          }}
        >
          <div style={{ background: L.paper2, border: `1px solid ${L.ink}`, padding: '34px 34px 30px', maxWidth: 620 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 20 }}>
              <div style={{ width: 11, height: 11, border: `2px solid ${L.ink}` }} />
              <span style={{ fontSize: 10, letterSpacing: '0.18em' }}>DOMAINE VERROUILLÉ (LOCKED)</span>
            </div>
            <h1 style={{ margin: '0 0 14px', fontFamily: 'var(--font-serif-display)', fontWeight: 400, fontSize: 36, lineHeight: 1.12 }}>
              {`${domainData?.name || 'Ce domaine'} reste fermé pour l’instant`}
            </h1>
            <p style={{ margin: '0 0 26px', fontSize: 13, lineHeight: 1.75, color: L.ink2, maxWidth: '56ch' }}>
              SkillForge ne laisse qu&rsquo;un seul foyer allumé à la fois.{' '}
              {activeName && (
                <>
                  Le domaine <span style={{ color: L.ink, fontWeight: 600 }}>{activeName}</span> est en cours
                  {remaining != null ? ` : il reste ${remaining} leçon${remaining > 1 ? 's' : ''}` : ''}
                  {passingScore ? ` puis le quiz de validation (seuil ${passingScore}%)` : ''}.{' '}
                </>
              )}
              {`${activeName || 'Le domaine actif'} s’ouvrira automatiquement à ce moment-là.`}
            </p>
            {remaining != null && (
              <div style={{ display: 'flex', gap: 1, background: L.rule, border: `1px solid ${L.rule}`, marginBottom: 26 }}>
                <div style={{ background: L.paper2, padding: '14px 18px', flex: 1 }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 6 }}>RESTE À FAIRE</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{remaining} leçon{remaining > 1 ? 's' : ''}</div>
                </div>
                <div style={{ background: L.paper2, padding: '14px 18px', flex: 1 }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 6 }}>PUIS</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{passingScore ? `1 quiz · ${passingScore}%` : 'Fin automatique'}</div>
                </div>
              </div>
            )}
            <Link
              href={homeSlug ? `/learn?domain=${homeSlug}` : '/dashboard'}
              style={{ display: 'inline-block', background: L.ink, color: L.paper, fontSize: 11, letterSpacing: '0.14em', padding: '14px 26px', textDecoration: 'none' }}
            >
              REVENIR AU DOMAINE ACTIF{activeName ? ` — ${activeName.toUpperCase()}` : ''}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeLesson = topicData?.activeLesson;
  const quiz = topicData?.quiz;
  const allLessonsCompleted = topicData?.allLessonsCompleted;
  const topicCompleted = topicData?.progress?.status === 'COMPLETED';
  const showQuizTab = !!(allLessonsCompleted && quiz && !topicCompleted);
  const effectiveTab = tab === 'lesson' && !activeLesson && showQuizTab ? 'quiz' : tab;

  // ---------- Topic completed ----------
  if (topicCompleted && !activeLesson) {
    const totalLessons = topicData?.progress?.totalLessons ?? 0;
    const quizAttempt = topicData?.quizAttempt;
    const pointsGained = totalLessons * 50 + (quizAttempt?.passed ? 100 : 0);
    const domainLevel = domainData?.placementResults?.[0]?.assignedLevel;
    const nextChoices = (allDomains || []).filter((d) => d.id !== domainData?.id);

    return (
      <div style={{ padding: '44px 52px 90px', maxWidth: 900 }}>
        <Link href="/dashboard" style={backLink}>← RETOUR AU TABLEAU DE BORD</Link>
        <div style={{ borderTop: `2px solid ${EMBER}`, paddingTop: 30 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.20em', color: EMBER, marginBottom: 16 }}>THÈME TERMINÉ</div>
          <h1 style={{ margin: '0 0 18px', fontFamily: 'var(--font-serif-display)', fontWeight: 300, fontSize: 48, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            {topicData?.topic.name},<br />forgé.
          </h1>
          <p style={{ margin: '0 0 36px', fontSize: 14, lineHeight: 1.75, color: L.ink2, maxWidth: '56ch' }}>
            {totalLessons} leçon{totalLessons > 1 ? 's' : ''}
            {quizAttempt ? ` et un quiz de validation réussi à ${Math.round(quizAttempt.percentage)}%` : ''}. Le foyer s&rsquo;éteint : les cinq domaines sont de nouveau ouverts.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: L.rule, border: `1px solid ${L.rule}`, marginBottom: 44 }}>
            <div style={{ background: L.paper2, padding: '20px 22px' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>LEÇONS</div>
              <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{totalLessons}</div>
            </div>
            <div style={{ background: L.paper2, padding: '20px 22px' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>POINTS GAGNÉS</div>
              <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{pointsGained}</div>
            </div>
            <div style={{ background: L.paper2, padding: '20px 22px' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.16em', color: L.ink3, marginBottom: 9 }}>NIVEAU DU DOMAINE</div>
              <div style={{ fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{domainLevel ? `${domainLevel}/5` : '—'}</div>
            </div>
          </div>
          {nextChoices.length > 0 && (
            <>
              <div style={{ fontSize: 11, letterSpacing: '0.20em', fontWeight: 600, marginBottom: 16 }}>ALLUMER LE PROCHAIN FOYER</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                {nextChoices.map((d) => (
                  <Link
                    key={d.id}
                    href={`/learn?domain=${d.slug}`}
                    style={{ border: `1px solid ${L.rule}`, background: L.paper2, padding: '18px 18px 20px', textDecoration: 'none', color: L.ink, display: 'block' }}
                  >
                    <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 19, marginBottom: 8 }}>{d.name}</div>
                    <div style={{ fontSize: 10, color: L.ink2, lineHeight: 1.6 }}>
                      {d.topics.length} sujet{d.topics.length > 1 ? 's' : ''} · {d.placementResults?.[0]?.assignedLevel ? `niveau ${d.placementResults[0].assignedLevel}` : 'non évalué'}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const tabDefs: { key: typeof tab; label: string; show: boolean }[] = [
    { key: 'lesson', label: 'Leçon du jour', show: !!activeLesson },
    { key: 'placement', label: 'Test de placement', show: !!placementTest },
    { key: 'quiz', label: 'Quiz de validation', show: showQuizTab },
  ];
  const visibleTabs = tabDefs.filter((t) => t.show);

  return (
    <div style={{ display: 'flex', minHeight: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '40px 52px 90px', maxWidth: 820 }}>
        {visibleTabs.length > 1 && (
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 30, flexWrap: 'wrap' }}>
            {visibleTabs.map((t) => {
              const on = effectiveTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    paddingBottom: 5,
                    color: on ? L.ink : L.ink3,
                    fontWeight: on ? 600 : 400,
                    borderBottom: `1px solid ${on ? EMBER : 'transparent'}`,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {effectiveTab === 'placement' && placementTest && (
          <TestFlow
            kicker="ÉVALUATION INITIALE"
            title={placementTest.title}
            intro="Questions à choix multiples. Le score détermine le niveau de départ ; aucune réponse n'est pénalisée."
            questions={placementTest.questions}
            isPlacement
            onSubmit={(answers) => placementMutation.mutate(answers)}
            pending={placementMutation.isPending}
            result={
              placementMutation.data
                ? { score: placementMutation.data.score, percentage: placementMutation.data.score, assignedLevel: placementMutation.data.assignedLevel }
                : null
            }
            onReset={() => placementMutation.reset()}
            onPrimaryCta={() => {
              placementMutation.reset();
              setTab('lesson');
            }}
            primaryCtaLabel="COMMENCER LA LEÇON"
          />
        )}

        {effectiveTab === 'quiz' && quiz && (
          <TestFlow
            kicker="VALIDATION DE THÈME"
            title={quiz.title}
            intro={`Questions à choix multiples. Score minimum requis : ${quiz.passingScore}%. En cas d'échec, le thème reste ouvert et le quiz est repassable.`}
            questions={quiz.questions}
            isPlacement={false}
            onSubmit={(answers) => quizMutation.mutate(answers)}
            pending={quizMutation.isPending}
            result={quizMutation.data ? { score: quizMutation.data.score, maxScore: quizMutation.data.maxScore, percentage: quizMutation.data.percentage, passed: quizMutation.data.passed, passingScore: quizMutation.data.passingScore } : null}
            onReset={() => quizMutation.reset()}
            onPrimaryCta={() => router.push('/dashboard')}
            primaryCtaLabel="CHOISIR UN NOUVEAU DOMAINE"
          />
        )}

        {effectiveTab === 'lesson' && activeLesson && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
              <div style={{ width: 9, height: 9, background: EMBER }} />
              <span style={{ fontSize: 10, letterSpacing: '0.18em', color: EMBER }}>
                {activeLesson.sessionType === 'MORNING' ? 'MATIN' : activeLesson.sessionType === 'EVENING' ? 'SOIR' : 'JOURNÉE'} · {activeLesson.durationMinutes} MIN · JOUR {activeLesson.dayNumber}
              </span>
            </div>

            <div style={{ fontSize: 11, letterSpacing: '0.14em', color: L.ink3, marginBottom: 12 }}>
              {domainData?.name.toUpperCase()} / {topicData?.topic.name.toUpperCase()}
            </div>
            <h1 style={{ margin: '0 0 22px', fontFamily: 'var(--font-serif-display)', fontWeight: 400, fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.015em' }}>
              {activeLesson.title}
            </h1>

            {activeLesson.bookReference && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderLeft: `2px solid ${EMBER}`, padding: '2px 0 2px 16px', marginBottom: 34 }}>
                <div style={{ fontSize: 11, lineHeight: 1.7, color: L.ink2 }}>
                  Source de la leçon
                  <br />
                  <span style={{ fontFamily: 'var(--font-serif-display)', fontSize: 15, fontStyle: 'italic', color: L.ink }}>{activeLesson.bookReference.title}</span>{' '}
                  <span style={{ color: L.ink }}>
                    — {activeLesson.bookReference.author}
                    {activeLesson.chapterCitation ? `, ${activeLesson.chapterCitation}` : ''}
                  </span>
                </div>
              </div>
            )}

            <LessonProse content={activeLesson.contentMd} />

            {(() => {
              const concepts: string[] = JSON.parse(activeLesson.keyConcepts || '[]');
              if (concepts.length === 0) return null;
              return (
                <div style={{ marginTop: 40, border: `1px solid ${L.rule}`, background: L.paper2, padding: '24px 26px' }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.18em', color: L.ink3, marginBottom: 18 }}>CONCEPTS CLÉS À RETENIR</div>
                  {concepts.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14, padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${L.rule2}` }}>
                      <span style={{ fontSize: 10, color: EMBER, fontVariantNumeric: 'tabular-nums', paddingTop: 3 }}>{String(i + 1).padStart(2, '0')}</span>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {!(completeMutation.isSuccess && completeMutation.variables?.lesson.id === activeLesson.id) && (
              <>
                <div style={{ marginTop: 30 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.16em', color: L.ink3, marginBottom: 8 }}>NOTES DE SESSION (OPTIONNEL)</div>
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    rows={2}
                    placeholder="Ce que vous voulez retenir, une difficulté, une question à creuser…"
                    style={{
                      all: 'unset',
                      boxSizing: 'border-box',
                      display: 'block',
                      width: '100%',
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: L.ink,
                      border: `1px solid ${L.rule}`,
                      background: L.paper2,
                      padding: '10px 12px',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                <button
                  onClick={() => completeMutation.mutate({ lesson: { id: activeLesson.id, sessionType: activeLesson.sessionType } })}
                  disabled={completeMutation.isPending}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: completeMutation.isPending ? 'default' : 'pointer',
                    background: L.ink,
                    color: L.paper,
                    fontSize: 12,
                    letterSpacing: '0.16em',
                    padding: '16px 32px',
                    opacity: completeMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {completeMutation.isPending ? 'ENREGISTREMENT...' : 'VALIDER LA SESSION'}
                </button>
                <span style={{ fontSize: 11, color: L.ink2 }}>+ 50 points</span>
                </div>
              </>
            )}
            {completeMutation.isSuccess && completeMutation.variables?.lesson.id === activeLesson.id && (
              <div style={{ marginTop: 34, border: `1px solid ${VERDANT}`, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ width: 9, height: 9, background: VERDANT }} />
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  Session validée ·{' '}
                  <span style={{ fontWeight: 600 }}>+{completeMutation.data?.data?.xpAwarded ?? 50} points</span>
                  {completeMutation.variables?.alsoNext && completeMutation.data?.data?.caughtUpTitle ? (
                    <span style={{ color: L.ink2 }}> · rattrapage : « {completeMutation.data.data.caughtUpTitle} » validée aussi</span>
                  ) : null}
                </div>
              </div>
            )}
            {!(completeMutation.isSuccess && completeMutation.variables?.lesson.id === activeLesson.id) &&
              topicData &&
              topicData.progress.totalLessons - topicData.progress.completedLessons >= 2 && (
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={() => completeMutation.mutate({ lesson: { id: activeLesson.id, sessionType: activeLesson.sessionType }, alsoNext: true })}
                  disabled={completeMutation.isPending}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: completeMutation.isPending ? 'default' : 'pointer',
                    border: `1px solid ${L.rule3}`,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: L.ink2,
                    padding: '10px 18px',
                    opacity: completeMutation.isPending ? 0.6 : 1,
                  }}
                >
                  SÉANCE DE RATTRAPAGE · VALIDER AUSSI LA LEÇON SUIVANTE (+100 PTS)
                </button>
                <div style={{ fontSize: 10, color: L.ink3, marginTop: 8 }}>
                  Pour rattraper une session manquée : deux leçons aujourd&apos;hui, le rythme est sauvé.
                </div>
              </div>
            )}
          </>
        )}

        {effectiveTab === 'lesson' && !activeLesson && !showQuizTab && (
          <div style={{ border: `1px dashed ${L.rule3}`, padding: '40px', textAlign: 'center', color: L.ink3, fontSize: 12 }}>
            {topicSlug ? 'Aucune leçon disponible pour ce sujet pour le moment.' : 'Aucun cours trouvé pour ce domaine.'}
          </div>
        )}
      </div>

      <div style={{ width: 310, flex: '0 0 auto', borderLeft: `1px solid ${L.rule}`, padding: '40px 30px', background: L.paper3 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 14 }}>DOMAINE EN COURS</div>
        <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 24, marginBottom: 20 }}>{domainData?.name}</div>

        {topicData && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.1em', color: L.ink2, marginBottom: 8 }}>
              <span>LEÇONS</span>
              <span style={{ color: L.ink, fontWeight: 600 }}>
                {topicData.progress.completedLessons} / {topicData.progress.totalLessons}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 30 }}>
              {Array.from({ length: Math.max(topicData.progress.totalLessons, 1) }, (_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 18,
                    background: i < topicData.progress.completedLessons ? L.ink : 'transparent',
                    border: `1px solid ${i < topicData.progress.completedLessons ? L.ink : L.rule3}`,
                  }}
                />
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 12 }}>SUJETS DU DOMAINE</div>
        {domainData?.topics.map((t) => {
          const isCurrent = t.slug === topicSlug;
          return (
            <Link
              key={t.id}
              href={`/learn?domain=${domainData.slug}&topic=${t.slug}`}
              style={{ padding: '11px 12px', borderLeft: `2px solid ${isCurrent ? EMBER : L.ruleFaint3}`, background: isCurrent ? L.paper2 : 'transparent', marginBottom: 4, textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? L.ink : L.ink2 }}>{t.name}</span>
                <span style={{ fontSize: 9, letterSpacing: '0.1em', color: L.ink3, whiteSpace: 'nowrap' }}>{isCurrent ? 'ACTIF' : 'OUVRIR'}</span>
              </div>
            </Link>
          );
        })}

        <div style={{ height: 1, background: L.rule, margin: '26px 0' }} />
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: L.ink3, marginBottom: 12 }}>ÉVALUATIONS</div>
        {placementTest && (
          <button
            onClick={() => setTab('placement')}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%', border: `1px solid ${L.rule}`, padding: '13px 14px', marginBottom: 9, background: L.paper2 }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Test de placement</div>
            <div style={{ fontSize: 10, color: L.ink2 }}>
              {domainData?.placementResults?.[0]
                ? `${domainData.placementResults[0].score}% · niveau ${domainData.placementResults[0].assignedLevel}`
                : 'Pas encore passé'}
            </div>
          </button>
        )}
        <button
          onClick={() => showQuizTab && setTab('quiz')}
          disabled={!showQuizTab}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            cursor: showQuizTab ? 'pointer' : 'default',
            display: 'block',
            width: '100%',
            border: `1px dashed ${L.rule3}`,
            padding: '13px 14px',
            background: 'transparent',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3, color: L.ink2 }}>Quiz de validation</div>
          <div style={{ fontSize: 10, color: L.ink3 }}>
            {quiz ? `Seuil ${quiz.passingScore}%` : `Ouvert après la dernière leçon`}
          </div>
        </button>
      </div>
    </div>
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div style={{ padding: '44px 52px', color: L.ink3, fontSize: 12 }}>Chargement…</div>}>
      <LearnContent />
    </Suspense>
  );
}
