import { describe, it, expect } from 'vitest';
import { decideTesterLogin, hashPassword, verifyPassword } from './personalPassword';

describe('hashPassword / verifyPassword', () => {
  it('verifies the right password and rejects a wrong one', () => {
    const stored = hashPassword('motdepasse-lucas');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('motdepasse-lucas', stored)).toBe(true);
    expect(verifyPassword('autre-chose', stored)).toBe(false);
  });

  it('salts each hash so the same password gives different hashes', () => {
    expect(hashPassword('identique1')).not.toBe(hashPassword('identique1'));
  });

  it('rejects a malformed stored value', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', 'bcrypt$aa$bb')).toBe(false);
  });
});

describe('decideTesterLogin', () => {
  const stored = hashPassword('perso-lucas-123');

  it('accepts the personal password of a protected profile', () => {
    expect(
      decideTesterLogin({ storedHash: stored, password: 'perso-lucas-123', isInviteCode: false }),
    ).toEqual({ kind: 'ok' });
  });

  it('refuses the shared invite code once the profile is protected', () => {
    const result = decideTesterLogin({ storedHash: stored, password: 'code-invitation', isInviteCode: true });
    expect(result.kind).toBe('error');
  });

  it('refuses a wrong code on an unprotected profile', () => {
    const result = decideTesterLogin({ storedHash: null, password: 'mauvais', isInviteCode: false });
    expect(result).toMatchObject({ kind: 'error', status: 401 });
  });

  it('asks for a personal password on first login with the invite code', () => {
    const result = decideTesterLogin({ storedHash: null, password: 'code-invitation', isInviteCode: true });
    expect(result).toMatchObject({ kind: 'needs-password', status: 409 });
  });

  it('refuses a personal password that is too short or equal to the invite code', () => {
    expect(
      decideTesterLogin({ storedHash: null, password: 'code-invitation', newPassword: 'court', isInviteCode: true }),
    ).toMatchObject({ kind: 'error', status: 400 });
    expect(
      decideTesterLogin({
        storedHash: null,
        password: 'code-invitation',
        newPassword: 'code-invitation',
        isInviteCode: true,
      }),
    ).toMatchObject({ kind: 'error', status: 400 });
  });

  it('sets the personal password on first login when everything is valid', () => {
    expect(
      decideTesterLogin({
        storedHash: null,
        password: 'code-invitation',
        newPassword: 'mon-mot-de-passe',
        isInviteCode: true,
      }),
    ).toEqual({ kind: 'set-password' });
  });
});
