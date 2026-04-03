import { NextResponse, type NextRequest } from 'next/server';

/**
 * JWT Middleware — validates Firebase Auth tokens on every protected request.
 *
 * In production, this will:
 * 1. Extract the Firebase JWT from the Authorization header or session cookie
 * 2. Verify it using Firebase Admin SDK
 * 3. Extract custom claims: clientId, role, permittedModules
 * 4. Pass claims via request headers to server components and API routes
 * 5. Reject unauthenticated requests to protected routes
 *
 * For now, this is a stub that lets all requests through during development.
 * The structure is in place — the verification logic gets added when
 * the auth flow is fully wired.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  const publicRoutes = ['/login', '/api/auth/session'];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // TODO: Extract and verify JWT
  // const token = request.headers.get('authorization')?.replace('Bearer ', '');
  // if (!token) {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }

  // TODO: Verify token with Firebase Admin and extract claims
  // For now, pass through — auth enforcement comes when the login flow is complete.

  // Forward claims via headers (placeholder values for development)
  const response = NextResponse.next();
  response.headers.set('x-client-id', 'dev-client');
  response.headers.set('x-user-role', 'internal');
  response.headers.set('x-permitted-modules', 'dashboard,approvals');

  return response;
}

/**
 * Match all routes except static assets and Next.js internals.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brand/).*)',
  ],
};
