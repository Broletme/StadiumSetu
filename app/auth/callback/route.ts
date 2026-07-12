import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // If "next" is provided as a parameter, redirect there, otherwise go to /ops
  const next = searchParams.get('next') ?? '/ops';

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Redirect user to login page with error query parameter
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
