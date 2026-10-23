'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsMobile } from '@/hooks/useIsMobile';
import { L, EMBER, VERDANT } from '@/lib/theme';
import { uploadBookFile } from '@/lib/blobUpload';
import { parseJsonResponse, toErrorMessage } from '@/lib/errors';
import { runTopicStepIngestion } from '@/lib/ingestClient';
import type { DomainSummary } from '@/types/models';
import MobileLivres from '@/components/mobile/screens/Livres';

interface LibraryBook {
  id: string;
  title: string;
  author: string;
  domain: string;
  topics?: string[];
  lessonsCount: number;
  isOwn?: boolean;
}

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

type Phase = 'idle' | 'analyzing' | 'review' | 'launching';

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.14em',
  color: L.ink3,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  all: 'unset',
  boxSizing: 'border-box',
  width: '100%',
  fontSize: 12,
  color: L.ink,
  borderBottom: `1px solid ${L.rule3}`,
  paddingBottom: 6,
};

export default function LibraryPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileLivres />;
  return <LibraryDesktop />;
}

function LibraryDesktop() {
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

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
    { t: '—', text: 'Les cours générés seront isolés sur votre profil personnel.', kind: 'info' },
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async (): Promise<LibraryBook[]> => {
      const res = await fetch('/api/books');
      const json = await res.json();
      return json.books || [];
    },
  });

  useEffect(() => {
    fetch('/api/domains')
      .then((res) => res.json())
      .then((d) => {
        if (d.domains) setDomains(d.domains);
      })
      .catch(() => {});
  }, []);

  const stamp = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const addLog = (text: string, kind: LogLine['kind'] = 'info') =>
    setLog((l) => [...l, { t: stamp(), text, kind }]);

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
      let url = fileUrl;
      if (!url) {
        addLog('Téléversement du fichier…');
        url = await uploadBookFile(file);
        setFileUrl(url);
      }

      const fd = new FormData();
      fd.append('fileUrl', url);
      if (apiKey) fd.append('apiKey', apiKey);
      const res = await fetch('/api/admin/analyze-book', { method: 'POST', body: fd });
      const resData = await parseJsonResponse<{ analysis: BookAnalysis; totalChunks: number }>(
        res,
        "Échec de l'analyse"
      );
      const a: BookAnalysis = resData.analysis;

      if (!a.isTeachable) {
        addLog(`Document non enseignable : ${a.rejectionReason || 'contenu inadapté.'}`, 'error');
        setPhase('idle');
        return;
      }

      setAnalysis(a);
      setTotalChunks(resData.totalChunks || 0);
      setTitle(a.detectedTitle || title);
      setAuthor(a.detectedAuthor || '');
      setDomainChoice(a.domainId ? `existing:${a.domainId}` : a.newDomain ? 'new' : '');
      if (a.newDomain) setNewDomain(a.newDomain);
      setReviewTopics(a.topics.map((t) => ({ ...t, include: true })));
      setChainPrereqs(true);
      addLog(
        `Analyse terminée : ${a.topics.length} thème(s) détecté(s). Validez ci-dessous pour générer vos leçons.`,
        'success'
      );
      setPhase('review');
    } catch (err) {
      addLog(toErrorMessage(err, "Erreur lors de l'analyse."), 'error');
      setPhase('idle');
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
          .replace(/[\u0300-\u036f]/g, '')
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
            personal: true,
          }),
        });
        const created = await res.json();
        if (!res.ok || !created.id) {
          throw new Error(created.details?.[0]?.message || created.error || 'Échec de la création du domaine.');
        }
        domainId = created.id;
        addLog(`Nouveau domaine personnel créé : « ${created.name ?? newDomain.name.trim()} ».`, 'success');
      }

      let prevTopicId: string | null = null;
      const topicTargets: { id: string; name: string; topic: ReviewTopic }[] = [];
      for (const t of selected) {
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
            personal: true,
          }),
        });
        const created = (await res.json()) as { id?: string; error?: string; details?: { message?: string }[] };
        if (!res.ok || !created.id) {
          throw new Error(created.details?.[0]?.message || created.error || `Échec de la création du thème « ${t.name} ».`);
        }
        const newTopicId: string = created.id;
        topicTargets.push({ id: newTopicId, name: t.name, topic: t });
        prevTopicId = newTopicId;
        addLog(`Thème prêt : « ${t.name} » (${t.estimatedWeeks} sem.).`);
      }

      let sharedBookId: string | null = null;
      for (const target of topicTargets) {
        addLog(`Génération pas-à-pas — « ${target.name} » (extraits ${target.topic.chunkStart} à ${target.topic.chunkEnd})…`);
        const result = await runTopicStepIngestion({
          fileUrl,
          title: title.trim(),
          author: author.trim() || 'Auteur Inconnu',
          domainId,
          topicId: target.id,
          chunkStart: target.topic.chunkStart,
          chunkEnd: target.topic.chunkEnd,
          bookId: sharedBookId,
          personal: true,
          apiKey: apiKey || undefined,
          onProgress: ({ processedChunks, totalChunks: tot, lessonsCreated }) => {
            addLog(`« ${target.name} » · extrait ${processedChunks}/${tot} (${lessonsCreated} leçon(s) sauvegardée(s))…`);
          },
        });
        if (result.bookId) sharedBookId = result.bookId;
        if (result.status === 'ERROR') {
          addLog(`« ${target.name} » : échec — ${result.message || 'erreur de génération.'}`, 'error');
        } else {
          addLog(
            `« ${target.name} » terminé : ${result.lessonsCreated} leçon(s), ${result.questionsCreated} question(s).`,
            'success'
          );
        }
      }

      addLog('Import terminé ! Vos cours personnels sont disponibles dans Atelier du jour (/learn).', 'success');
      cleanupBlob(fileUrl);
      setPhase('idle');
      setFile(null);
      setFileUrl(null);
      setAnalysis(null);
      setReviewTopics([]);
      await queryClient.invalidateQueries({ queryKey: ['books'] });
    } catch (err) {
      addLog(toErrorMessage(err, 'Erreur lors de la génération.'), 'error');
      setPhase('idle');
    }
  };

  const handleDeleteBook = async (b: LibraryBook) => {
    const msg =
      b.lessonsCount > 0
        ? `Supprimer votre livre « ${b.title} » ainsi que ses ${b.lessonsCount} leçon(s) générées ?`
        : `Supprimer votre livre « ${b.title} » ?`;
    if (!window.confirm(msg)) return;
    try {
      await fetch(`/api/admin/books/${b.id}?deleteLessons=${b.lessonsCount > 0}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['books'] });
    } catch {
      // ignore
    }
  };

  const busy = phase === 'analyzing' || phase === 'launching';
  const updateTopic = (i: number, patch: Partial<ReviewTopic>) =>
    setReviewTopics((prev) => prev.map((t, ti) => (ti === i ? { ...t, ...patch } : t)));

  return (
    <div style={{ padding: '44px 52px 90px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-serif-display)', fontWeight: 300, fontSize: 42, lineHeight: 1.05 }}>
          Bibliothèque
        </h1>
        <button
          onClick={() => setShowImport((v) => !v)}
          style={{
            all: 'unset',
            boxSizing: 'border-box',
            cursor: 'pointer',
            background: showImport ? L.paper2 : L.ink,
            color: showImport ? L.ink : L.paper,
            border: `1px solid ${L.ink}`,
            fontSize: 10,
            letterSpacing: '0.16em',
            padding: '11px 18px',
          }}
        >
          {showImport ? 'FERMER L’IMPORT PDF' : '+ IMPORTER MON PROPRE LIVRE (PDF)'}
        </button>
      </div>
      <p style={{ margin: '0 0 34px', fontSize: 12, color: L.ink2, lineHeight: 1.7, maxWidth: '64ch' }}>
        Les ouvrages de référence du catalogue commun ainsi que les livres que vous avez importés sur votre profil.
      </p>

      {showImport && (
        <div
          style={{
            border: `1px solid ${L.ink}`,
            background: L.paper2,
            padding: 28,
            marginBottom: 40,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))',
            gap: 26,
            alignItems: 'start',
          }}
        >
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', color: EMBER, marginBottom: 14 }}>
              IMPORT PERSONNEL ASSISTÉ PAR IA (PDF NUMÉRIQUE OU SCANNÉ)
            </div>
            <div
              style={{
                position: 'relative',
                border: `1px dashed ${L.rule3}`,
                background: L.paper,
                padding: '32px 24px',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
                disabled={busy}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: busy ? 'default' : 'pointer' }}
              />
              <div style={{ width: 14, height: 14, border: `2px solid ${EMBER}`, margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13, marginBottom: 6 }}>{file ? file.name : 'Choisir ou déposer un fichier PDF'}</div>
              <div style={{ fontSize: 11, color: L.ink3 }}>
                Analyse automatique du sujet, découpage en thèmes et génération pas-à-pas
              </div>
            </div>

            {phase === 'idle' && (
              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>CLÉ GEMINI OPTIONNELLE</div>
                <input
                  style={inputStyle}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Laisser vide pour utiliser la clé du serveur"
                />
              </div>
            )}

            {phase === 'idle' && file && (
              <button
                onClick={handleAnalyze}
                style={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  display: 'block',
                  width: '100%',
                  background: EMBER,
                  color: L.paper,
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  padding: '14px 20px',
                  textAlign: 'center',
                }}
              >
                ANALYSER LE DOCUMENT
              </button>
            )}

            {phase === 'review' && analysis && (
              <div style={{ border: `1px solid ${EMBER}`, background: L.paper, padding: 18 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.16em', color: EMBER, marginBottom: 12 }}>
                  PROPOSITION DE CURSUS — À VALIDER
                </div>
                {analysis.summary && (
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: L.ink2, marginBottom: 14, fontStyle: 'italic' }}>
                    {analysis.summary}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <div style={labelStyle}>TITRE</div>
                    <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <div style={labelStyle}>AUTEUR</div>
                    <input style={inputStyle} value={author} onChange={(e) => setAuthor(e.target.value)} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={labelStyle}>DOMAINE</div>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={domainChoice}
                    onChange={(e) => setDomainChoice(e.target.value)}
                  >
                    {analysis.newDomain && <option value="new">+ Créer le domaine : {analysis.newDomain.name}</option>}
                    {domains.map((d) => (
                      <option key={d.id} value={`existing:${d.id}`}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {domainChoice === 'new' && analysis.newDomain && (
                  <div style={{ border: `1px solid ${L.rule}`, padding: 12, marginBottom: 14 }}>
                    <div style={labelStyle}>NOM DU NOUVEAU DOMAINE</div>
                    <input
                      style={{ ...inputStyle, marginBottom: 10 }}
                      value={newDomain.name}
                      onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })}
                    />
                    <div style={labelStyle}>DESCRIPTION</div>
                    <input
                      style={inputStyle}
                      value={newDomain.description}
                      onChange={(e) => setNewDomain({ ...newDomain, description: e.target.value })}
                    />
                  </div>
                )}

                <div style={labelStyle}>THÈMES PROPOSÉS ({totalChunks} extraits)</div>
                {reviewTopics.map((t, i) => (
                  <div
                    key={`${t.slug}-${i}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px 1fr 56px 56px',
                      gap: 8,
                      alignItems: 'center',
                      padding: '8px 0',
                      borderTop: `1px solid ${L.rule}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={t.include}
                      onChange={(e) => updateTopic(i, { include: e.target.checked })}
                      style={{ accentColor: EMBER }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <input
                        style={{ ...inputStyle, fontSize: 12 }}
                        value={t.name}
                        onChange={(e) => updateTopic(i, { name: e.target.value })}
                      />
                      <div style={{ fontSize: 9, color: L.ink3, marginTop: 3 }}>
                        extraits {t.chunkStart}–{t.chunkEnd} · {t.description}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={t.estimatedWeeks}
                      onChange={(e) => updateTopic(i, { estimatedWeeks: Math.max(1, parseInt(e.target.value) || 1) })}
                      style={{ ...inputStyle, textAlign: 'center' }}
                      title="Semaines"
                    />
                    <select
                      value={t.maxDifficultyLevel}
                      onChange={(e) => updateTopic(i, { maxDifficultyLevel: parseInt(e.target.value) })}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      title="Difficulté"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          N{n}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={chainPrereqs}
                    onChange={(e) => setChainPrereqs(e.target.checked)}
                    style={{ accentColor: EMBER }}
                  />
                  <span style={{ fontSize: 10, color: L.ink2 }}>Enchaîner les thèmes dans l&apos;ordre du livre</span>
                </label>

                <button
                  onClick={handleLaunch}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    display: 'block',
                    width: '100%',
                    marginTop: 16,
                    background: EMBER,
                    color: L.paper,
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    padding: '14px 20px',
                    textAlign: 'center',
                  }}
                >
                  LANCER LA GÉNÉRATION ({reviewTopics.filter((t) => t.include).length} THÈME
                  {reviewTopics.filter((t) => t.include).length > 1 ? 'S' : ''})
                </button>
              </div>
            )}
          </div>

          <div style={{ border: `1px solid ${L.rule}`, background: L.paper }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${L.rule}` }}>
              <div style={{ width: 8, height: 8, background: busy ? EMBER : VERDANT }} />
              <span style={{ fontSize: 10, letterSpacing: '0.16em' }}>
                {phase === 'analyzing'
                  ? 'ANALYSE DU DOCUMENT…'
                  : phase === 'launching'
                    ? 'GÉNÉRATION PAS-À-PAS EN COURS…'
                    : phase === 'review'
                      ? 'EN ATTENTE DE VALIDATION'
                      : 'JOURNAL D’IMPORT'}
              </span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 220, maxHeight: 360, overflowY: 'auto' }}>
              {log.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 9, color: L.ink3, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{l.t}</span>
                  <span
                    style={{
                      fontSize: 11,
                      lineHeight: 1.55,
                      color: l.kind === 'success' ? VERDANT : l.kind === 'error' ? 'oklch(0.62 0.13 30)' : L.ink,
                    }}
                  >
                    {l.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ color: L.ink3, fontSize: 12 }}>Chargement…</div>
      ) : !data || data.length === 0 ? (
        <div style={{ border: `1px dashed ${L.rule3}`, padding: 40, textAlign: 'center', color: L.ink3, fontSize: 12 }}>
          Aucun ouvrage indexé pour le moment. Utilisez « + IMPORTER MON PROPRE LIVRE (PDF) » ci-dessus pour ajouter le vôtre.
        </div>
      ) : (
        data.map((b) => (
          <div
            key={b.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px minmax(160px,1fr) minmax(104px,150px) minmax(74px,96px) auto',
              gap: 16,
              alignItems: 'center',
              padding: '20px 0',
              borderTop: `1px solid ${L.rule}`,
            }}
          >
            <div style={{ height: 64, background: L.ruleFaint3, borderLeft: `3px solid ${b.isOwn ? VERDANT : EMBER}` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-serif-display)', fontSize: 20, fontStyle: 'italic' }}>{b.title}</span>
                {b.isOwn && (
                  <span style={{ fontSize: 9, letterSpacing: '0.12em', padding: '2px 6px', border: `1px solid ${VERDANT}`, color: VERDANT }}>
                    MON IMPORT
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: L.ink2, marginTop: 4 }}>{b.author}</div>
            </div>
            <div style={{ fontSize: 11, color: L.ink2, minWidth: 0 }}>{b.domain}</div>
            <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
              {b.lessonsCount} leçon{b.lessonsCount > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  padding: '5px 9px',
                  whiteSpace: 'nowrap',
                  border: `1px solid ${b.lessonsCount > 0 ? L.rule3 : EMBER}`,
                  color: b.lessonsCount > 0 ? L.ink2 : EMBER,
                }}
              >
                {b.lessonsCount > 0 ? 'INDEXÉ' : 'SANS LEÇON'}
              </div>
              {b.isOwn && (
                <button
                  onClick={() => handleDeleteBook(b)}
                  style={{
                    all: 'unset',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    padding: '5px 9px',
                    color: 'oklch(0.62 0.13 30)',
                    border: '1px solid oklch(0.62 0.13 30 / 0.4)',
                  }}
                >
                  SUPPRIMER
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
