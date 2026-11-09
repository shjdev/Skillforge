// Quota d'imports par utilisateur sur la clé IA du serveur. Fonctions pures (testées).

export const DEFAULT_DAILY_IMPORTS = 3;
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Limite quotidienne, surchargeable par IMPORT_DAILY_LIMIT. */
export function dailyImportLimit(raw = process.env.IMPORT_DAILY_LIMIT): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_IMPORTS;
}

export function quotaWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - QUOTA_WINDOW_MS);
}

export interface QuotaStatus {
  /** null = illimité (administrateur ou clé personnelle). */
  limit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
}

/**
 * `used` = imports lancés sur les dernières 24 h, échecs exclus (un import
 * raté ne doit pas coûter un essai). L'administrateur et l'utilisateur qui
 * fournit sa propre clé Gemini ne sont pas limités.
 */
export function quotaStatus(params: { used: number; isAdmin: boolean; personalKey: boolean; limit?: number }): QuotaStatus {
  if (params.isAdmin || params.personalKey) {
    return { limit: null, used: params.used, remaining: null, allowed: true };
  }
  const limit = params.limit ?? dailyImportLimit();
  const remaining = Math.max(0, limit - params.used);
  return { limit, used: params.used, remaining, allowed: remaining > 0 };
}
