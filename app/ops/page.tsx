import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import OpsDashboardClient from './OpsDashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ops Dashboard — StadiumSetu',
  description: 'StadiumSetu operations staff dashboard',
};

export default async function OpsDashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Fallback server-side check — proxy.ts handles this for most cases
  if (!session) {
    redirect('/login');
  }

  return (
    <OpsDashboardClient
      userEmail={session.user.email ?? ''}
      accessToken={session.access_token}
    />
  );
}
