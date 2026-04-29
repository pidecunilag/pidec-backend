/**
 * Next.js middleware: refreshes the Supabase session cookie on every
 * request and gates protected route groups by user role.
 *
 * Routing rules:
 *   /dashboard/*  → requires authenticated user with role=student or admin
 *   /admin/*      → requires authenticated user with role=admin (login page is public)
 *   /judge/*      → requires authenticated user with role=judge
 *   everything else (landing, login, register, etc.) is public
 */
import { type NextRequest, NextResponse } from 'next/server';
import { getMiddlewareSupabase } from './shared/lib/supabase/middleware';

const STUDENT_PATH = '/dashboard';
const ADMIN_PATH = '/admin';
const ADMIN_LOGIN_PATH = '/admin/login';
const JUDGE_PATH = '/judge';
const LOGIN_PATH = '/login';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await getMiddlewareSupabase(request);

  const isStudentRoute = pathname.startsWith(STUDENT_PATH);
  const isAdminRoute =
    pathname.startsWith(ADMIN_PATH) && pathname !== ADMIN_LOGIN_PATH;
  const isJudgeRoute = pathname.startsWith(JUDGE_PATH);

  // Unauthenticated → bounce to the appropriate login
  if (!user) {
    if (isStudentRoute) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    if (isAdminRoute) {
      const url = request.nextUrl.clone();
      url.pathname = ADMIN_LOGIN_PATH;
      return NextResponse.redirect(url);
    }
    if (isJudgeRoute) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Authenticated → enforce role boundaries
  if (isAdminRoute && user.role !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  if (isJudgeRoute && user.role !== 'judge') {
    const url = request.nextUrl.clone();
    url.pathname = user.role === 'admin' ? '/admin' : '/dashboard';
    return NextResponse.redirect(url);
  }
  if (isStudentRoute && user.role === 'judge') {
    const url = request.nextUrl.clone();
    url.pathname = '/judge';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip middleware on static assets, _next internals, and image optimisation
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)).*)'],
};
