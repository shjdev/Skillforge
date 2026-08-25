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

interface LogLine {
  t: string;
  text: string;
  kind: 'info' | 'success' | 'error';
}

export default function AdminLibraryPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<LogLine[]>([
    { t: '—', text: 'Aucun import en cours.', kind: 'info' },
    { t: '—', text: 'Déposez un PDF ou un fichier texte pour générer des leçons.', kind: 'info' },
    { t: '—', text: "Chaque leçon citera le chapitre et la page d'origine.", kind: 'info' },
  ]);

  useEffect(() => {
    fetch('/api/domains')
      .then((res) => res.json())
      .then((data) => {
        if (data.domains) {
          setDomains(data.domains);
          if (data.domains.length > 0) {
            setSelectedDomain(data.domains[0].id);
            if (data.domains[0].topics && data.domains[0].topics.length > 0) {
              setSelectedTopic(data.domains[0].topics[0].id);
            }
          }
        }
      });
  }, []);

  const stamp = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dId = e.target.value;
    setSelectedDomain(dId);
    const domainObj = domains.find((d) => d.id === dId);
    if (domainObj && domainObj.topics && domainObj.topics.length > 0) {
      setSelectedTopic(domainObj.topics[0].id);
    } else {
      setSelectedTopic('');
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  interface JobState {
    status: string;
    totalChunks: number;
    processedChunks: number;
    lessonsCreated: number;
    questionsCreated: number;
    message?: string | null;
    error?: string;
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedDomain || !selectedTopic) {
      setLog((l) => [...l, { t: stamp(), text: 'Titre, domaine et sujet sont requis.', kind: 'error' }]);
      return;
    }

    setLoading(true);
    setLog([
      { t: stamp(), text: file ? `Fichier reçu — ${file.name}` : 'Texte de référence reçu (sans fichier)', kind: 'info' },
      { t: stamp(), text: 'Envoi au service de génération…', kind: 'info' },
    ]);

    const formData = new FormData();
    if (file) formData.append('file', file);
    formData.append('title', title);
    formData.append('author', author || 'Auteur Inconnu');
    formData.append('domainId', selectedDomain);
    formData.append('topicId', selectedTopic);
    if (apiKey) formData.append('apiKey', apiKey);

    let done = false;
    try {
      const res = await fetch('/api/admin/ingest-pdf', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'ingestion");

      if (!data.jobId) {
        setLog((l) => [
          ...l,
          { t: stamp(), text: data.message || 'Livre ajouté à la bibliothèque.', kind: 'success' },
        ]);
      } else {
        setLog((l) => [
          ...l,
          { t: stamp(), text: `Tâche lancée — ${data.totalChunks} extrait(s) de livre à analyser.`, kind: 'info' },
        ]);
        let lastProcessed = -1;
        while (!done) {
          await sleep(3000);
          const jobRes = await fetch(`/api/admin/ingest-pdf?jobId=${data.jobId}`);
          const job: JobState = await jobRes.json();
          if (job.error) throw new Error(job.error);
          if (job.processedChunks !== lastProcessed) {
            lastProcessed = job.processedChunks;
            setLog((l) => [
              ...l,
              {
                t: stamp(),
                text:
                  job.status === 'DONE'
                    ? `Terminé : ${job.lessonsCreated} leçon(s) et ${job.questionsCreated} question(s) générées.${job.message ? ` ${job.message}` : ''}`
                    : job.status === 'ERROR'
                      ? job.message || 'La génération a échoué.'
                      : `Extrait ${job.processedChunks}/${job.totalChunks} traité · ${job.lessonsCreated} leçon(s)…`,
                kind: job.status === 'DONE' ? 'success' : job.status === 'ERROR' ? 'error' : 'info',
              },
            ]);
          }
          done = job.status === 'DONE' || job.status === 'ERROR';
        }
      }
      setFile(null);
      setTitle('');
      setAuthor('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du traitement.';
      setLog((l) => [...l, { t: stamp(), text: message, kind: 'error' }]);
      done = true;
    } finally {
      setLoading(false);
    }
  };

  const currentDomainObj = domains.find((d) => d.id === selectedDomain);
  const lastLine = log[log.length - 1];
  const status = loading ? 'GÉNÉRATION EN COURS' : lastLine?.kind === 'success' ? 'GÉNÉRATION TERMINÉE' : 'EN ATTENTE DE FICHIER';
  const statusColor = loading ? EMBER : lastLine?.kind === 'success' ? VERDANT : D.text4;

  const [books, setBooks] = useState<BookRow[]>([]);

  interface BookRow {
    id: string;
    title: string;
    author: string;
    addedAt: string;
    lessonsCount: number;
    topics: string[];
  }

  const refreshBooks = () => {
    fetch('/api/admin/books')
      .then((res) => res.json())
      .then((data) => {
        if (data.books) setBooks(data.books);
      });
  };

  useEffect(() => {
    refreshBooks();
  }, []);

  const handleDeleteBook = async (book: BookRow) => {
    const msg =
      book.lessonsCount > 0
        ? `Supprimer « ${book.title} » ainsi que ses ${book.lessonsCount} leçon(s) générées ?`
        : `Supprimer « ${book.title} » ?`;
    if (!window.confirm(msg)) return;
    try {
      await fetch(`/api/admin/books/${book.id}?deleteLessons=${book.lessonsCount > 0}`, { method: 'DELETE' });
      setLog((l) => [...l, { t: stamp(), text: `Livre supprimé — ${book.title}.`, kind: 'success' }]);
      refreshBooks();
    } catch {
      setLog((l) => [...l, { t: stamp(), text: 'Erreur lors de la suppression.', kind: 'error' }]);
    }
  };

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
          <span style={{ fontSize: 10, color: D.text3, letterSpacing: '0.1em' }}>PDF OU TEXTE</span>
        </div>
      </div>

      <form onSubmit={handleUpload} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 26, alignItems: 'start' }}>
        <div>
          <div style={{ position: 'relative', border: `1px dashed ${D.border3}`, background: D.panel2, padding: '44px 30px', textAlign: 'center', marginBottom: 20 }}>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                  if (!title) setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                }
              }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
            <div style={{ width: 16, height: 16, border: `2px solid ${EMBER}`, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 13, marginBottom: 7 }}>{file ? file.name : 'Déposer un livre de référence'}</div>
            <div style={{ fontSize: 11, color: D.text3 }}>Glisser un fichier ici, ou cliquer pour parcourir</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 22px', border: `1px solid ${D.border}`, padding: 20 }}>
            <div>
              <div style={labelStyle}>TITRE</div>
              <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Réseaux" />
            </div>
            <div>
              <div style={labelStyle}>AUTEUR</div>
              <input style={inputStyle} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Andrew S. Tanenbaum" />
            </div>
            <div>
              <div style={labelStyle}>DOMAINE CIBLE</div>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedDomain} onChange={handleDomainChange}>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={labelStyle}>THÈME CIBLE</div>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                {currentDomainObj?.topics?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>CLÉ D&rsquo;ACCÈS AU SERVICE IA (OPTIONNELLE)</div>
              <input
                style={inputStyle}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="laisser vide pour utiliser la clé du serveur"
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 18, marginTop: 4 }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  cursor: loading ? 'default' : 'pointer',
                  background: EMBER,
                  color: 'oklch(0.98 0.005 85)',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  padding: '13px 26px',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'GÉNÉRATION...' : 'LANCER LA GÉNÉRATION'}
              </button>
              <span style={{ fontSize: 10, color: D.text3, lineHeight: 1.6, maxWidth: '38ch' }}>
                Les leçons citent la source (page et chapitre) quand une clé IA est fournie.
              </span>
            </div>
          </div>
        </div>

        <div style={{ border: `1px solid ${D.border}`, background: D.panel2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: `1px solid ${D.border}` }}>
            <div style={{ width: 8, height: 8, background: statusColor }} />
            <span style={{ fontSize: 10, letterSpacing: '0.16em' }}>{status}</span>
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
      </form>

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
                all: 'unset',
                boxSizing: 'border-box',
                cursor: 'pointer',
                fontSize: 9,
                letterSpacing: '0.12em',
                color: 'oklch(0.62 0.13 30)',
                border: `1px solid oklch(0.62 0.13 30 / 0.4)`,
                padding: '6px 11px',
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
