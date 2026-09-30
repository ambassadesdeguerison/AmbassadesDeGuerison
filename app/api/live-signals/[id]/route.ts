import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendSignalApproved } from '@/lib/email/templates';
import { FEATURES } from '@/config/features';
import { firstRow } from '@/lib/supabase/relation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { action } = await request.json(); // 'approve' | 'decline'

  if (!['approve', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'declined';

  // Récupère le signal + données pour l'email
  const { data: signal, error: fetchError } = await supabase
    .from('live_signals')
    .select(`
      id, event_id, status,
      host_profiles!inner (id, first_name, email),
      events!inner (live_link)
    `)
    .eq('id', id)
    .single();

  if (fetchError || !signal) {
    return NextResponse.json({ error: 'Signal introuvable' }, { status: 404 });
  }

  if (signal.status !== 'pending') {
    return NextResponse.json({ error: 'Signal déjà traité' }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from('live_signals')
    .update({ status: newStatus, link_shared: action === 'approve' })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Envoie l'email si approuvé et notifications activées
  let emailSent = false;
  if (action === 'approve' && FEATURES.EMAIL_NOTIFICATIONS) {
    const hp = firstRow(signal.host_profiles);
    const ev = firstRow(signal.events);
    if (hp?.email && ev?.live_link) {
      try {
        await sendSignalApproved(hp.email, hp.first_name, ev.live_link);
        emailSent = true;
      } catch (err) {
        console.error('[live-signals] échec envoi sendSignalApproved', { signalId: id, err });
      }
    } else {
      console.error('[live-signals] email non tenté, données manquantes', { signalId: id, email: hp?.email, liveLink: ev?.live_link });
    }
  }

  return NextResponse.json({ success: true, status: newStatus, emailSent });
}
