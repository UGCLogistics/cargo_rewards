import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

/**
 * This middleware protects the dashboard and API routes under /dashboard by
 * requiring an active Supabase session. If no session is present the user
 * is redirected to the login page. See
 * https://supabase.com/docs/guides/auth/server-side/nextjs-middleware for
 * details.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  // Only protect routes that begin with /dashboard
  const pathname = req.nextUrl.pathname;
  // Redirect unauthenticated users to login for all dashboard pages
  if (!session && pathname.startsWith('/dashboard')) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }
  // For authenticated requests, enforce role based access on dashboard
  if (session && pathname.startsWith('/dashboard')) {
    // fetch current user including metadata
    const { data: { user } } = await supabase.auth.getUser();
    const role = (user?.user_metadata as any)?.role || 'CUSTOMER';
    // Restrict admin routes
    if (pathname.startsWith('/dashboard/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    // Restrict manager routes
    if (pathname.startsWith('/dashboard/manager') && !['ADMIN', 'MANAGER'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    // Restrict staff routes
    if (pathname.startsWith('/dashboard/staff') && !['ADMIN', 'MANAGER', 'STAFF'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    // Restrict customer routes
    if (pathname.startsWith('/dashboard/customer') && role !== 'CUSTOMER') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }
  return res;
}

// Configure the matcher so that only /dashboard and its subroutes run
// through this middleware. You can extend this list to protect other
// serverless functions as needed.
export const config = {
  // Protect dashboard routes and selected API routes so that unauthenticated
  // requests are redirected to login and role checks can be enforced. You can
  // extend this matcher if additional namespaces should be secured.
  matcher: ['/dashboard/:path*', '/api/admin/:path*', '/api/manager/:path*', '/api/staff/:path*'],
};