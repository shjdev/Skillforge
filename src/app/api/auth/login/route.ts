import { NextResponse } from 'next/server';
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
import { ensureUserProfile, getSessionContext } from '@/lib/serverAuth';

export async function GET() {
  const ctx = await getSessionContext();
  return NextResponse.json({
    authEnabled: isAuthEnabled(),
    adminPasswordEnabled: isAdminPasswordEnabled(),
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawName = typeof body?.name === 'string' ? body.name.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const userId = normalizeProfileId(rawName);

  // En développement local sans APP_PASSWORD : permet quand même de changer de
  // profil apprenant via le cookie `sf-user`.
  if (!isAuthEnabled()) {
    await ensureUserProfile(userId, rawName || undefined).catch(() => {});
    const response = NextResponse.json({ success: true, userId, isAdmin: true });
    response.cookies.set(USER_COOKIE_NAME, rawName || 'default-user', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    });
    return response;
  }

  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  const isAdmin = checkAdminPassword(password);
  const profile = resolveLoginProfile(rawName, isAdmin);
  if (!profile.ok) {
    return NextResponse.json({ error: profile.error }, { status: 400 });
  }
  await ensureUserProfile(profile.userId, rawName || undefined).catch(() => {});

  const token = createSessionToken(Date.now(), { userId: profile.userId, isAdmin });
  const response = NextResponse.json({ success: true, userId: profile.userId, isAdmin });
  response.cookies.set(AUTH_COOKIE_NAME, token as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  response.cookies.set(USER_COOKIE_NAME, rawName || 'default-user', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
