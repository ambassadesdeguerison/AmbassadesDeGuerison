import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { firstRow } from '@/lib/supabase/relation';

const DELAY_MS = 24 * 60 * 60 * 1000; // 24h
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

async function fetchRequest(token: string) {
  const supabase = createServiceClient();
  const expiresAt = new Date(Date.now() - TOKEN_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('contact_requests')
    .select(`
      id, status, created_at, onboarding_completed,
      host_activations!inner (
        event_id,
        host_profiles!inner (
          first_name, address_private, whatsapp_group_url, consignes
        )
      )
    `)
    .eq('action_token', token)
    .gt('created_at', expiresAt)
    .single();

  return { data, error };
}

// GET — vérification du token + état d'attente ou prêt
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { data, error } = await fetchRequest(token);

  if (error || !data) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 410 });
  }
  if (data.status === 'declined') {
    return NextResponse.json({ error: 'Cette demande a été refusée.' }, { status: 403 });
  }

  const ha = firstRow(data.host_activations);
  const hp = firstRow(ha?.host_profiles);
  const secondsRemaining = Math.max(
    0,
    Math.ceil((new Date(data.created_at).getTime() + DELAY_MS - Date.now()) / 1000)
  );

  return NextResponse.json({
    status: secondsRemaining > 0 ? 'waiting' : 'ready',
    seconds_remaining: secondsRemaining,
    host_first_name: hp?.first_name ?? null,
    consignes: hp?.consignes ?? null,
    already_acknowledged: data.onboarding_completed,
  });
}

// POST — confirmation "J'ai bien pris note" → révèle l'adresse
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { data, error } = await fetchRequest(token);

  if (error || !data) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 410 });
  }
  if (data.status === 'declined') {
    return NextResponse.json({ error: 'Cette demande a été refusée.' }, { status: 403 });
  }

  const secondsRemaining = Math.max(
    0,
    Math.ceil((new Date(data.created_at).getTime() + DELAY_MS - Date.now()) / 1000)
  );
  if (secondsRemaining > 0) {
    return NextResponse.json({ error: 'Adresse pas encore disponible.' }, { status: 425 });
  }

  const supabase = createServiceClient();
  await supabase
    .from('contact_requests')
    .update({ onboarding_completed: true })
    .eq('action_token', token);

  const ha = firstRow(data.host_activations);
  const hp = firstRow(ha?.host_profiles);

  return NextResponse.json({
    address: hp?.address_private ?? null,
    whatsapp: hp?.whatsapp_group_url ?? null,
    consignes: hp?.consignes ?? null,
    host_first_name: hp?.first_name ?? null,
    event_id: ha?.event_id ?? null,
    contact_request_id: data.id,
  });
}
