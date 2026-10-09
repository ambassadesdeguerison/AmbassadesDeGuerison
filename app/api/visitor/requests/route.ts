import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';
import type { RequestStatus } from '@/lib/visitor/group-requests';

function getAnonClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
}

type Related<T> = T | T[] | null;
function first<T>(v: Related<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Demandes de visite du visiteur connecté, pour « Mes demandes » dans /mon-espace.
// Ne renvoie jamais `action_token` : c'est aussi le jeton d'acceptation côté hôte
// (/accueillir/[token]), et `declined_permanently` est ramené à « declined » —
// le visiteur n'a pas à savoir qu'un refus est définitif (message neutre, cf CLAUDE.md).
// Renvoie en revanche `visitor_token` : c'est le jeton du visiteur (suivi, avis), qui ne donne
// aucun pouvoir d'acceptation — il permet de lier chaque carte vers /visitor/[token].
export async function GET(req: NextRequest) {
  const { data: { user } } = await getAnonClient(req).auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('visitor_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  const { data, error } = await supabase
    .from('contact_requests')
    .select(`
      id, status, nb_personnes, created_at, visitor_token,
      host_activations!inner(
        events!inner(id, title, event_date, closed_at),
        host_profiles!inner(first_name, city, country)
      )
    `)
    .eq('visitor_profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[visitor/requests] lecture impossible', error.message);
    return NextResponse.json({ error: 'Impossible de charger vos demandes.' }, { status: 500 });
  }

  const requests = (data ?? []).map((r) => {
    const ha = first(r.host_activations);
    const event = first(ha?.events ?? null);
    const host = first(ha?.host_profiles ?? null);
    return {
      id: r.id,
      status: r.status as RequestStatus,
      nb_personnes: r.nb_personnes,
      created_at: r.created_at,
      visitor_token: r.visitor_token,
      event_id: event?.id ?? null,
      event_title: event?.title ?? null,
      event_date: event?.event_date ?? null,
      event_closed_at: event?.closed_at ?? null,
      host_first_name: host?.first_name ?? null,
      host_city: host?.city ?? null,
      host_country: host?.country ?? null,
    };
  });

  return NextResponse.json({ requests });
}
