'use client';

import React, { useState, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import { useIsMobile } from '@/hooks/useIsMobile';
import { D, EMBER, VERDANT } from '@/lib/theme';
import { parseJsonResponse, toErrorMessage } from '@/lib/errors';
import type { DomainSummary } from '@/types/models';
import MobileAdmin from '@/components/mobile/screens/Admin';

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

interface BookAnalysis {
  isTeachable: boolean;
  rejectionReason: string;
  detectedTitle: string;
  detectedAuthor: string;
  summary: string;
  domainId: string | null;
  newDomain: { name: string; description: string; color: string } | null;
  topics: AnalysisTopic[];
}

interface ReviewTopic extends AnalysisTopic {
  include: boolean;
}

interface BookRow {
  id: string;
  title: string;
  author: string;
  addedAt: string;
  lessonsCount: number;
  topics: string[];
}

type Phase = 'idle' | 'analyzing' | 'review' | 'launching';

export default function AdminLibraryPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileAdmin />;
  return <AdminLibraryDesktop />;
}

function AdminLibraryDesktop() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  // Résultat de l'analyse + état éditable de l'écran de validation
  const [analysis, setAnalysis] = useState<BookAnalysis | null>(null);
  const [totalChunks, setTotalChunks] = useState(0);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [domainChoice, setDomainChoice] = useState<string>('');
  const [newDomain, setNewDomain] = useState({ name: '', description: '', color: '#3b82f6' });
  const [reviewTopics, setReviewTopics] = useState<ReviewTopic[]>([]);
  const [chainPrereqs, setChainPrereqs] = useState(true);

  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [log, setLog] = useState<LogLine[]>([
    { t: '—', text: "Déposez un PDF : l'IA détecte le titre, l'auteur, le domaine et les thèmes.", kind: 'info' },
    { t: '—', text: 'Vous validez la proposition avant la génération des leçons.', kind: 'info' },
  ]);
  const [books, setBooks] = useState<BookRow[]>([]);

  useEffect(() => {
    fetch('/api/domains')
      .then((res) => res.json())
      .then((data) => {
        if (data.domains) setDomains(data.domains);
      });
    refreshBooks();
  }, []);

  const stamp = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const addLog = (text: string, kind: LogLine['kind'] = 'info') =>
    setLog((l) => [...l, { t: stamp(), text, kind }]);

  function refreshBooks() {
    fetch('/api/admin/books')
      .then((res) => res.json())
      .then((data) => {
        if (data.books) setBooks(data.books);
      });
  }

  const cleanupBlob = (url: string | null) => {
    if (!url) return;
    fetch('/api/admin/blob-upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  };

  const handleFileSelected = (f: File) => {
    cleanupBlob(fileUrl);
    setFileUrl(null);
    setFile(f);
    setPhase('idle');
    setAnalysis(null);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setPhase('analyzing');
    setLog([{ t: stamp(), text: `Analyse du document — ${file.name}…`, kind: 'info' }]);
    try {
      // Téléversement direct navigateur → Blob : contourne la limite de
      // ~4,5 Mo par requête des fonctions serverless Vercel.
      let url = fileUrl;
      if (!url) {
        addLog('Téléversement du fichier…');
        const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/admin/blob-upload' });
        url = blob.url;
        setFileUrl(url);
      }

      const fd = new FormData();
      fd.append('fileUrl', url);
      if (apiKey) fd.append('apiKey', apiKey);
      const res = await fetch('/api/admin/analyze-book', { method: 'POST', body: fd });
      const data = await parseJsonResponse<{ analysis: BookAnalysis; totalChunks: number }>(res, "Échec de l'analyse");
      const a: BookAnalysis = data.analysis;

      if (!a.isTeachable) {
        addLog(`Document non enseignable : ${a.rejectionReason || 'contenu inadapté.'}`, 'error');
        setPhase('idle');
        return;
      }

      setAnalysis(a);
      setTotalChunks(data.totalChunks || 0);
      setTitle(a.detectedTitle || title);
      setAuthor(a.detectedAuthor || '');
      setDomainChoice(a.domainId ? `existing:${a.domainId}` : a.newDomain ? 'new' : '');
      if (a.newDomain) setNewDomain(a.newDomain);
      setReviewTopics(a.topics.map((t) => ({ ...t, include: true })));
      setChainPrereqs(true);
      addLog(
        `Analyse terminée : ${a.topics.length} thème(s) détecté(s), domaine ${a.domainId ? 'existant reconnu' : a.newDomain ? `à créer (« ${a.newDomain.name} »)` : 'non déterminé'}. Validez ci-dessous.`,
        'success'
      );
      setPhase('review');
    } catch (err) {
      addLog(toErrorMessage(err, "Erreur lors de l'analyse."), 'error');
      setPhase('idle');
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  interface JobState {
    status: string;
    processedChunks: number;
    totalChunks: number;
    lessonsCreated: number;
    questionsCreated: number;
    message?: string | null;
    error?: string;
  }

  const pollJob = async (jobId: string): Promise<JobState> => {
    let lastProcessed = -1;
    for (;;) {
      await sleep(3000);
      const res = await fetch(`/api/admin/ingest-pdf?jobId=${jobId}`);
      const job: JobState = await res.json();
      if (job.error) throw new Error(job.error);
      if (job.processedChunks !== lastProcessed && job.status === 'RUNNING') {
        lastProcessed = job.processedChunks;
        addLog(`Extrait ${job.processedChunks}/${job.totalChunks} · ${job.lessonsCreated} leçon(s)…`);
      }
      if (job.status === 'DONE' || job.status === 'ERROR') return job;
    }
  };

  const handleLaunch = async () => {
    const selected = reviewTopics.filter((t) => t.include);
    if (!title.trim() || !domainChoice || selected.length === 0) {
      addLog('Titre, domaine et au moins un thème sont requis.', 'error');
      return;
    }
    setPhase('launching');

    try {
      // 1. Domaine : existant ou création
      let domainId: string;
      if (domainChoice.startsWith('existing:')) {
        domainId = domainChoice.slice('existing:'.length);
        addLog(`Domaine cible : ${domains.find((d) => d.id === domainId)?.name || domainId}.`);
      } else {
        if (newDomain.name.trim().length < 3) throw new Error('Nom du nouveau domaine trop court.');
        const maxOrder = domains.reduce((m, d) => Math.max(m, d.order), 0);
        const slug = newDomain.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const res = await fetch('/api/admin/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newDomain.name.trim(),
            slug,
            description: newDomain.description || `Domaine créé depuis l'import de « ${title} ».`,
            icon: 'BookOpen',
            color: newDomain.color,
            order: maxOrder + 1,
            isActive: true,
          }),
        });
        const created = (await res.json()) as {
          id?: string;
          name?: string;
          description?: string;
          error?: string;
          details?: { message?: string }[];
        };
        if (!res.ok || !created.id) {
          throw new Error(created.details?.[0]?.message || created.error || 'Échec de la création du domaine.');
        }
        domainId = created.id;
        setDomains((d) => [
          ...d,
          {
            id: created.id as string,
            name: created.name ?? newDomain.name.trim(),
            slug,
            description: created.description ?? '',
            icon: 'BookOpen',
            color: newDomain.color,
            order: maxOrder + 1,
            isActive: true,
            topics: [],
          },
        ]);
        addLog(`Nouveau domaine créé : « ${created.name ?? newDomain.name.trim()} ».`, 'success');
      }

      // 2. Thèmes : réutilisation par slug ou création (avec chaîne de prérequis)
      const existingSlugs = new Map<string, string>();
      try {
        const coursesRes = await fetch('/api/admin/courses');
        const courses = await coursesRes.json();
        for (const d of Array.isArray(courses) ? courses : []) {
          for (const t of d.topics || []) existingSlugs.set(t.slug, t.id);
        }
      } catch {
        /* catalogue indisponible : on créera simplement */
      }

      let prevTopicId: string | null = null;
      const topicTargets: { id: string; name: string; topic: ReviewTopic }[] = [];
      for (const t of selected) {
        const foundId: string | undefined = existingSlugs.get(t.slug);
        if (foundId) {
          topicTargets.push({ id: foundId, name: t.name, topic: t });
          prevTopicId = foundId;
          addLog(`Thème existant réutilisé : « ${t.name} ».`);
          continue;
        }
        const res = await fetch('/api/admin/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domainId,
            name: t.name,
            slug: t.slug,
            description: t.description || `Thème issu du livre « ${title} ».`,
            maxDifficultyLevel: t.maxDifficultyLevel,
            estimatedWeeks: t.estimatedWeeks,
            prerequisites: chainPrereqs && prevTopicId ? [prevTopicId] : [],
          }),
        });
        const created = (await res.json()) as { id?: string; error?: string; details?: { message?: string }[] };
        if (!res.ok || !created.id) {
          throw new Error(created.details?.[0]?.message || created.error || `Échec de la création du thème « ${t.name} ».`);
        }
        const newTopicId: string = created.id;
        topicTargets.push({ id: newTopicId, name: t.name, topic: t });
        prevTopicId = newTopicId;
        addLog(`Thème créé : « ${t.name} » (${t.estimatedWeeks} sem.).`);
      }

      // 3. Génération séquentielle par thème (tranches d'extraits distinctes)
      for (const target of topicTargets) {
        addLog(`Génération des leçons — « ${target.name} » (extraits ${target.topic.chunkStart} à ${target.topic.chunkEnd})…`);
        const fd = new FormData();
        if (fileUrl) fd.append('fileUrl', fileUrl);
        else fd.append('rawText', '');
        fd.append('title', title.trim());
        fd.append('author', author.trim() || 'Auteur Inconnu');
        fd.append('domainId', domainId);
        fd.append('topicId', target.id);
        fd.append('chunkStart', String(target.topic.chunkStart));
        fd.append('chunkEnd', String(target.topic.chunkEnd));
        if (apiKey) fd.append('apiKey', apiKey);

        const res = await fetch('/api/admin/ingest-pdf', { method: 'POST', body: fd });
        const data = await parseJsonResponse<{ jobId?: string; message?: string }>(res, "Erreur d'ingestion");

        if (data.jobId) {
          const job = await pollJob(data.jobId);
          if (job.status === 'ERROR') {
            addLog(`« ${target.name} » : échec — ${job.message || 'erreur de génération.'}`, 'error');
          } else {
            addLog(
              `« ${target.name} » terminé : ${job.lessonsCreated} leçon(s), ${job.questionsCreated} question(s).`,
              'success'
            );
          }
        } else {
          addLog(`« ${target.name} » : ${data.message || 'livre enregistré.'}`, 'success');
        }
      }

      addLog('Import terminé. Les cours sont disponibles dans /learn.', 'success');
      cleanupBlob(fileUrl);
      setPhase('idle');
      setFile(null);
      setFileUrl(null);
      setAnalysis(null);
      setReviewTopics([]);
      refreshBooks();
    } catch (err) {
      addLog(toErrorMessage(err, 'Erreur lors de la génération.'), 'error');
      setPhase('idle');
    }
  };

  const handleDeleteBook = async (book: BookRow) => {
    const msg =
      book.lessonsCount > 0
        ? `Supprimer « ${book.title} » ainsi que ses ${book.lessonsCount} leçon(s) générées ?`
        : `Supprimer « ${book.title} » ?`;
    if (!window.confirm(msg)) return;
    try {
      await fetch(`/api/admin/books/${book.id}?deleteLessons=${book.lessonsCount > 0}`, { method: 'DELETE' });
      addLog(`Livre supprimé — ${book.title}.`, 'success');
      refreshBooks();
    } catch {
      addLog('Erreur lors de la suppression.', 'error');
    }
  };

  const busy = phase === 'analyzing' || phase === 'launching';
  const lastLine = log[log.length - 1];
  const statusLabel =
    phase === 'analyzing'
      ? 'ANALYSE DU DOCUMENT'
      : phase === 'launching'
        ? 'GÉNÉRATION EN COURS'
        : phase === 'review'
          ? 'VALIDATION REQUISE'
          : lastLine?.kind === 'success'
            ? 'TERMINÉ'
            : 'EN ATTENTE DE FICHIER';
  const statusColor =
    phase === 'analyzing' || phase === 'launching' ? EMBER : phase === 'review' ? EMBER : lastLine?.kind === 'success' ? VERDANT : D.text4;

  const updateTopic = (i: number, patch: Partial<ReviewTopic>) =>
    setReviewTopics((prev) => prev.map((t, ti) => (ti === i ? { ...t, ...patch } : t)));

  return (
    <div style={{ padding: '30px 34px 70px', maxWidth: 1180 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 13, letterSpacing: '0.20em', fontWeight: 600 }}>IMPORT DE CONTENU</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a
            href="/api/admin/export"
            download
            style={{ fontSize: 10, letterSpacing: '0.12em', color: D.text2, border: `1px solid ${D.border3}`, padding: '6px 11px', textDecoration: 'none' }}
          >
            EXPORTER LE CATALOGUE
          </a>
          <span style={{ fontSize: 10, color: D.text3, letterSpacing: '0.1em' }}>IMPORT AUTOMATIQUE</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 26, alignItems: 'start' }}>
        {/* Colonne gauche : dépôt + validation */}
        <div>
          <div style={{ position: 'relative', border: `1px dashed ${phase === 'review' ? D.border2 : D.border3}`, background: D.panel2, padding: '44px 30px', textAlign: 'center', marginBottom: 20 }}>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
              disabled={busy}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: busy ? 'default' : 'pointer' }}
            />
            <div style={{ width: 16, height: 16, border: `2px solid ${EMBER}`, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 13, marginBottom: 7 }}>{file ? file.name : 'Déposer un livre de référence'}</div>
            <div style={{ fontSize: 11, color: D.text3 }}>L&apos;IA analysera titre, auteur, domaine et thèmes</div>
          </div>

          {phase === 'idle' && file && (
            <button
              onClick={handleAnalyze}
              style={{
                all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%',
                background: EMBER, color: 'oklch(0.98 0.005 85)', fontSize: 11, letterSpacing: '0.14em',
                padding: '14px 26px', textAlign: 'center', marginBottom: 20,
              }}
            >
              ANALYSER LE DOCUMENT
            </button>
          )}

          {phase === 'review' && analysis && (
            <div style={{ border: `1px solid ${EMBER}`, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: EMBER, marginBottom: 16 }}>PROPOSITION DE L&apos;IA — À VALIDER</div>

              {analysis.summary && (
                <div style={{ fontSize: 11, lineHeight: 1.7, color: D.text2, marginBottom: 16, fontStyle: 'italic' }}>{analysis.summary}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', marginBottom: 16 }}>
                <div>
                  <div style={labelStyle}>TITRE DÉTECTÉ</div>
                  <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <div style={labelStyle}>AUTEUR DÉTECTÉ</div>
                  <input style={inputStyle} value={author} onChange={(e) => setAuthor(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>DOMAINE</div>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={domainChoice} onChange={(e) => setDomainChoice(e.target.value)}>
                  {analysis.newDomain && <option value="new">+ Créer un nouveau domaine : {analysis.newDomain.name}</option>}
                  {domains.map((d) => (
                    <option key={d.id} value={`existing:${d.id}`}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {domainChoice === 'new' && analysis.newDomain && (
                <div style={{ border: `1px solid ${D.border}`, padding: 14, marginBottom: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 14, marginBottom: 10 }}>
                    <div>
                      <div style={labelStyle}>NOM DU NOUVEAU DOMAINE</div>
                      <input style={inputStyle} value={newDomain.name} onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })} />
                    </div>
                    <div>
                      <div style={labelStyle}>COULEUR</div>
                      <input type="color" value={newDomain.color} onChange={(e) => setNewDomain({ ...newDomain, color: e.target.value })} style={{ width: '100%', height: 30, background: 'transparent', border: `1px solid ${D.border3}`, cursor: 'pointer' }} />
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>DESCRIPTION</div>
                    <input style={inputStyle} value={newDomain.description} onChange={(e) => setNewDomain({ ...newDomain, description: e.target.value })} />
                  </div>
                </div>
              )}

              <div style={labelStyle}>THÈMES DÉTECTÉS ({totalChunks} extraits analysés)</div>
              {reviewTopics.map((t, i) => (
                <div key={`${t.slug}-${i}`} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 70px 70px 110px', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: `1px solid ${D.border}` }}>
                  <input type="checkbox" checked={t.include} onChange={(e) => updateTopic(i, { include: e.target.checked })} style={{ accentColor: EMBER }} title="Inclure ce thème" />
                  <div style={{ minWidth: 0 }}>
                    <input style={{ ...inputStyle, fontSize: 12 }} value={t.name} onChange={(e) => updateTopic(i, { name: e.target.value })} />
                    <div style={{ fontSize: 9, color: D.text4, marginTop: 4 }}>{t.description}</div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={t.estimatedWeeks}
                    onChange={(e) => updateTopic(i, { estimatedWeeks: Math.max(1, parseInt(e.target.value) || 1) })}
                    title="Semaines estimées"
                    style={{ ...inputStyle, textAlign: 'center' }}
                  />
                  <select value={t.maxDifficultyLevel} onChange={(e) => updateTopic(i, { maxDifficultyLevel: parseInt(e.target.value) })} style={{ ...inputStyle, cursor: 'pointer' }} title="Difficulté max">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>N{n}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 9, color: D.text3, textAlign: 'right' }}>
                    extraits {t.chunkStart}–{t.chunkEnd}
                  </div>
                </div>
              ))}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={chainPrereqs} onChange={(e) => setChainPrereqs(e.target.checked)} style={{ accentColor: EMBER }} />
                <span style={{ fontSize: 10, color: D.text2 }}>Chaîne de prérequis entre les thèmes (dans l&apos;ordre du livre)</span>
              </label>

              <div style={{ marginTop: 18 }}>
                <button
                  onClick={handleLaunch}
                  style={{
                    all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%',
                    background: EMBER, color: 'oklch(0.98 0.005 85)', fontSize: 11, letterSpacing: '0.14em',
                    padding: '14px 26px', textAlign: 'center',
                  }}
                >
                  VALIDER ET LANCER LA GÉNÉRATION ({reviewTopics.filter((t) => t.include).length} THÈME{reviewTopics.filter((t) => t.include).length > 1 ? 'S' : ''})
                </button>
              </div>
            </div>
          )}

          {!phase.startsWith('rev') && !busy && !file && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, border: `1px solid ${D.border}`, padding: 20, marginBottom: 20 }}>
              <div>
                <div style={labelStyle}>CLÉ IA OPTIONNELLE</div>
                <input style={inputStyle} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="laisser vide pour utiliser la clé du serveur" />
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite : journal */}
        <div style={{ border: `1px solid ${D.border}`, background: D.panel2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: `1px solid ${D.border}` }}>
            {(phase === 'analyzing' || phase === 'launching') && (
              <div style={{ width: 8, height: 8, background: statusColor, animation: 'sf-pulse 1.2s ease-in-out infinite' }} />
            )}
            {!(phase === 'analyzing' || phase === 'launching') && <div style={{ width: 8, height: 8, background: statusColor }} />}
            <span style={{ fontSize: 10, letterSpacing: '0.16em' }}>{statusLabel}</span>
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 280 }}>
            {log.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'baseline' }}>
                <span style={{ fontSize: 9, color: D.text4, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{l.t}</span>
                <span
                  style={{
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: l.kind === 'success' ? VERDANT : l.kind === 'error' ? 'oklch(0.62 0.13 30)' : 'oklch(0.88 0.008 85)',
                  }}
                >
                  {l.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bibliothèque */}
      <div style={{ marginTop: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: D.text3, marginBottom: 16 }}>
          BIBLIOTHÈQUE ({books.length} OUVRAGE{books.length > 1 ? 'S' : ''})
        </div>
        {books.length === 0 && (
          <div style={{ border: `1px dashed ${D.border3}`, padding: 30, textAlign: 'center', color: D.text3, fontSize: 12 }}>
            Aucun livre en base pour le moment.
          </div>
        )}
        {books.map((book) => (
          <div key={book.id} style={{ display: 'flex', alignItems: 'center', gap: 18, border: `1px solid ${D.border}`, background: D.panel2, padding: '14px 20px', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {book.title} <span style={{ color: D.text3, fontWeight: 400 }}>— {book.author}</span>
              </div>
              <div style={{ fontSize: 10, color: D.text3, marginTop: 4 }}>
                {book.lessonsCount} leçon{book.lessonsCount > 1 ? 's' : ''}
                {book.topics.length > 0 ? ` · ${book.topics.join(' · ')}` : ' · aucune leçon liée'}
              </div>
            </div>
            <span style={{ fontSize: 9, color: D.text4, fontVariantNumeric: 'tabular-nums' }}>
              {new Date(book.addedAt).toLocaleDateString('fr-FR')}
            </span>
            <button
              onClick={() => handleDeleteBook(book)}
              style={{
                all: 'unset', boxSizing: 'border-box', cursor: 'pointer', fontSize: 9, letterSpacing: '0.12em',
                color: 'oklch(0.62 0.13 30)', border: `1px solid oklch(0.62 0.13 30 / 0.4)`, padding: '6px 11px',
              }}
            >
              SUPPRIMER
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
