import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, isAuthEnabled, isValidSessionToken } from '@/lib/authGate';

/**
 * Single-password gate for public deployments. SkillForge has no user
 * accounts (DEFAULT_USER_ID is a hardcoded singleton) — without this, anyone
 * who finds the URL can read/write everything, including the admin panel's
 * PDF ingestion, which spends GEMINI_API_KEY quota. Setting APP_PASSWORD
 * turns the gate on; leaving it unset keeps local dev frictionless.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAuthEnabled()) return NextResponse.next();
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (isValidSessionToken(token)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
