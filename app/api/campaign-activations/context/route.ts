import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { firstRow } from '@/lib/supabase/relation';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: recipient } = await supabase
    .from('campaign_recipients')
    .select('id, email, status, scheduled_campaigns(event_id, events(title, event_date))')
    .eq('activation_token', token)
    .eq('recipient_type', 'ambassador')
    .maybeSingle();

  if (!recipient) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const campaign = firstRow(recipient.scheduled_campaigns);
  const event = firstRow(campaign?.events);

  if (!event) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });

  // Vérifier si déjà activé
  const { data: hostProfile } = await supabase
    .from('host_profiles')
    .select('id')
    .eq('email', recipient.email)
    .maybeSingle();

  let already_active = false;
  if (hostProfile && campaign?.event_id) {
    const { data: ha } = await supabase
      .from('host_activations')
      .select('is_active')
      .eq('host_profile_id', hostProfile.id)
      .eq('event_id', campaign.event_id)
      .maybeSingle();
    already_active = ha?.is_active === true;
  }

  return NextResponse.json({
    event_title: event.title,
    event_date: event.event_date,
    already_active,
  });
}
