import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// Mot de passe personnel des testeurs.
//
// À la première connexion, un testeur saisit son prénom + APP_PASSWORD (le code
// d'invitation partagé) et choisit son propre mot de passe. Ensuite, seul ce
// mot de passe ouvre son profil : connaître le code d'invitation et le prénom
// ne suffit plus pour entrer dans l'espace de quelqu'un d'autre.

export const MIN_PERSONAL_PASSWORD_LENGTH = 8;

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type TesterLoginDecision =
  | { kind: 'ok' }
  | { kind: 'set-password' }
  | { kind: 'needs-password'; status: 409; error: string }
  | { kind: 'error'; status: 400 | 401; error: string };

/**
 * Décide de l'issue d'une connexion testeur (non-admin).
 * - Profil déjà protégé : seul son mot de passe personnel est accepté.
 * - Profil pas encore protégé : il faut le code d'invitation, puis un nouveau
 *   mot de passe personnel (sinon on demande au client de le saisir).
 */
export function decideTesterLogin(params: {
  storedHash: string | null;
  password: string;
  newPassword?: string | null;
  isInviteCode: boolean;
}): TesterLoginDecision {
  const { storedHash, password, isInviteCode } = params;
  const newPassword = params.newPassword || '';

  if (storedHash) {
    return verifyPassword(password, storedHash)
      ? { kind: 'ok' }
      : { kind: 'error', status: 401, error: 'Mot de passe incorrect.' };
  }

  if (!isInviteCode) {
    return { kind: 'error', status: 401, error: "Code d'invitation incorrect." };
  }
  if (!newPassword) {
    return {
      kind: 'needs-password',
      status: 409,
      error: 'Première connexion : choisissez votre mot de passe personnel.',
    };
  }
  if (newPassword.length < MIN_PERSONAL_PASSWORD_LENGTH) {
    return {
      kind: 'error',
      status: 400,
      error: `Le mot de passe doit faire au moins ${MIN_PERSONAL_PASSWORD_LENGTH} caractères.`,
    };
  }
  if (newPassword === password) {
    return { kind: 'error', status: 400, error: "Le mot de passe doit être différent du code d'invitation." };
  }
  return { kind: 'set-password' };
}
