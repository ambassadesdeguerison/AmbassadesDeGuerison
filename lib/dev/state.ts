import type { SupabaseClient } from '@supabase/supabase-js';
import { firstRow } from '@/lib/supabase/relation';

export type DevState = 'live' | 'live-zero' | 'soon' | 'soon-confirmed' | 'upcoming' | 'upcoming-confirmed' | 'past' | 'closed' | 'blank';

// Active `count` host_activations pour un event donné, en priorisant les profils
// women-only (visibles en rose pour la démo Feature B), puis par created_at ASC
// pour un comportement déterministe entre les invocations.
async function activateConfirmedSubset(
  supabase: SupabaseClient,
  eventId: string,
  count: number,
) {
  const { data: activations } = await supabase
    .from('host_activations')
    .select('id, host_profiles!inner(is_women_only, created_at)')
    .eq('event_id', eventId);

  if (!activations?.length) return;

  const sorted = [...activations].sort((a, b) => {
    const ahp = firstRow(a.host_profiles);
    const bhp = firstRow(b.host_profiles);
    if (!ahp || !bhp) return 0;
    if (ahp.is_women_only !== bhp.is_women_only) return ahp.is_women_only ? -1 : 1;
    return new Date(ahp.created_at).getTime() - new Date(bhp.created_at).getTime();
  });

  const toActivate = sorted.slice(0, count);
  if (!toActivate.length) return;

  await supabase
    .from('host_activations')
    .update({ is_active: true })
    .in('id', toActivate.map((a) => a.id));
}

/**
 * Résout les deux events de référence utilisés par tous les états démo :
 * `demoLiveEvent` (celui qu'on positionne comme "en cours"/"passé"/"clôturé"
 * selon l'état choisi) et `demoFutureEvent` (le prochain live à venir, s'il
 * existe). Extrait de `applyState` pour être réutilisé par les actions dev
 * qui doivent cibler le même event sans changer son état (ex: déclenchement
 * manuel des emails de feedback en démo).
 */
export async function resolveDemoEvents(supabase: SupabaseClient) {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, event_date')
    .order('event_date', { ascending: true });

  if (error || !events?.length) {
    throw new Error('Aucun événement en base. Relancez node scripts/seed.js d\'abord.');
  }

  const now = Date.now();
  const WINDOW_H = Number(process.env.NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS ?? 4);

  const pastEvents = events.filter(e => new Date(e.event_date).getTime() <= now);
  const futureEvents = events.filter(e => new Date(e.event_date).getTime() > now);

  // Même logique de sélection que scripts/demo-state.js:140-156
  const liveWindowEvent = events.find(e => {
    const ms = new Date(e.event_date).getTime();
    return ms <= now && now <= ms + WINDOW_H * 3600 * 1000;
  }) ?? null;
  const outsideWindow = pastEvents.filter(
    e => now > new Date(e.event_date).getTime() + WINDOW_H * 3600 * 1000,
  );
  const demoLiveEvent =
    liveWindowEvent ??
    outsideWindow[outsideWindow.length - 1] ??
    pastEvents[pastEvents.length - 1];
  const demoFutureEvent =
    futureEvents[0] ??
    (outsideWindow.length >= 2 ? outsideWindow[outsideWindow.length - 2] : null);

  if (!demoLiveEvent) {
    throw new Error('Aucun événement passé trouvé. Relancez node scripts/seed.js d\'abord.');
  }

  return { demoLiveEvent, demoFutureEvent };
}

export async function applyState(supabase: SupabaseClient, state: DevState) {
  const { demoLiveEvent, demoFutureEvent } = await resolveDemoEvents(supabase);
  const WINDOW_H = Number(process.env.NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS ?? 4);

  const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
  const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

  if (state === 'live') {
    await supabase
      .from('events')
      .update({
        event_date: hoursFromNow(-2),
        registration_opens_at: daysAgo(8),
        registration_closes_at: hoursFromNow(4),
      })
      .eq('id', demoLiveEvent.id);
    await supabase
      .from('host_activations')
      .update({ is_active: true })
      .eq('event_id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({ event_date: daysFromNow(10) })
        .eq('id', demoFutureEvent.id);
    }
    return;
  }

  // Live en cours mais 0 ambassadeurs confirmés (campagne email pas encore envoyée)
  if (state === 'live-zero') {
    await supabase
      .from('events')
      .update({
        event_date: hoursFromNow(-2),
        registration_opens_at: daysAgo(8),
        registration_closes_at: hoursFromNow(4),
      })
      .eq('id', demoLiveEvent.id);
    await supabase
      .from('host_activations')
      .update({ is_active: false })
      .eq('event_id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({ event_date: daysFromNow(10) })
        .eq('id', demoFutureEvent.id);
    }
    return;
  }

  if (state === 'soon') {
    await supabase.from('host_activations').update({ is_active: false }).in('is_active', [true, false]);
    await supabase
      .from('events')
      .update({
        event_date: daysAgo(7),
        registration_opens_at: daysAgo(14),
        registration_closes_at: daysAgo(7),
      })
      .eq('id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({ event_date: daysFromNow(3) })
        .eq('id', demoFutureEvent.id);
    }
    return;
  }

  if (state === 'upcoming') {
    await supabase.from('host_activations').update({ is_active: false }).in('is_active', [true, false]);
    await supabase
      .from('events')
      .update({
        event_date: daysAgo(7),
        registration_opens_at: daysAgo(14),
        registration_closes_at: daysAgo(7),
      })
      .eq('id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({ event_date: daysFromNow(10) })
        .eq('id', demoFutureEvent.id);
    }
    return;
  }

  // Futur live dans 3j, quelques ambassadeurs ont déjà cliqué le lien de campagne
  if (state === 'soon-confirmed') {
    await supabase.from('host_activations').update({ is_active: false }).in('is_active', [true, false]);
    await supabase
      .from('events')
      .update({
        event_date: daysAgo(7),
        registration_opens_at: daysAgo(14),
        registration_closes_at: daysAgo(7),
      })
      .eq('id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({ event_date: daysFromNow(3) })
        .eq('id', demoFutureEvent.id);
      await activateConfirmedSubset(supabase, demoFutureEvent.id, 5);
    }
    return;
  }

  // Futur live dans 10j, quelques ambassadeurs ont déjà cliqué le lien de campagne
  if (state === 'upcoming-confirmed') {
    await supabase.from('host_activations').update({ is_active: false }).in('is_active', [true, false]);
    await supabase
      .from('events')
      .update({
        event_date: daysAgo(7),
        registration_opens_at: daysAgo(14),
        registration_closes_at: daysAgo(7),
      })
      .eq('id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({ event_date: daysFromNow(10) })
        .eq('id', demoFutureEvent.id);
      await activateConfirmedSubset(supabase, demoFutureEvent.id, 5);
    }
    return;
  }

  if (state === 'past') {
    await supabase.from('host_activations').update({ is_active: false }).in('is_active', [true, false]);
    await supabase
      .from('events')
      .update({
        event_date: daysAgo(7),
        registration_opens_at: daysAgo(14),
        registration_closes_at: daysAgo(7),
      })
      .eq('id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({ event_date: daysAgo(10) })
        .eq('id', demoFutureEvent.id);
    }
    return;
  }

  if (state === 'closed') {
    await supabase.from('host_activations').update({ is_active: false }).in('is_active', [true, false]);
    await supabase
      .from('events')
      .update({
        event_date: hoursFromNow(-(WINDOW_H + 1)),
        registration_opens_at: daysAgo(8),
        registration_closes_at: daysAgo(1),
      })
      .eq('id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({ event_date: daysFromNow(10) })
        .eq('id', demoFutureEvent.id);
    }
    return;
  }

  // Futur live annoncé, 0 ambassadeurs confirmés (campagne email pas encore envoyée)
  if (state === 'blank') {
    await supabase.from('host_activations').update({ is_active: false }).in('is_active', [true, false]);
    await supabase
      .from('events')
      .update({
        event_date: daysAgo(7),
        registration_opens_at: daysAgo(14),
        registration_closes_at: daysAgo(7),
      })
      .eq('id', demoLiveEvent.id);
    if (demoFutureEvent) {
      await supabase
        .from('events')
        .update({
          event_date: daysFromNow(10),
          registration_opens_at: daysAgo(1),
          registration_closes_at: daysFromNow(9),
        })
        .eq('id', demoFutureEvent.id);
      await supabase
        .from('host_activations')
        .update({ is_active: false })
        .eq('event_id', demoFutureEvent.id);
    }
  }
}
