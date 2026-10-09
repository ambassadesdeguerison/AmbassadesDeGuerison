import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendCampagneAmbassadeurs, sendCampagneVisiteurs } from '@/lib/email/templates';
import { formatEventDateDual } from '@/lib/format-event-date';
import { getUnsubscribedEmails } from '@/lib/campaigns/unsubscribed';

const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const now = new Date().toISOString();
  const { data: campaigns, error: fetchError } = await supabase
    .from('scheduled_campaigns')
    .select('id, type, event_id, custom_message, events(title, event_date)')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .limit(5);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!campaigns?.length) {
    return NextResponse.json({ dispatched: 0 });
  }

  // Une seule lecture pour tout le run : la liste des désabonnés ne change pas
  // pendant les quelques secondes du dispatch.
  const unsubscribed = await getUnsubscribedEmails(supabase);

  let totalSent = 0;
  const results: { campaign_id: string; sent: number; error?: string; pending?: number }[] = [];

  for (const campaign of campaigns) {
    const event = Array.isArray(campaign.events) ? campaign.events[0] : campaign.events;

    await supabase
      .from('scheduled_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaign.id);

    try {
      const sent = await dispatchCampaign(supabase, campaign, event, unsubscribed);
      totalSent += sent;

      // Un destinataire dont l'envoi a échoué reste `pending` avec attempts+1,
      // pour être retenté au prochain passage du cron. Marquer la campagne
      // `sent` alors qu'il en reste la sortait définitivement de la sélection
      // (`status = 'pending'`) : attempts restait bloqué à 1, le seuil
      // `attempts >= 3 → failed` n'était jamais atteint et le destinataire
      // n'était jamais réessayé ni signalé (constaté en test le 2026-08-07).
      const { count: remaining } = await supabase
        .from('campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending');

      const stillPending = remaining ?? 0;
      const done = stillPending === 0;
      await supabase
        .from('scheduled_campaigns')
        .update(
          done
            ? { status: 'sent', sent_at: new Date().toISOString() }
            : { status: 'pending', last_error: `${stillPending} destinataire(s) en échec, retenté au prochain passage` }
        )
        .eq('id', campaign.id);

      results.push({ campaign_id: campaign.id, sent, ...(done ? {} : { pending: stillPending }) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from('scheduled_campaigns')
        .update({ status: 'failed', last_error: msg })
        .eq('id', campaign.id);
      results.push({ campaign_id: campaign.id, sent: 0, error: msg });
    }
  }

  return NextResponse.json({ dispatched: totalSent, campaigns: results });
}

async function dispatchCampaign(
  supabase: ReturnType<typeof createServiceClient>,
  campaign: { id: string; type: string; event_id: string; custom_message?: string | null },
  event: { title: string; event_date: string } | null | undefined,
  unsubscribed: Set<string>
) {
  if (!event) throw new Error('Événement introuvable');

  const eventDate = formatEventDateDual(event.event_date);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (campaign.type === 'ambassadeurs') {
    return dispatchAmbassadeursBatch(supabase, campaign, event.title, eventDate, appUrl, unsubscribed);
  } else if (campaign.type === 'visiteurs') {
    return dispatchVisiteursBatch(supabase, campaign, event.title, eventDate, appUrl, unsubscribed);
  }
  throw new Error(`Type de campagne inconnu : ${campaign.type}`);
}

async function dispatchAmbassadeursBatch(
  supabase: ReturnType<typeof createServiceClient>,
  campaign: { id: string; event_id: string; custom_message?: string | null },
  eventTitle: string,
  eventDate: string,
  appUrl: string,
  unsubscribed: Set<string>
) {
  let lastId: string | null = null;
  let sent = 0;

  while (true) {
    // Bug #1 fix: curseur sur id plutôt qu'OFFSET
    let query = supabase
      .from('campaign_recipients')
      .select('id, email, first_name, activation_token')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .order('id')
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt('id', lastId);

    const { data: recipients } = await query;
    if (!recipients?.length) break;

    // Bug #2 fix: tracking explicite des failures
    for (const r of recipients) {
      // Filet de sécurité : le snapshot exclut déjà les désabonnés, mais une
      // campagne peut être créée avant un désabonnement et envoyée après.
      if (unsubscribed.has(r.email.toLowerCase())) {
        await supabase
          .from('campaign_recipients')
          .update({ status: 'unsubscribed' })
          .eq('id', r.id);
        continue;
      }
      const activateUrl = `${appUrl}/accueillir/activer/${r.activation_token}`; // Bug #3 fix
      try {
        await sendCampagneAmbassadeurs(
          r.email, r.first_name ?? '', eventTitle, eventDate, activateUrl, campaign.custom_message ?? undefined
        );
        await supabase
          .from('campaign_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString() }) // Bug #4 fix
          .eq('id', r.id);
        sent++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const { data: current } = await supabase
          .from('campaign_recipients')
          .select('attempts')
          .eq('id', r.id)
          .single();
        const attempts = (current?.attempts ?? 0) + 1;
        await supabase
          .from('campaign_recipients')
          .update({
            attempts,
            error: msg,
            status: attempts >= 3 ? 'failed' : 'pending',
          })
          .eq('id', r.id);
      }
    }

    lastId = recipients[recipients.length - 1].id;
    if (recipients.length < BATCH_SIZE) break;
  }

  return sent;
}

async function dispatchVisiteursBatch(
  supabase: ReturnType<typeof createServiceClient>,
  campaign: { id: string; event_id: string },
  eventTitle: string,
  eventDate: string,
  appUrl: string,
  unsubscribed: Set<string>
) {
  let lastId: string | null = null;
  let sent = 0;

  while (true) {
    let query = supabase
      .from('campaign_recipients')
      .select('id, email, first_name, unsubscribe_token')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .order('id')
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt('id', lastId);

    const { data: recipients } = await query;
    if (!recipients?.length) break;

    for (const r of recipients) {
      if (unsubscribed.has(r.email.toLowerCase())) {
        await supabase
          .from('campaign_recipients')
          .update({ status: 'unsubscribed' })
          .eq('id', r.id);
        continue;
      }
      const unsubUrl = `${appUrl}/unsubscribe/${r.unsubscribe_token}`;
      try {
        await sendCampagneVisiteurs(r.email, r.first_name ?? '', eventTitle, eventDate, unsubUrl);
        await supabase
          .from('campaign_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', r.id);
        sent++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const { data: current } = await supabase
          .from('campaign_recipients')
          .select('attempts')
          .eq('id', r.id)
          .single();
        const attempts = (current?.attempts ?? 0) + 1;
        await supabase
          .from('campaign_recipients')
          .update({
            attempts,
            error: msg,
            status: attempts >= 3 ? 'failed' : 'pending',
          })
          .eq('id', r.id);
      }
    }

    lastId = recipients[recipients.length - 1].id;
    if (recipients.length < BATCH_SIZE) break;
  }

  return sent;
}
