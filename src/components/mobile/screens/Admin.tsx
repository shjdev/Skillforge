'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EMBER, VERDANT, D, FONT_SERIF, formatPoints } from '@/lib/theme';
import { useAppStore } from '@/stores/useAppStore';
import { useMounted } from '@/hooks/useMounted';

interface LogLine {
  t: string;
  text: string;
  kind: 'info' | 'success' | 'error';
}

interface AnalysisTopic {
  name: string;
  slug: string;
  description: string;
  estimatedWeeks: number;
  maxDifficultyLevel: number;
  chunkStart: number;
  chunkEnd: number;
}

interface Analysis {
  isTeachable: boolean;
  rejectionReason: string;
  detectedTitle: string;
  detectedAuthor: string;
  summary: string;
  domainId: string | null;
  newDomain: { name: string; description: string; color: string } | null;
  topics: AnalysisTopic[];
}

/** ISO-8601 week number, e.g. "SEM. 34 · 2026". */
function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `SEM. ${week} · ${date.getUTCFullYear()}`;
}

export default function MobileAdmin() {
  const mounted = useMounted();
  const profile = useAppStore((state) => state.userProfile);

  const [kpis, setKpis] = useState<{ label: string; value: string; sub: string }[]>([]);
  const [activity, setActivity] = useState<{ time: string; tag: string; text: string; val: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'confirm' | 'running'>('idle');
  const [log, setLog] = useState<LogLine[]>([
    { t: '—', text: 'Aucun import en cours.', kind: 'info' },
    { t: '—', text: 'Déposez un PDF : analyse et création automatiques.', kind: 'info' },
  ]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/courses').then((r) => r.json()).catch(() => null),
      fetch('/api/admin/activity').then((r) => r.json()).catch(() => null),
    ]).then(([courses, act]) => {
      if (Array.isArray(courses)) {
        const domains = courses.length;
        const topics = courses.reduce((s: number, d: { topics?: unknown[] }) => s + (d.topics?.length || 0), 0);
        const lessons = courses.reduce(
          (s: number, d: { topics?: { lessons?: unknown[] }[] }) =>
            s + (d.topics || []).reduce((ss: number, t) => ss + (t.lessons?.length || 0), 0),
          0
        );
        setKpis([
          { label: 'DOMAINES', value: String(domains), sub: `${courses.filter((d: { isActive?: boolean }) => d.isActive !== false).length} actifs` },
          { label: 'THÈMES', value: String(topics), sub: 'toutes spécialités' },
          { label: 'LEÇONS', value: String(lessons), sub: 'dont leçons de livres' },
          { label: 'CAPITAL', value: formatPoints(profile?.totalXp || 0), sub: `série de ${profile?.currentStreak || 0} j` },
        ]);
      }
      if (act?.activity) setActivity(act.activity.slice(0, 8));
    });
  }, [profile?.totalXp, profile?.currentStreak]);

  const stamp = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const addLog = (text: string, kind: LogLine['kind'] = 'info') => setLog((l) => [...l, { t: stamp(), text, kind }]);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleAnalyze = async (selected?: File) => {
    const f = selected || file;
    if (!f || busy) return;
    setFile(f);
    setPhase('analyzing');
    setLog([{ t: stamp(), text: `Analyse — ${f.name}…`, kind: 'info' }]);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/admin/analyze-book', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const a: Analysis = data.analysis;
      if (!a.isTeachable) {
        addLog(`Document non enseignable : ${a.rejectionReason || 'inadapté.'}`, 'error');
        setPhase('idle');
        return;
      }
      setAnalysis(a);
      addLog(`${a.topics.length} thème(s) détecté(s). Validez pour lancer la génération.`, 'success');
      setPhase('confirm');
    } catch (err) {
      addLog(err instanceof Error ? err.message : "Erreur d'analyse.", 'error');
      setPhase('idle');
    }
  };

  const pollJob = async (jobId: string): Promise<{ status: string; lessonsCreated: number; questionsCreated: number; message?: string | null }> => {
    for (;;) {
      await sleep(3000);
      const job = await fetch(`/api/admin/ingest-pdf?jobId=${jobId}`).then((r) => r.json());
      if (job.error) throw new Error(job.error);
      if (job.status === 'RUNNING') {
        addLog(`${job.processedChunks}/${job.totalChunks} extraits · ${job.lessonsCreated} leçon(s)…`);
      }
      if (job.status === 'DONE' || job.status === 'ERROR') return job;
    }
  };

  const handleLaunch = async () => {
    if (!analysis) return;
    setPhase('running');
    try {
      // Domaine
      let domainId: string;
      if (analysis.domainId) {
        domainId = analysis.domainId;
        addLog(`Domaine existant ciblé.`);
      } else if (analysis.newDomain) {
        const nd = analysis.newDomain;
        const slug = nd.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const res = await fetch('/api/admin/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nd.name, slug, description: nd.description, icon: 'BookOpen', color: nd.color, order: 90, isActive: true }),
        });
        const created = await res.json();
        if (!res.ok) throw new Error(created.details?.[0]?.message || created.error);
        domainId = created.id;
        addLog(`Nouveau domaine créé : « ${created.name} ».`, 'success');
      } else {
        throw new Error('Aucun domaine déterminé.');
      }

      // Thèmes (avec chaîne de prérequis)
      let prevTopicId: string | null = null;
      const targets: { id: string; name: string; topic: AnalysisTopic }[] = [];
      for (const t of analysis.topics) {
        const res = await fetch('/api/admin/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domainId,
            name: t.name,
            slug: t.slug,
            description: t.description,
            maxDifficultyLevel: t.maxDifficultyLevel,
            estimatedWeeks: t.estimatedWeeks,
            prerequisites: prevTopicId ? [prevTopicId] : [],
          }),
        });
        const created = await res.json();
        if (!res.ok && created.details?.[0]?.message?.includes('slug')) {
          addLog(`Thème « ${t.name} » existe déjà — ignoré.`);
        } else if (!res.ok) {
          throw new Error(created.details?.[0]?.message || created.error || `Échec du thème ${t.name}`);
        } else {
          addLog(`Thème créé : « ${t.name} ».`);
        }
        const id: string = created.id || '';
        targets.push({ id, name: t.name, topic: t });
        prevTopicId = id || prevTopicId;
      }

      // Génération par tranche
      for (const target of targets) {
        if (!target.id) continue;
        addLog(`Génération — « ${target.name} » (extraits ${target.topic.chunkStart}–${target.topic.chunkEnd})…`);
        const fd = new FormData();
        if (file) fd.append('file', file);
        fd.append('title', analysis.detectedTitle || file?.name.replace(/\.[^/.]+$/, '') || 'Livre');
        fd.append('author', analysis.detectedAuthor || 'Auteur Inconnu');
        fd.append('domainId', domainId);
        fd.append('topicId', target.id);
        fd.append('chunkStart', String(target.topic.chunkStart));
        fd.append('chunkEnd', String(target.topic.chunkEnd));
        const res = await fetch('/api/admin/ingest-pdf', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const job = await pollJob(data.jobId);
        if (job.status === 'ERROR') {
          addLog(`« ${target.name} » : échec — ${job.message}`, 'error');
        } else {
          addLog(`« ${target.name} » : ${job.lessonsCreated} leçons, ${job.questionsCreated} questions.`, 'success');
        }
      }
      addLog('Import terminé.', 'success');
      setPhase('idle');
      setAnalysis(null);
      setFile(null);
    } catch (err) {
      addLog(err instanceof Error ? err.message : 'Erreur.', 'error');
      setPhase('idle');
    }
  };

  const busy = phase === 'analyzing' || phase === 'running';

  return (
    <div style={{ padding: '20px 20px 26px', color: D.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 10, height: 10, background: EMBER }} />
        <span style={{ fontSize: 11, letterSpacing: '0.20em', fontWeight: 600 }}>SYNTHÈSE</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, letterSpacing: '0.16em', color: D.text3 }}>{mounted ? isoWeekLabel(new Date()) : ''}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: D.border, border: `1px solid ${D.border}`, marginBottom: 24 }}>
        {(kpis.length > 0 ? kpis : [
          { label: '—', value: '', sub: '' },
          { label: '—', value: '', sub: '' },
          { label: '—', value: '', sub: '' },
          { label: '—', value: '', sub: '' },
        ]).map((k, i) => (
          <div key={i} style={{ background: D.panel, padding: '15px 15px 17px', minHeight: 84 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.14em', color: D.text3, marginBottom: 11 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 500, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            <div style={{ fontSize: 10, color: D.text2, marginTop: 9, lineHeight: 1.5 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, letterSpacing: '0.16em', color: D.text3, marginBottom: 10 }}>ACTIVITÉ RÉCENTE</div>
      <div style={{ border: `1px solid ${D.border}`, marginBottom: 24 }}>
        {activity.length === 0 ? (
          <div style={{ padding: 16, fontSize: 11, color: D.text3 }}>Pas encore d&apos;activité.</div>
        ) : (
          activity.map((a, i) => (
            <div key={i} style={{ padding: '13px 14px', borderBottom: i < activity.length - 1 ? `1px solid ${D.border2}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 9, letterSpacing: '0.10em', padding: '3px 7px', flex: '0 0 auto',
                    border: `1px solid ${a.tag === 'SESSION' ? D.border3 : EMBER}`,
                    color: a.tag === 'SESSION' ? D.text2 : EMBER,
                  }}
                >
                  {a.tag}
                </span>
                <span style={{ fontSize: 10, color: D.text3, fontVariantNumeric: 'tabular-nums' }}>{a.time}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: D.text2, fontVariantNumeric: 'tabular-nums' }}>{a.val}</span>
              </div>
              <div style={{ fontSize: 12, color: D.text, lineHeight: 1.5 }}>{a.text}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: 10, letterSpacing: '0.16em', color: D.text3, marginBottom: 10 }}>IMPORT DE CONTENU</div>
      <button
        onClick={() => !busy && fileRef.current?.click()}
        style={{
          all: 'unset', boxSizing: 'border-box', cursor: busy ? 'default' : 'pointer', display: 'block', width: '100%',
          border: `1px dashed ${D.border3}`, background: D.panel2, padding: '28px 20px', textAlign: 'center', marginBottom: 12,
        }}
      >
        <div style={{ width: 15, height: 15, border: `2px solid ${EMBER}`, margin: '0 auto 13px' }} />
        <div style={{ fontSize: 13, marginBottom: 6 }}>{file ? file.name : 'Déposer un livre de référence'}</div>
        <div style={{ fontSize: 11, color: D.text3, lineHeight: 1.5 }}>
          {busy ? 'Traitement en cours…' : 'PDF · analyse IA puis validation'}
        </div>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleAnalyze(f);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />

      {/* Confirmation compacte */}
      {phase === 'confirm' && analysis && (
        <div style={{ border: `1px solid ${EMBER}`, background: D.panel2, padding: 16, marginBottom: 12 }}>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 19, marginBottom: 4 }}>{analysis.detectedTitle || file?.name}</div>
          <div style={{ fontSize: 11, color: D.text3, marginBottom: 12 }}>{analysis.detectedAuthor}</div>
          {analysis.summary && <div style={{ fontSize: 11, color: D.text2, lineHeight: 1.6, marginBottom: 12, fontStyle: 'italic' }}>{analysis.summary}</div>}
          <div style={{ fontSize: 10, letterSpacing: '0.14em', color: D.text3, marginBottom: 8 }}>
            DOMAINE : {analysis.domainId ? 'EXISTANT' : `NOUVEAU — ${analysis.newDomain?.name.toUpperCase()}`}
          </div>
          {analysis.topics.map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: `1px solid ${D.border2}`, fontSize: 12 }}>
              <span>{t.name}</span>
              <span style={{ color: D.text3, whiteSpace: 'nowrap' }}>{t.estimatedWeeks} sem · N{t.maxDifficultyLevel}</span>
            </div>
          ))}
          <button
            onClick={handleLaunch}
            style={{
              all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%', marginTop: 14,
              textAlign: 'center', background: EMBER, color: 'oklch(0.98 0.005 85)', fontSize: 11, letterSpacing: '0.14em', padding: '15px 0',
            }}
          >
            LANCER LA GÉNÉRATION ({analysis.topics.length})
          </button>
        </div>
      )}

      <div style={{ border: `1px solid ${D.border}`, background: D.panel2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderBottom: `1px solid ${D.border}` }}>
          <div
            style={{
              width: 8, height: 8, flex: '0 0 auto',
              background: busy ? EMBER : log[log.length - 1]?.kind === 'success' ? VERDANT : D.text4,
              animation: busy ? 'sf-pulse 1.2s ease-in-out infinite' : undefined,
            }}
          />
          <span style={{ fontSize: 10, letterSpacing: '0.14em' }}>
            {phase === 'analyzing' ? 'ANALYSE' : phase === 'running' ? 'GÉNÉRATION EN COURS' : phase === 'confirm' ? 'VALIDATION REQUISE' : 'EN ATTENTE DE FICHIER'}
          </span>
        </div>
        <div style={{ padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {log.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 9, color: D.text3, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{l.t}</span>
              <span style={{ fontSize: 11, lineHeight: 1.6, color: l.kind === 'success' ? VERDANT : l.kind === 'error' ? 'oklch(0.62 0.13 30)' : D.text }}>
                {l.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/dashboard"
        style={{
          all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%', marginTop: 18,
          textAlign: 'center', border: `1px solid ${D.border3}`, color: EMBER, fontSize: 11, letterSpacing: '0.14em', padding: '16px 0',
        }}
      >
        ← ESPACE APPRENANT
      </Link>
    </div>
  );
}
