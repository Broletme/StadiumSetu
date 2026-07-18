import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * proxy.ts — Next.js 16 route protection
 *
 * NOTE: In Next.js 16, `middleware.ts` has been deprecated and renamed to
 * `proxy.ts`. The exported function must be named `proxy` (not `middleware`).
 *
 * This proxy runs only on /ops/* routes. It reads the Supabase session from
 * cookies (set by @supabase/ssr browser client) and redirects unauthenticated
 * users to /.
 *
 * The public fan chat/auth screen at "/" is NOT matched.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies back to the request (for downstream) and response (for browser)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates the session against Supabase Auth and refreshes it
  // if it's expired. Always use getUser() rather than getSession() in proxy
  // because getSession() only reads the cookie without server-side validation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/', request.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match /ops and all sub-paths (/ops/incidents, /ops/me, etc.)
     * Exclude Next.js internals and static files.
     */
    '/ops/:path*',
  ],
};
