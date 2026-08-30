import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkPassword, createSessionToken, isAuthEnabled, isValidSessionToken, SESSION_MAX_AGE_SECONDS } from './authGate';

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

describe('checkPassword', () => {
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
});

describe('createSessionToken / isValidSessionToken', () => {
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
