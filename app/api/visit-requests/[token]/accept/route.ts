import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendAcceptationVisite } from '@/lib/email/templates';
import { FEATURES } from '@/config/features';
import { formatEventDateDual } from '@/lib/format-event-date';

interface Props {
  params: Promise<{ token: string }>;
}

export async function POST(_req: NextRequest, { params }: Props) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Récupérer la demande + host
  const { data: contact } = await supabase
    .from('contact_requests')
    .select(`
      id, status, visitor_first_name, visitor_email, visitor_token,
      host_activations!inner(
        event_id,
        host_profiles!inner(
          first_name, address_private,
          email, phone, whatsapp_group_url
        ),
        events!inner(title, event_date)
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
    .update({ status: 'accepted' })
    .eq('id', contact.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Email au visiteur avec l'adresse
  if (FEATURES.EMAIL_NOTIFICATIONS) {
    const ha = Array.isArray(contact.host_activations)
      ? contact.host_activations[0]
      : contact.host_activations;
    const host = Array.isArray(ha?.host_profiles) ? ha.host_profiles[0] : ha?.host_profiles;
    const event = Array.isArray(ha?.events) ? ha.events[0] : ha?.events;

    if (host && event) {
      // Cet e-mail part chez le visiteur : jamais `action_token` (jeton d'acceptation de l'hôte).
      const contactEquipeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/contact-equipe?token=${contact.visitor_token}`;
      const eventDate = formatEventDateDual(event.event_date);

      Promise.allSettled([
        sendAcceptationVisite(
          contact.visitor_email,
          contact.visitor_first_name,
          host.first_name,
          host.address_private ?? "Adresse communiquée par l'hôte",
          host.phone ?? null,
          event.title,
          eventDate,
          contactEquipeUrl,
          host.email ?? null,
          host.whatsapp_group_url ?? null,
        ),
      ]);
    }
  }

  return NextResponse.json({ success: true });
}
