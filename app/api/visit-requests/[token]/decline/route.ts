import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendRefusVisite } from '@/lib/email/templates';
import { FEATURES } from '@/config/features';

interface Props {
  params: Promise<{ token: string }>;
}

export async function POST(req: NextRequest, { params }: Props) {
  const { token } = await params;
  // « Ne plus accueillir cette personne » (true) ou « pas disponible cette fois » (absent/false).
  const permanent = (await req.json().catch(() => null))?.permanent === true;
  const supabase = createServiceClient();

  const { data: contact } = await supabase
    .from('contact_requests')
    .select(`
      id, status, visitor_first_name, visitor_email,
      host_activations!inner(
        host_profiles!inner(first_name)
      )
    `)
    .eq('action_token', token)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  }
  if (contact.status !== 'pending') {
    return NextResponse.json({ message: 'Demande déjà traitée', status: contact.status }, { status: 200 });
  }

  const { error } = await supabase
    .from('contact_requests')
    .update({ status: 'declined', declined_permanently: permanent })
    .eq('id', contact.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (FEATURES.EMAIL_NOTIFICATIONS) {
    const ha = Array.isArray(contact.host_activations)
      ? contact.host_activations[0]
      : contact.host_activations;
    const host = Array.isArray(ha?.host_profiles) ? ha.host_profiles[0] : ha?.host_profiles;
    if (host) {
      Promise.allSettled([
        sendRefusVisite(contact.visitor_email, contact.visitor_first_name, host.first_name, permanent),
      ]);
    }
  }

  return NextResponse.json({ success: true });
}
