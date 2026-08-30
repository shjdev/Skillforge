import { createHmac, timingSafeEqual } from 'crypto';

// Lightweight single-password gate for public deployments — this app has no
// user accounts (DEFAULT_USER_ID is a hardcoded singleton), so anyone who can
// reach the deployed URL can otherwise read/write everything, including the
// admin panel's PDF ingestion (which spends GEMINI_API_KEY quota). Setting
// APP_PASSWORD turns the gate on; leaving it unset keeps local dev frictionless.

export const AUTH_COOKIE_NAME = 'sf-auth';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.APP_PASSWORD || null;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function isAuthEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

/** Constant-time comparison against APP_PASSWORD. */
export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Signed, stateless session token: "<expiresAtMs>.<hmac>". */
export function createSessionToken(now: number = Date.now()): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

export function isValidSessionToken(token: string | undefined | null, now: number = Date.now()): boolean {
  const secret = getSecret();
  if (!secret || !token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!payload || !signature) return false;

  const expected = sign(payload, secret);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && now < expiresAt;
}
