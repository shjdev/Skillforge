import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI } from '@google/genai';
import { chunkText, extractPdfText, slugify, PLAN_OVERVIEW_CHARS } from '@/lib/ingestion';

const ANALYSIS_MODEL = 'gemini-3.6-flash';

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

function analysisPrompt(
  chunks: { content: string; index: number }[],
  domains: { id: string; name: string; description: string }[]
): string {
  const overview = chunks
    .map((c) => `--- Extrait ${c.index}/${chunks.length} ---\n${c.content.slice(0, PLAN_OVERVIEW_CHARS)}${c.content.length > PLAN_OVERVIEW_CHARS ? '…' : ''}`)
    .join('\n\n');

  const domainList = domains
    .map((d) => `- id="${d.id}" · ${d.name} — ${d.description.slice(0, 120)}`)
    .join('\n');

  return `Tu es un bibliothécaire pédagogique spécialisé en ingénierie informatique. Analyse ce document (aperçu de ${chunks.length} extraits successifs) :

${overview}

CATALOGUE DES DOMAINES EXISTANTS :
${domainList || '(aucun domaine existant)'}

Ta mission :
1. Détecter le TITRE et l'AUTEUR du document (page de titre, en-têtes, style). Si introuvables, déduis-les du contenu.
2. Résumer le document en 2 phrases.
3. Décider si c'est un CONTENU ENSEIGNABLE (livre technique, manuel, documentation approfondie). Un roman, une facture, un CV ou des notes éparses ne le sont pas → isTeachable=false + raison.
4. Rattacher le document à UN domaine du catalogue si pertinent (domainId), sinon propose un NOUVEAU domaine (newDomain avec nom court, description d'une phrase, couleur hex sobre type #3b82f6).
5. Découper le contenu en 1 à 4 THÈMES pédagogiques progressifs. Chaque thème :
   - couvre une plage d'extraits contiguë ("chunkStart"/"chunkEnd", bornes incluses, dans l'ordre du livre, sans chevauchement, couvrant idéalement tous les extraits utiles)
   - a un nom concis, un slug kebab-case unique, une description d'une phrase
   - a estimatedWeeks = nombre d'extraits couverts / 7, arrondi au supérieur, minimum 1
   - a maxDifficultyLevel entre 1 et 5 reflétant le niveau final atteint
   Les thèmes doivent s'enchaîner logiquement (l'ordre du tableau = l'ordre pédagogique).

Réponds STRICTEMENT en JSON valide :
{
  "isTeachable": true,
  "rejectionReason": "",
  "detectedTitle": "...",
  "detectedAuthor": "...",
  "summary": "...",
  "domainId": "id-existant-ou-null",
  "newDomain": null,
  "topics": [
    { "name": "...", "slug": "slug-kebab-case", "description": "...", "estimatedWeeks": 2, "maxDifficultyLevel": 3, "chunkStart": 1, "chunkEnd": 5 }
  ]
}
Si domainId est non null, newDomain doit être null (et inversement, exactement l'un des deux doit être renseigné).`;
}

function parseAnalysis(responseText: string, totalChunks: number): BookAnalysis {
  const clean = responseText.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(clean);

  const topicsRaw: unknown[] = Array.isArray(parsed.topics) ? parsed.topics : [];
  const topics: AnalysisTopic[] = [];
  for (const raw of topicsRaw) {
    const t = raw as Partial<AnalysisTopic> | null;
    if (!t || typeof t.name !== 'string' || !t.name.trim()) continue;
    let start = Math.max(1, Math.round(Number(t.chunkStart)) || 1);
    let end = Math.min(totalChunks, Math.round(Number(t.chunkEnd)) || start);
    if (end < start) [start, end] = [end, start];
    const span = end - start + 1;
    topics.push({
      name: t.name.trim(),
      slug: typeof t.slug === 'string' && t.slug.trim() ? slugify(t.slug) : slugify(t.name),
      description: typeof t.description === 'string' ? t.description : '',
      estimatedWeeks: Math.max(1, Math.round(Number(t.estimatedWeeks)) || Math.max(1, Math.ceil(span / 7))),
      maxDifficultyLevel: Math.max(1, Math.min(5, Math.round(Number(t.maxDifficultyLevel)) || 3)),
      chunkStart: start,
      chunkEnd: end,
    });
  }

  return {
    isTeachable: parsed.isTeachable !== false && topics.length > 0,
    rejectionReason: typeof parsed.rejectionReason === 'string' ? parsed.rejectionReason : '',
    detectedTitle: typeof parsed.detectedTitle === 'string' ? parsed.detectedTitle : '',
    detectedAuthor: typeof parsed.detectedAuthor === 'string' ? parsed.detectedAuthor : '',
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    domainId: typeof parsed.domainId === 'string' && parsed.domainId ? parsed.domainId : null,
    newDomain:
      parsed.newDomain && typeof parsed.newDomain === 'object'
        ? {
            name: String(parsed.newDomain.name || '').trim(),
            description: String(parsed.newDomain.description || '').trim(),
            color: /^#[0-9A-Fa-f]{6}$/.test(String(parsed.newDomain.color)) ? String(parsed.newDomain.color) : '#3b82f6',
          }
        : null,
    topics,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const apiKey = (formData.get('apiKey') as string) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Une clé API Gemini est nécessaire pour l'analyse (champ ou GEMINI_API_KEY serveur)." },
        { status: 400 },
      );
    }

    let text = '';
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await extractPdfText(buffer);
      if (!text.trim()) {
        return NextResponse.json(
          { error: "Aucun texte exploitable n'a pu être extrait de ce fichier (PDF scanné ou corrompu ?)." },
          { status: 422 },
        );
      }
    } else {
      text = (formData.get('rawText') as string) || '';
      if (!text.trim()) {
        return NextResponse.json({ error: 'Fournissez un fichier ou un texte brut.' }, { status: 400 });
      }
    }

    const chunks = chunkText(text, 15);

    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, description: true },
    });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: analysisPrompt(chunks, domains),
    });

    const analysis = parseAnalysis(response.text || '', chunks.length);
    return NextResponse.json({ analysis, totalChunks: chunks.length });
  } catch (error) {
    console.error('Error analyzing book:', error);
    return NextResponse.json({ error: "Échec de l'analyse du document." }, { status: 500 });
  }
}
