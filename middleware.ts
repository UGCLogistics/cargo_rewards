import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware ini melindungi dashboard dan route API tertentu dengan
 * session Supabase + role di user_metadata.
 */
export async function middleware(req: NextRequest) {
  // Response default
  let res = NextResponse.next({
    request: {
      headers: new Headers(req.headers),
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // Saat set cookie, kita buat NextResponse baru dan set cookie di sana
          res = NextResponse.next({
            request: {
              headers: new Headers(req.headers),
            },
          });
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          res = NextResponse.next({
            request: {
              headers: new Headers(req.headers),
            },
          });
          res.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Ambil user (sekalian jadi indikator session ada/tidak)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  // === LOGIC 1: redirect ke /login kalau belum login & akses /dashboard ===
  if (!user && pathname.startsWith('/dashboard')) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // === LOGIC 2: role-based access di /dashboard/... ===
  if (user && pathname.startsWith('/dashboard')) {
    const role =
      ((user.user_metadata as any)?.role as string | undefined) || 'CUSTOMER';

    // Restrict admin routes
    if (pathname.startsWith('/dashboard/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Restrict manager routes
    if (
      pathname.startsWith('/dashboard/manager') &&
      !['ADMIN', 'MANAGER'].includes(role)
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Restrict staff routes
    if (
      pathname.startsWith('/dashboard/staff') &&
      !['ADMIN', 'MANAGER', 'STAFF'].includes(role)
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Restrict customer routes
    if (
      pathname.startsWith('/dashboard/customer') &&
      role !== 'CUSTOMER'
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Kalau tidak kena kondisi di atas, lanjutkan request
  return res;
}

// Config matcher sama seperti sebelumnya
export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*', '/api/manager/:path*', '/api/staff/:path*'],
};
