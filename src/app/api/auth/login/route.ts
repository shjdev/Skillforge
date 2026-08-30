import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, checkPassword, createSessionToken, isAuthEnabled } from '@/lib/authGate';

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Authentification non configurée (APP_PASSWORD absent)." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  const token = createSessionToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE_NAME, token as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
  return response;
}
