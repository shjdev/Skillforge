import { GoogleGenAI } from '@google/genai';

/** Modèle utilisé pour l'analyse, la génération et la transcription. Surchargeable par GEMINI_MODEL. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
/** Modèle de secours quand le principal est surchargé. Surchargeable par GEMINI_FALLBACK_MODEL. */
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';

/**
 * Erreur de l'IA à montrer telle quelle à l'utilisateur. `transient` = panne
 * passagère (modèle surchargé, coupure réseau) : réessayer plus tard suffit,
 * ce n'est pas la faute du contenu.
 */
export class AiError extends Error {
  constructor(
    message: string,
    readonly transient = false,
  ) {
    super(message);
  }
}

/** Clé à utiliser : celle de l'utilisateur si fournie, sinon celle du serveur. */
export function resolveApiKey(personalKey?: string | null): { apiKey: string | null; personal: boolean } {
  const personal = personalKey?.trim();
  if (personal) return { apiKey: personal, personal: true };
  return { apiKey: process.env.GEMINI_API_KEY || null, personal: false };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Appelle Gemini en mode JSON et valide la réponse avec `parse`.
 * - réponse illisible ou incomplète : un nouvel essai ;
 * - modèle surchargé : nouvel essai après une pause, puis modèle de secours ;
 * - clé invalide ou quota : arrêt immédiat.
 */
export async function generateJson<T>(apiKey: string, prompt: string, parse: (raw: unknown) => T): Promise<T> {
  const ai = new GoogleGenAI({ apiKey });
  const plan = [
    { model: GEMINI_MODEL, waitBefore: 0 },
    { model: GEMINI_MODEL, waitBefore: 3_000 },
    { model: GEMINI_FALLBACK_MODEL, waitBefore: 2_000 },
  ];
  let lastError: unknown;
  let badOutputs = 0;

  for (const [i, { model, waitBefore }] of plan.entries()) {
    // Le modèle de secours ne sert que si le principal est surchargé.
    if (model !== GEMINI_MODEL && !isTransientError(lastError)) break;
    if (i > 0 && isTransientError(lastError)) await sleep(waitBefore);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.4 },
      });
      return parse(JSON.parse(stripJsonFence(response.text || '')));
    } catch (err) {
      lastError = err;
      console.warn(`[ia] ${model}, tentative ${i + 1} échouée :`, err instanceof Error ? err.message.slice(0, 300) : err);
      if (isAuthOrQuotaError(err)) break;
      if (!isTransientError(err) && ++badOutputs >= 2) break;
    }
  }
  throw new AiError(describeAiError(lastError), isTransientError(lastError));
}

export function stripJsonFence(text: string): string {
  return text.replace(/```json\s*|```/g, '').trim();
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err ?? ''));

function isAuthOrQuotaError(err: unknown): boolean {
  return /API key|PERMISSION_DENIED|RESOURCE_EXHAUSTED|quota|"code":\s*(401|403|429)/i.test(messageOf(err));
}

/** Panne passagère côté IA ou réseau : le même appel peut réussir plus tard. */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  return /UNAVAILABLE|high demand|overloaded|"code":\s*(500|502|503|504)|INTERNAL|DEADLINE_EXCEEDED|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(
    messageOf(err),
  );
}

/** Message lisible pour l'utilisateur à partir d'une erreur Gemini. */
export function describeAiError(err: unknown): string {
  const message = messageOf(err);
  if (/API key not valid|API_KEY_INVALID|"code":\s*401/i.test(message)) return 'Clé Gemini invalide.';
  if (/RESOURCE_EXHAUSTED|quota|"code":\s*429/i.test(message)) return "Quota de l'IA dépassé pour le moment. Réessayez plus tard.";
  if (/PERMISSION_DENIED|"code":\s*403/i.test(message)) return "La clé Gemini n'a pas accès à ce modèle.";
  if (isTransientError(err)) return "L'IA est très sollicitée en ce moment. Nouvel essai dans un instant.";
  if (err instanceof SyntaxError) return "Réponse de l'IA illisible, réessayez.";
  if (err instanceof Error && err.name === 'ZodError') return "Réponse de l'IA incomplète, réessayez.";
  return "L'IA n'a pas pu traiter cette étape, réessayez.";
}
