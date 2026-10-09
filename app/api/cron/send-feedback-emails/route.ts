import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { getTimingConfig } from '@/lib/timing-config';
import { sendFeedbackPostLive, sendFeedbackPostLiveHost } from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const [supabase, config] = [createServiceClient(), await getTimingConfig()];

  // Events dont la date est dans la fenêtre [feedbackDaysAfter, feedbackDaysAfter + 1 jour]
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - config.feedback_days_after - 1);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() - config.feedback_days_after);

  const { data: events } = await supabase
    .from('events')
    .select('id, title')
    .gte('event_date', windowStart.toISOString())
    .lte('event_date', windowEnd.toISOString())
    .neq('feedback_sent', true);

  if (!events?.length) {
    return NextResponse.json({ sent: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  let visitorsSent = 0;
  let hostsSent = 0;

  for (const event of events) {
    // BUG FIX (documenté dans docs/ARCHITECTURE.md) : l'ancien .eq('host_activations.event_id', ...)
    // sur une requête contact_requests sans jointure embarquée ne filtrait rien —
    // retournait TOUS les contact_requests acceptés, tous events confondus.
    // Fix : résoudre d'abord les host_activations de CET event, puis filtrer
    // contact_requests par host_activation_id IN (...).
    // Paginé : PostgREST tronque à 1000 lignes en silence. Sur un live à forte
    // affluence, les visiteurs au-delà du 1000e n'auraient jamais reçu leur
    // invitation à témoigner — et `feedback_sent` aurait quand même été posé,
    // rendant l'oubli définitif.
    const activations = await fetchAllRows<{ id: string; host_profile_id: string; host_profiles: { email: string; first_name: string } }>(() =>
      supabase
        .from('host_activations')
        .select('id, host_profile_id, host_profiles!inner(email, first_name)')
        .eq('event_id', event.id)
        .order('id', { ascending: true })
    );

    if (!activations.length) {
      await supabase.from('events').update({ feedback_sent: true }).eq('id', event.id);
      continue;
    }

    const activationIds = activations.map((a) => a.id);

    const contacts = await fetchAllRows<{ id: string; visitor_email: string; visitor_first_name: string; visitor_token: string; host_activation_id: string }>(() =>
      supabase
        .from('contact_requests')
        .select('id, visitor_email, visitor_first_name, visitor_token, host_activation_id')
        .eq('status', 'accepted')
        .in('host_activation_id', activationIds)
        .order('id', { ascending: true })
    );

    if (contacts.length) {
      await Promise.allSettled(
        contacts.map((c) =>
          sendFeedbackPostLive(
            c.visitor_email,
            c.visitor_first_name,
            event.title,
            `${appUrl}/feedback/${c.visitor_token}`
          )
        )
      );
      visitorsSent += contacts.length;
    }

    // Un email hôte par activation ayant accueilli au moins un visiteur accepté
    // (pas un email par visiteur — la page /feedback/host liste tous ses
    // visiteurs sur une seule page, un seul lien à envoyer).
    const activationsWithContacts = activations.filter((a) =>
      contacts.some((c) => c.host_activation_id === a.id)
    );

    if (activationsWithContacts.length) {
      await Promise.allSettled(
        activationsWithContacts.map((a) => {
          const hp = Array.isArray(a.host_profiles) ? a.host_profiles[0] : a.host_profiles;
          if (!hp) return Promise.resolve();
          return sendFeedbackPostLiveHost(
            hp.email,
            hp.first_name,
            event.title,
            `${appUrl}/feedback/host/${a.id}`
          );
        })
      );
      hostsSent += activationsWithContacts.length;
    }

    // Marque l'event comme feedback_sent (colonne idempotence)
    await supabase
      .from('events')
      .update({ feedback_sent: true })
      .eq('id', event.id);
  }

  return NextResponse.json({ visitorsSent, hostsSent });
}
