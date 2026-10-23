'use client';

import React, { useEffect, useRef, useState } from 'react';
import { EMBER, VERDANT, L, FONT_SERIF } from '@/lib/theme';
import { MSkeleton } from '@/components/mobile/kit';
import { uploadBookFile } from '@/lib/blobUpload';
import { parseJsonResponse, toErrorMessage } from '@/lib/errors';
import { runTopicStepIngestion } from '@/lib/ingestClient';

interface BookRow {
  id: string;
  title: string;
  author: string;
  domain?: string;
  lessonsCount: number;
  topics: string[];
  isOwn?: boolean;
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

export default function MobileLivres() {
  const [books, setBooks] = useState<BookRow[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'confirm' | 'running'>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadBooks = () => {
    fetch('/api/books')
      .then((res) => res.json())
      .then((data) => setBooks(data.books || []))
      .catch(() => setBooks([]));
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const cleanupBlob = (url: string | null) => {
    if (!url) return;
    fetch('/api/admin/blob-upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  };

  const busy = phase === 'analyzing' || phase === 'running';

  const handleAnalyze = async (selected: File) => {
    if (busy) return;
    cleanupBlob(fileUrl);
    setFile(selected);
    setPhase('analyzing');
    setErrorMsg('');
    setStatusMsg('Téléversement et analyse IA du PDF…');
    try {
      const url = await uploadBookFile(selected);
      setFileUrl(url);
      const fd = new FormData();
      fd.append('fileUrl', url);
      const res = await fetch('/api/admin/analyze-book', { method: 'POST', body: fd });
      const data = await parseJsonResponse<{ analysis: Analysis }>(res, "Échec de l'analyse");
      if (!data.analysis.isTeachable) {
        setErrorMsg(`Non enseignable : ${data.analysis.rejectionReason || 'document inadapté.'}`);
        setPhase('idle');
        return;
      }
      setAnalysis(data.analysis);
      setStatusMsg(`${data.analysis.topics.length} thème(s) détecté(s).`);
      setPhase('confirm');
    } catch (err) {
      setErrorMsg(toErrorMessage(err, "Erreur d'analyse."));
      setPhase('idle');
    }
  };

  const handleLaunch = async () => {
    if (!analysis) return;
    setPhase('running');
    setErrorMsg('');
    try {
      let domainId: string;
      if (analysis.domainId) {
        domainId = analysis.domainId;
      } else if (analysis.newDomain) {
        const nd = analysis.newDomain;
        const slug = nd.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const res = await fetch('/api/admin/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nd.name,
            slug,
            description: nd.description,
            icon: 'BookOpen',
            color: nd.color,
            order: 90,
            isActive: true,
            personal: true,
          }),
        });
        const created = await res.json();
        if (!res.ok || !created.id) throw new Error(created.error || 'Échec création domaine');
        domainId = created.id;
      } else {
        throw new Error('Aucun domaine déterminé.');
      }

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
            personal: true,
          }),
        });
        const created = (await res.json()) as { id?: string; error?: string };
        if (!res.ok || !created.id) throw new Error(created.error || `Échec thème ${t.name}`);
        const newTopicId: string = created.id;
        targets.push({ id: newTopicId, name: t.name, topic: t });
        prevTopicId = newTopicId;
      }

      let sharedBookId: string | null = null;
      for (const target of targets) {
        setStatusMsg(`Génération de « ${target.name} »…`);
        const res = await runTopicStepIngestion({
          fileUrl,
          title: analysis.detectedTitle || file?.name.replace(/\.[^/.]+$/, '') || 'Livre',
          author: analysis.detectedAuthor || 'Auteur Inconnu',
          domainId,
          topicId: target.id,
          chunkStart: target.topic.chunkStart,
          chunkEnd: target.topic.chunkEnd,
          bookId: sharedBookId,
          personal: true,
          onProgress: ({ processedChunks, totalChunks, lessonsCreated }) => {
            setStatusMsg(`« ${target.name} » : extrait ${processedChunks}/${totalChunks} (${lessonsCreated} leçons)…`);
          },
        });
        if (res.bookId) sharedBookId = res.bookId;
      }

      cleanupBlob(fileUrl);
      setPhase('idle');
      setAnalysis(null);
      setFile(null);
      setFileUrl(null);
      setStatusMsg('Import terminé ! Vos cours sont prêts dans Atelier.');
      loadBooks();
    } catch (err) {
      setErrorMsg(toErrorMessage(err, 'Erreur lors de la génération.'));
      setPhase('idle');
    }
  };

  const handleDeleteBook = async (b: BookRow) => {
    if (!window.confirm(`Supprimer votre livre « ${b.title} » et ses leçons ?`)) return;
    await fetch(`/api/admin/books/${b.id}?deleteLessons=true`, { method: 'DELETE' }).catch(() => {});
    loadBooks();
  };

  return (
    <div style={{ padding: '20px 20px 26px' }}>
      <div style={{ fontFamily: FONT_SERIF, fontSize: 32, fontWeight: 300, lineHeight: 1.05, marginBottom: 8 }}>Bibliothèque</div>
      <div style={{ fontSize: 12, color: L.ink2, lineHeight: 1.65, marginBottom: 18 }}>
        Catalogue commun et ouvrages importés sur votre profil personnel.
      </div>

      {/* Import PDF personnel */}
      <button
        onClick={() => !busy && fileRef.current?.click()}
        style={{
          all: 'unset',
          boxSizing: 'border-box',
          cursor: busy ? 'default' : 'pointer',
          display: 'block',
          width: '100%',
          border: `1px dashed ${L.ink}`,
          background: L.paper2,
          padding: '20px 16px',
          textAlign: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ width: 12, height: 12, border: `2px solid ${EMBER}`, margin: '0 auto 10px' }} />
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          {file ? file.name : '+ Importer mon propre livre (PDF)'}
        </div>
        <div style={{ fontSize: 11, color: L.ink3 }}>
          {busy ? statusMsg || 'Traitement en cours…' : 'Génère un cursus isolé sur votre profil'}
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

      {errorMsg && (
        <div style={{ fontSize: 11, color: 'oklch(0.62 0.13 30)', marginBottom: 12 }}>{errorMsg}</div>
      )}
      {!busy && statusMsg && !errorMsg && (
        <div style={{ fontSize: 11, color: VERDANT, marginBottom: 12 }}>{statusMsg}</div>
      )}

      {phase === 'confirm' && analysis && (
        <div style={{ border: `1px solid ${EMBER}`, background: L.paper2, padding: 14, marginBottom: 18 }}>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 18, marginBottom: 4 }}>
            {analysis.detectedTitle || file?.name}
          </div>
          <div style={{ fontSize: 11, color: L.ink3, marginBottom: 10 }}>{analysis.detectedAuthor}</div>
          {analysis.topics.map((t, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                padding: '6px 0',
                borderTop: `1px solid ${L.rule}`,
                fontSize: 11,
              }}
            >
              <span>{t.name}</span>
              <span style={{ color: L.ink3, whiteSpace: 'nowrap' }}>
                {t.estimatedWeeks} sem · N{t.maxDifficultyLevel}
              </span>
            </div>
          ))}
          <button
            onClick={handleLaunch}
            style={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: 'pointer',
              display: 'block',
              width: '100%',
              marginTop: 12,
              textAlign: 'center',
              background: EMBER,
              color: L.paper,
              fontSize: 11,
              letterSpacing: '0.14em',
              padding: '13px 0',
            }}
          >
            LANCER LA GÉNÉRATION ({analysis.topics.length})
          </button>
        </div>
      )}

      {books === null ? (
        <>
          <MSkeleton h={80} />
          <MSkeleton h={80} />
          <MSkeleton h={80} />
        </>
      ) : books.length === 0 ? (
        <div style={{ border: `1px dashed ${L.ruleFaint}`, padding: '36px 20px', textAlign: 'center', color: L.ink3, fontSize: 12 }}>
          Aucun ouvrage pour le moment.
        </div>
      ) : (
        books.map((b) => {
          const indexed = b.lessonsCount > 0;
          return (
            <div key={b.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 0', borderBottom: `1px solid ${L.rule}` }}>
              <div style={{ width: 32, height: 58, background: 'oklch(0.90 0.012 78)', borderLeft: `3px solid ${b.isOwn ? VERDANT : EMBER}`, flex: '0 0 auto' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 19, fontStyle: 'italic', lineHeight: 1.2 }}>{b.title}</div>
                <div style={{ fontSize: 11, color: L.ink2, marginTop: 5 }}>{b.author}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: L.ink3 }}>
                    {b.topics?.[0] || b.domain || '—'} · {indexed ? `${b.lessonsCount} leçons` : 'à générer'}
                  </span>
                  <div style={{ flex: 1 }} />
                  {b.isOwn && (
                    <button
                      onClick={() => handleDeleteBook(b)}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        fontSize: 9,
                        letterSpacing: '0.10em',
                        padding: '3px 7px',
                        color: 'oklch(0.62 0.13 30)',
                        border: '1px solid oklch(0.62 0.13 30 / 0.4)',
                      }}
                    >
                      SUPPRIMER
                    </button>
                  )}
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      padding: '4px 8px',
                      whiteSpace: 'nowrap',
                      border: `1px solid ${indexed ? L.ruleFaint : EMBER}`,
                      color: indexed ? L.ink2 : EMBER,
                    }}
                  >
                    {indexed ? 'INDEXÉ' : 'EN COURS'}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
