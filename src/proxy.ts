import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, isAdminPasswordEnabled, isAuthEnabled, parseSessionToken } from '@/lib/authGate';

const ADMIN_ONLY_API_PREFIXES = [
  '/api/admin/users',
  '/api/admin/activity',
  '/api/admin/export',
  '/api/admin/quizzes',
  '/api/admin/lessons',
  '/api/admin/questions',
];

/**
 * Single-password gate + multi-profile support for public deployments.
 * Setting APP_PASSWORD turns the gate on; setting ADMIN_PASSWORD additionally
 * restricts the /admin console to the owner while allowing invited testers to
 * use their own learner space and import their own books in /library.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isAuthEnabled()) return NextResponse.next();
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);
  if (!session.valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminPasswordEnabled() && !session.isAdmin) {
    const isAdminPage = pathname.startsWith('/admin');
    const isAdminOnlyApi = ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (isAdminOnlyApi) {
      return NextResponse.json({ error: 'Accès réservé à l’administrateur.' }, { status: 403 });
    }
    if (isAdminPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('admin', '1');
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
