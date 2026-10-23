import { createHmac, timingSafeEqual } from 'crypto';
import { DEFAULT_USER_ID } from './learning';

// Lightweight single-password gate + multi-profile support for public deployments.
// Testers can log in with their first name + APP_PASSWORD to get an isolated
// learner profile (and import their own books in /library), while ADMIN_PASSWORD
// (if set) restricts /admin to the owner.

export const AUTH_COOKIE_NAME = 'sf-auth';
export const USER_COOKIE_NAME = 'sf-user';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || process.env.ADMIN_PASSWORD || null;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function isAuthEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

export function isAdminPasswordEnabled(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

function safeEqual(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr);
  const b = Buffer.from(bStr);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Constant-time comparison against APP_PASSWORD (or ADMIN_PASSWORD if it matches). */
export function checkPassword(candidate: string): boolean {
  if (!candidate) return false;
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  if (safeEqual(candidate, expected)) return true;
  if (process.env.ADMIN_PASSWORD && safeEqual(candidate, process.env.ADMIN_PASSWORD)) return true;
  return false;
}

/** Constant-time comparison against ADMIN_PASSWORD (falls back to APP_PASSWORD if ADMIN_PASSWORD is not set). */
export function checkAdminPassword(candidate: string): boolean {
  if (!candidate) return false;
  const adminExpected = process.env.ADMIN_PASSWORD || process.env.APP_PASSWORD;
  if (!adminExpected) return false;
  return safeEqual(candidate, adminExpected);
}

/**
 * Normalizes a display name / nickname into a deterministic UserProfile ID.
 * Empty or default names map to DEFAULT_USER_ID ('default-user') so the main
 * owner profile is preserved seamlessly.
 */
export function normalizeProfileId(rawName?: string | null): string {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return DEFAULT_USER_ID;
  const slug = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
  if (!slug || slug === 'default-user' || slug === 'apprenant' || slug === 'apprenant-skillforge') {
    return DEFAULT_USER_ID;
  }
  return `user-${slug}`;
}

export type LoginProfileResult = { ok: true; userId: string } | { ok: false; error: string };

/**
 * Choisit le profil ouvert à la connexion. Le profil principal (DEFAULT_USER_ID)
 * est réservé à l'admin : un testeur qui laisse le nom vide ou tape un nom qui
 * s'y ramène ("Apprenant", "default-user"…) est refusé au lieu d'atterrir sur
 * les données du propriétaire. Sans ADMIN_PASSWORD, tout le monde est admin et
 * ce contrôle ne change rien.
 */
export function resolveLoginProfile(rawName: string | null | undefined, isAdmin: boolean): LoginProfileResult {
  const userId = normalizeProfileId(rawName);
  if (userId === DEFAULT_USER_ID && !isAdmin) {
    const isEmpty = !(rawName || '').trim();
    return {
      ok: false,
      error: isEmpty
        ? 'Indiquez votre prénom pour accéder à votre espace.'
        : 'Ce nom est réservé, choisissez-en un autre.',
    };
  }
  return { ok: true, userId };
}

export interface SessionMeta {
  userId?: string;
  isAdmin?: boolean;
}

/**
 * Signed, stateless session token:
 * - Legacy / default: "<expiresAtMs>.<hmac>"
 * - With profile/role: "<expiresAtMs>:<userId>:<1|0>.<hmac>"
 */
export function createSessionToken(now: number = Date.now(), meta?: SessionMeta): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = meta
    ? `${expiresAt}:${meta.userId || DEFAULT_USER_ID}:${meta.isAdmin ? '1' : '0'}`
    : String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

export function parseSessionToken(
  token: string | undefined | null,
  now: number = Date.now()
): { valid: boolean; userId: string; isAdmin: boolean } {
  const invalid = { valid: false, userId: DEFAULT_USER_ID, isAdmin: false };
  const secret = getSecret();
  if (!secret || !token) return invalid;
  const dot = token.indexOf('.');
  if (dot < 0) return invalid;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!payload || !signature) return invalid;

  const expected = sign(payload, secret);
  if (!safeEqual(expected, signature)) return invalid;

  const parts = payload.split(':');
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || now >= expiresAt) return invalid;

  const userId = parts[1] ? parts[1] : DEFAULT_USER_ID;
  const isAdmin = parts[2] !== undefined ? parts[2] === '1' : !isAdminPasswordEnabled();
  return { valid: true, userId, isAdmin };
}

export function isValidSessionToken(token: string | undefined | null, now: number = Date.now()): boolean {
  return parseSessionToken(token, now).valid;
}
