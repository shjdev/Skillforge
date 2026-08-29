'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/useIsMobile';
import { D, EMBER } from '@/lib/theme';
import type { AdminLessonRow, CourseDomain, CourseTopic } from '@/types/models';
import { CreateDomainForm } from '@/components/admin/CreateDomainForm';
import { CreateTopicForm } from '@/components/admin/CreateTopicForm';
import { CreateLessonForm } from '@/components/admin/CreateLessonForm';
import MobileAdmin from '@/components/mobile/screens/Admin';

export default function AdminCoursesPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileAdmin />;
  return <AdminCoursesDesktop />;
}

function AdminCoursesDesktop() {
  const queryClient = useQueryClient();
  const [domainEditor, setDomainEditor] = useState<CourseDomain | 'new' | null>(null);
  const [themeFormDomainId, setThemeFormDomainId] = useState<string | null>(null);
  const [lessonsTopicId, setLessonsTopicId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<AdminLessonRow | 'new' | null>(null);

  const { data: domains, isLoading, error } = useQuery<CourseDomain[]>({
    queryKey: ['admin-domains'],
    queryFn: async () => {
      const res = await fetch('/api/admin/courses');
      if (!res.ok) throw new Error('Failed to fetch courses');
      return res.json();
    },
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/domains/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete domain');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-domains'] }),
  });

  const totalTopics = domains?.reduce((s, d) => s + d.topics.length, 0) ?? 0;
  const totalLessons = domains?.reduce((s, d) => s + d.topics.reduce((ss, t) => ss + t.lessons.length, 0), 0) ?? 0;

  if (isLoading) {
    return (
      <div style={{ padding: '30px 34px' }}>
        <SkeletonBlock h={20} w={260} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 26, marginTop: 24 }}>
          <SkeletonBlock h={420} />
          <SkeletonBlock h={420} />
        </div>
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: '30px 34px', color: 'oklch(0.62 0.13 30)', fontSize: 12 }}>Une erreur est survenue.</div>;
  }

  return (
    <div style={{ padding: '30px 34px 70px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 13, letterSpacing: '0.20em', fontWeight: 600 }}>GESTION DES COURS</h1>
        <span style={{ fontSize: 10, color: D.text3, letterSpacing: '0.1em' }}>
          {domains?.length ?? 0} DOMAINES · {totalTopics} THÈMES · {totalLessons} LEÇONS
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 26, alignItems: 'start' }}>
        <div style={{ border: `1px solid ${D.border}`, background: D.panel, padding: 20 }}>
          {domainEditor ? (
            <>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: EMBER, marginBottom: 18 }}>
                {domainEditor === 'new' ? 'NOUVEAU DOMAINE' : 'MODIFIER LE DOMAINE'}
              </div>
              <div className="admin-form-dark">
                <CreateDomainForm
                  key={domainEditor === 'new' ? 'new' : domainEditor.id}
                  domain={domainEditor === 'new' ? undefined : domainEditor}
                  onSuccess={() => setDomainEditor(null)}
                />
              </div>
              <button
                onClick={() => setDomainEditor(null)}
                style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', textAlign: 'center', width: '100%', fontSize: 10, letterSpacing: '0.12em', color: D.text3, padding: '6px 0', marginTop: 8 }}
              >
                ANNULER
              </button>
            </>
          ) : (
            <button
              onClick={() => setDomainEditor('new')}
              style={{ ...{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', textAlign: 'center', border: `1px dashed ${D.border3}`, fontSize: 11, letterSpacing: '0.14em', color: EMBER, padding: '40px 20px', width: '100%' } }}
            >
              + NOUVEAU DOMAINE
            </button>
          )}
        </div>

        <div style={{ border: `1px solid ${D.border}` }}>
          {domains?.map((domain) => (
            <div key={domain.id} style={{ borderBottom: `1px solid ${D.border2}`, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ width: 9, height: 9, background: domain.color, flex: '0 0 auto' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{domain.name}</span>
                <span style={{ fontSize: 9, letterSpacing: '0.12em', color: D.text3 }}>/{domain.slug}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: D.text2, fontVariantNumeric: 'tabular-nums' }}>
                  {domain.topics.length} thème{domain.topics.length > 1 ? 's' : ''} · {domain.topics.reduce((s, t) => s + t.lessons.length, 0)} leçons
                </span>
                <button
                  onClick={() => setDomainEditor(domain)}
                  style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 9, letterSpacing: '0.12em', color: D.text2, border: `1px solid ${D.border3}`, padding: '4px 8px' }}
                >
                  MODIFIER
                </button>
                <button
                  onClick={() => window.confirm(`Supprimer "${domain.name}" et tout son contenu ?`) && deleteDomainMutation.mutate(domain.id)}
                  style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 9, letterSpacing: '0.12em', color: 'oklch(0.62 0.13 30)', border: `1px solid ${D.border3}`, padding: '4px 8px' }}
                >
                  SUPPRIMER
                </button>
              </div>
              <div style={{ fontSize: 11, color: D.text2, lineHeight: 1.6, marginBottom: 12, maxWidth: '70ch' }}>{domain.description}</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {domain.topics.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setLessonsTopicId(lessonsTopicId === t.id ? null : t.id);
                      setEditingLesson(null);
                    }}
                    title={t.prerequisites && t.prerequisites !== '[]' ? `Prérequis : ${t.prerequisites}` : undefined}
                    style={{
                      all: 'unset',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: `1px solid ${lessonsTopicId === t.id ? EMBER : D.border}`,
                      background: D.panel3,
                      padding: '6px 10px',
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{t.name}</span>
                    <span style={{ fontSize: 9, color: D.text3, fontVariantNumeric: 'tabular-nums' }}>{t.lessons.length} leç.</span>
                  </button>
                ))}
                <button
                  onClick={() => setThemeFormDomainId(themeFormDomainId === domain.id ? null : domain.id)}
                  style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', border: `1px dashed ${D.border3}`, padding: '6px 10px', fontSize: 10, letterSpacing: '0.1em', color: EMBER }}
                >
                  + THÈME
                </button>
              </div>

              {themeFormDomainId === domain.id && (
                <div style={{ marginTop: 14, border: `1px solid ${EMBER}`, padding: 16, background: D.panel2 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.16em', color: EMBER, marginBottom: 14 }}>NOUVEAU THÈME</div>
                  <CreateTopicForm
                    domainId={domain.id}
                    siblings={domain.topics.map((t) => ({ id: t.id, name: t.name }))}
                    onSuccess={() => setThemeFormDomainId(null)}
                  />
                </div>
              )}

              {domain.topics.map((t) =>
                lessonsTopicId === t.id ? (
                  <LessonsPanel
                    key={t.id}
                    topic={t}
                    editingLesson={editingLesson}
                    setEditingLesson={setEditingLesson}
                  />
                ) : null
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonBlock({ h, w }: { h: number; w?: number | string }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        background: D.panel2,
        border: `1px solid ${D.border2}`,
        animation: 'sf-pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

interface LessonsPanelProps {
  topic: CourseTopic;
  editingLesson: AdminLessonRow | 'new' | null;
  setEditingLesson: (l: AdminLessonRow | 'new' | null) => void;
}

function LessonsPanel({ topic, editingLesson, setEditingLesson }: LessonsPanelProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/lessons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Échec de la suppression');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domains'] });
      setEditingLesson(null);
    },
  });

  return (
    <div style={{ marginTop: 14, border: `1px solid ${D.border}`, padding: 16, background: D.panel2 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text3, marginBottom: 12 }}>LEÇONS — {topic.name.toUpperCase()}</div>

      {editingLesson === null && (
        <>
          {topic.lessons.length === 0 ? (
            <div style={{ fontSize: 11, color: D.text3, marginBottom: 12 }}>Aucune leçon pour l&rsquo;instant.</div>
          ) : (
            topic.lessons
              .slice()
              .sort((a, b) => a.dayNumber - b.dayNumber)
              .map((l) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${D.border2}` }}>
                  <span style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                  <span style={{ fontSize: 9, color: D.text3, flex: '0 0 auto' }}>J{l.dayNumber} · {l.sessionType} · N{l.difficultyLevel}</span>
                  <button onClick={() => setEditingLesson(l)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 9, letterSpacing: '0.1em', color: D.text2, border: `1px solid ${D.border3}`, padding: '4px 8px' }}>
                    MODIFIER
                  </button>
                  <button
                    onClick={() => window.confirm(`Supprimer "${l.title}" ?`) && deleteMutation.mutate(l.id)}
                    style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 9, letterSpacing: '0.1em', color: 'oklch(0.62 0.13 30)', border: `1px solid ${D.border3}`, padding: '4px 8px' }}
                  >
                    SUPPRIMER
                  </button>
                </div>
              ))
          )}
          <button
            onClick={() => setEditingLesson('new')}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', marginTop: 12, fontSize: 10, letterSpacing: '0.1em', color: EMBER, border: `1px dashed ${D.border3}`, padding: '6px 10px' }}
          >
            + LEÇON
          </button>
        </>
      )}

      {editingLesson !== null && (
        <div>
          <div className="admin-form-dark">
            <CreateLessonForm
              key={editingLesson === 'new' ? 'new' : editingLesson.id}
              topicId={topic.id}
              lesson={editingLesson === 'new' ? undefined : editingLesson}
              onSuccess={() => setEditingLesson(null)}
            />
          </div>
          <button
            onClick={() => setEditingLesson(null)}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 10, letterSpacing: '0.12em', color: D.text3, padding: '6px 0', marginTop: 8 }}
          >
            ANNULER
          </button>
        </div>
      )}
    </div>
  );
}
