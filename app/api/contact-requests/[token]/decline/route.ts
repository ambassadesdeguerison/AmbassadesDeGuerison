import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendContactRequestDeclined } from '@/lib/email/templates';
import { FEATURES } from '@/config/features';
import { firstRow } from '@/lib/supabase/relation';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// GET — info pour la page de confirmation
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();
  const expiresAt = new Date(Date.now() - TOKEN_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('contact_requests')
    .select(`
      id, status, visitor_first_name,
      host_activations!inner (
        host_profiles!inner ( first_name )
      )
    `)
    .eq('action_token', token)
    .gt('created_at', expiresAt)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 410 });
  }
  if (data.status === 'declined') {
    return NextResponse.json({ already_declined: true }, { status: 200 });
  }

  const hp = firstRow(firstRow(data.host_activations)?.host_profiles);
  return NextResponse.json({
    visitor_first_name: data.visitor_first_name,
    host_first_name: hp?.first_name ?? null,
  });
}

// POST — effectue le refus
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();
  const expiresAt = new Date(Date.now() - TOKEN_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from('contact_requests')
    .select(`
      id, status, visitor_first_name, visitor_email,
      host_activations!inner (
        host_profiles!inner ( first_name )
      )
    `)
    .eq('action_token', token)
    .gt('created_at', expiresAt)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 410 });
  }
  if (data.status === 'declined') {
    return NextResponse.json({ success: true, already_declined: true });
  }

  const { error: updateError } = await supabase
    .from('contact_requests')
    .update({ status: 'declined' })
    .eq('id', data.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const hp = firstRow(firstRow(data.host_activations)?.host_profiles);
  if (hp && FEATURES.EMAIL_NOTIFICATIONS) {
    sendContactRequestDeclined(
      data.visitor_email,
      data.visitor_first_name,
      hp.first_name
    ).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
