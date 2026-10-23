import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkAdminPassword,
  checkPassword,
  createSessionToken,
  isAuthEnabled,
  isValidSessionToken,
  normalizeProfileId,
  parseSessionToken,
  resolveLoginProfile,
  SESSION_MAX_AGE_SECONDS,
} from './authGate';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isAuthEnabled', () => {
  it('is false when APP_PASSWORD is unset', () => {
    delete process.env.APP_PASSWORD;
    expect(isAuthEnabled()).toBe(false);
  });

  it('is true when APP_PASSWORD is set', () => {
    process.env.APP_PASSWORD = 'hunter2';
    expect(isAuthEnabled()).toBe(true);
  });
});

describe('checkPassword & checkAdminPassword', () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = 'correct-horse-battery-staple';
  });

  it('accepts the exact password', () => {
    expect(checkPassword('correct-horse-battery-staple')).toBe(true);
  });

  it('rejects a wrong password', () => {
    expect(checkPassword('wrong')).toBe(false);
  });

  it('rejects when APP_PASSWORD is unset', () => {
    delete process.env.APP_PASSWORD;
    expect(checkPassword('anything')).toBe(false);
  });

  it('rejects an empty candidate', () => {
    expect(checkPassword('')).toBe(false);
  });

  it('distinguishes ADMIN_PASSWORD from APP_PASSWORD when ADMIN_PASSWORD is set', () => {
    process.env.ADMIN_PASSWORD = 'super-secret-admin';
    expect(checkPassword('correct-horse-battery-staple')).toBe(true);
    expect(checkPassword('super-secret-admin')).toBe(true);
    expect(checkAdminPassword('correct-horse-battery-staple')).toBe(false);
    expect(checkAdminPassword('super-secret-admin')).toBe(true);
  });
});

describe('normalizeProfileId', () => {
  it('returns default-user for empty or default names', () => {
    expect(normalizeProfileId('')).toBe('default-user');
    expect(normalizeProfileId('   ')).toBe('default-user');
    expect(normalizeProfileId(null)).toBe('default-user');
    expect(normalizeProfileId('Apprenant')).toBe('default-user');
  });

  it('normalizes friend names into deterministic user-<slug> IDs', () => {
    expect(normalizeProfileId('Lucas')).toBe('user-lucas');
    expect(normalizeProfileId('  Éléonore Martin  ')).toBe('user-eleonore-martin');
  });
});

describe('createSessionToken / isValidSessionToken / parseSessionToken', () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = 'correct-horse-battery-staple';
    process.env.AUTH_SECRET = 'a-separate-signing-secret';
  });

  it('returns null when auth is not configured', () => {
    delete process.env.APP_PASSWORD;
    delete process.env.AUTH_SECRET;
    expect(createSessionToken()).toBeNull();
  });

  it('round-trips: a freshly created token is valid', () => {
    const token = createSessionToken();
    expect(isValidSessionToken(token)).toBe(true);
  });

  it('preserves userId and isAdmin in session token metadata', () => {
    const token = createSessionToken(Date.now(), { userId: 'user-lucas', isAdmin: false });
    const parsed = parseSessionToken(token);
    expect(parsed.valid).toBe(true);
    expect(parsed.userId).toBe('user-lucas');
    expect(parsed.isAdmin).toBe(false);
  });

  it('rejects a missing or malformed token', () => {
    expect(isValidSessionToken(null)).toBe(false);
    expect(isValidSessionToken(undefined)).toBe(false);
    expect(isValidSessionToken('not-a-real-token')).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const token = createSessionToken()!;
    const [payload] = token.split('.');
    expect(isValidSessionToken(`${payload}.deadbeef`)).toBe(false);
  });

  it('rejects an expired token', () => {
    const now = Date.now();
    const token = createSessionToken(now)!;
    const justAfterExpiry = now + SESSION_MAX_AGE_SECONDS * 1000 + 1;
    expect(isValidSessionToken(token, justAfterExpiry)).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken()!;
    process.env.AUTH_SECRET = 'a-different-secret';
    expect(isValidSessionToken(token)).toBe(false);
  });

  it('falls back to APP_PASSWORD as the signing secret when AUTH_SECRET is unset', () => {
    delete process.env.AUTH_SECRET;
    const token = createSessionToken();
    expect(isValidSessionToken(token)).toBe(true);
  });
});

describe('resolveLoginProfile', () => {
  it('refuses an empty name for a non-admin tester', () => {
    const result = resolveLoginProfile('', false);
    expect(result.ok).toBe(false);
    expect(resolveLoginProfile('   ', false).ok).toBe(false);
    expect(resolveLoginProfile(null, false).ok).toBe(false);
  });

  it("refuses a non-admin name that maps to the owner's profile", () => {
    expect(resolveLoginProfile('Apprenant', false).ok).toBe(false);
    expect(resolveLoginProfile('default-user', false).ok).toBe(false);
    expect(resolveLoginProfile('Apprenant SkillForge', false).ok).toBe(false);
  });

  it('opens a personal profile for a named tester', () => {
    expect(resolveLoginProfile('Lucas', false)).toEqual({ ok: true, userId: 'user-lucas' });
  });

  it("lets the admin open the owner's profile with an empty name", () => {
    expect(resolveLoginProfile('', true)).toEqual({ ok: true, userId: 'default-user' });
  });
});
