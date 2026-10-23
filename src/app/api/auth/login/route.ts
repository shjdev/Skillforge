import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  AUTH_COOKIE_NAME,
  USER_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  checkAdminPassword,
  checkPassword,
  createSessionToken,
  isAdminPasswordEnabled,
  isAuthEnabled,
  normalizeProfileId,
  resolveLoginProfile,
} from '@/lib/authGate';
import { decideTesterLogin, hashPassword } from '@/lib/personalPassword';
import { ensureUserProfile, getSessionContext } from '@/lib/serverAuth';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE_SECONDS,
  path: '/',
};

export async function GET() {
  const ctx = await getSessionContext();
  return NextResponse.json({
    authEnabled: isAuthEnabled(),
    adminPasswordEnabled: isAdminPasswordEnabled(),
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
  });
}

/** Crée le profil s'il n'existe pas ; renvoie une réponse d'erreur si la base échoue. */
async function ensureProfileOrError(userId: string, rawName: string): Promise<NextResponse | null> {
  try {
    await ensureUserProfile(userId, rawName || undefined);
    return null;
  } catch (error) {
    console.error('Error creating user profile at login:', error);
    return NextResponse.json(
      { error: 'Impossible de créer votre profil pour le moment. Réessayez dans un instant.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawName = typeof body?.name === 'string' ? body.name.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  // En développement local sans APP_PASSWORD : permet quand même de changer de
  // profil apprenant via le cookie `sf-user`.
  if (!isAuthEnabled()) {
    const userId = normalizeProfileId(rawName);
    const failure = await ensureProfileOrError(userId, rawName);
    if (failure) return failure;
    const response = NextResponse.json({ success: true, userId, isAdmin: true });
    response.cookies.set(USER_COOKIE_NAME, rawName || 'default-user', COOKIE_OPTIONS);
    return response;
  }

  if (!password) {
    return NextResponse.json({ error: 'Mot de passe requis.' }, { status: 401 });
  }

  // Sans ADMIN_PASSWORD, APP_PASSWORD donne les droits admin (mode propriétaire seul).
  const isAdmin = checkAdminPassword(password);
  const profile = resolveLoginProfile(rawName, isAdmin);
  if (!profile.ok) {
    return NextResponse.json({ error: profile.error }, { status: 400 });
  }

  if (!isAdmin) {
    try {
      const credential = await prisma.userCredential.findUnique({ where: { userId: profile.userId } });
      const decision = decideTesterLogin({
        storedHash: credential?.passwordHash ?? null,
        password,
        newPassword,
        isInviteCode: checkPassword(password),
      });
      if (decision.kind === 'needs-password') {
        return NextResponse.json({ error: decision.error, needsPassword: true }, { status: decision.status });
      }
      if (decision.kind === 'error') {
        return NextResponse.json({ error: decision.error }, { status: decision.status });
      }
      if (decision.kind === 'set-password') {
        const passwordHash = hashPassword(newPassword);
        await prisma.userCredential.upsert({
          where: { userId: profile.userId },
          update: { passwordHash },
          create: { userId: profile.userId, passwordHash },
        });
      }
    } catch (error) {
      console.error('Error checking personal password:', error);
      return NextResponse.json({ error: 'Connexion impossible pour le moment. Réessayez.' }, { status: 500 });
    }
  }

  const failure = await ensureProfileOrError(profile.userId, rawName);
  if (failure) return failure;

  const token = createSessionToken(Date.now(), { userId: profile.userId, isAdmin });
  const response = NextResponse.json({ success: true, userId: profile.userId, isAdmin });
  response.cookies.set(AUTH_COOKIE_NAME, token as string, COOKIE_OPTIONS);
  response.cookies.set(USER_COOKIE_NAME, rawName || 'default-user', COOKIE_OPTIONS);
  return response;
}
