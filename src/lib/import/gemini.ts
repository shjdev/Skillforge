import { GoogleGenAI } from '@google/genai';

/** Modèle utilisé pour l'analyse, la génération et la transcription. Surchargeable par GEMINI_MODEL. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

/** Erreur de l'IA à montrer telle quelle à l'utilisateur. */
export class AiError extends Error {}

/** Clé à utiliser : celle de l'utilisateur si fournie, sinon celle du serveur. */
export function resolveApiKey(personalKey?: string | null): { apiKey: string | null; personal: boolean } {
  const personal = personalKey?.trim();
  if (personal) return { apiKey: personal, personal: true };
  return { apiKey: process.env.GEMINI_API_KEY || null, personal: false };
}

/**
 * Appelle Gemini en mode JSON et valide la réponse avec `parse`.
 * Réessaie une fois si la réponse n'est pas exploitable.
 */
export async function generateJson<T>(apiKey: string, prompt: string, parse: (raw: unknown) => T): Promise<T> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.4 },
      });
      const text = stripJsonFence(response.text || '');
      return parse(JSON.parse(text));
    } catch (err) {
      lastError = err;
      console.warn(`[ia] Tentative ${attempt} échouée :`, err instanceof Error ? err.message.slice(0, 500) : err);
      if (isAuthOrQuotaError(err)) break;
    }
  }
  throw new AiError(describeAiError(lastError));
}

export function stripJsonFence(text: string): string {
  return text.replace(/```json\s*|```/g, '').trim();
}

function isAuthOrQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /API key|PERMISSION_DENIED|RESOURCE_EXHAUSTED|quota|429|401|403/i.test(message);
}

/** Message lisible pour l'utilisateur à partir d'une erreur Gemini. */
export function describeAiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/API key not valid|API_KEY_INVALID|401/i.test(message)) return 'Clé Gemini invalide.';
  if (/RESOURCE_EXHAUSTED|quota|429/i.test(message)) return "Quota de l'IA dépassé pour le moment. Réessayez plus tard.";
  if (/PERMISSION_DENIED|403/i.test(message)) return "La clé Gemini n'a pas accès à ce modèle.";
  if (err instanceof SyntaxError) return "Réponse de l'IA illisible, réessayez.";
  if (err instanceof Error && err.name === 'ZodError') return "Réponse de l'IA incomplète, réessayez.";
  return "L'IA n'a pas pu traiter cette étape, réessayez.";
}
