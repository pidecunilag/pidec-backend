import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { DashboardShell } from '@/shared/ui';
import { getServerSupabase } from '@/shared/lib/supabase/server';
import { ROUTES } from '@/shared/config/routes';

interface DashboardProfile {
  id: string;
  name: string;
  team_id: string | null;
}

interface DashboardTeam {
  name: string;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${ROUTES.LOGIN}?next=${ROUTES.DASHBOARD}`);
  }

  // Pull profile + team for the shell header. RLS lets the user read own row.
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, team_id')
    .eq('id', user.id)
    .maybeSingle();

  const typedProfile = profile as DashboardProfile | null;

  const { data: team } = typedProfile?.team_id
    ? await supabase.from('teams').select('name').eq('id', typedProfile.team_id).maybeSingle()
    : { data: null };

  const typedTeam = team as DashboardTeam | null;

  return (
    <DashboardShell
      user={{
        name: typedProfile?.name ?? user.email ?? 'Student',
        teamName: typedTeam?.name ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}
