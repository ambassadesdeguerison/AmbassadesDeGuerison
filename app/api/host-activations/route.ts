import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPublicMapPhotoUrls } from '@/lib/storage/photo-url';
import { jitterCoordinates } from '@/lib/geo/jitter';
import { firstRow } from '@/lib/supabase/relation';
import { mapCacheHeaders } from '@/lib/map/cache-headers';

// Polling 5 s depuis la carte publique. Cache CDN court et facultatif : MAP_CACHE_SECONDS (lib/map/cache-headers.ts).
export const revalidate = 0;

export async function GET() {
  const supabase = createServiceClient();

  const now = new Date();
  const nowISO = now.toISOString();
  const windowHours = Number(process.env.NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS ?? 4);
  const windowStart = new Date(now.getTime() - windowHours * 3_600_000).toISOString();

  // Priorité : live en cours (non clôturé) → prochain event → dernier event passé (carte vide)
  const inProgressRes = await supabase.from('events').select('id')
    .lte('event_date', nowISO).gte('event_date', windowStart).is('closed_at', null)
    .order('event_date', { ascending: false }).limit(1).maybeSingle();
  const upcomingRes = inProgressRes.data ? null : await supabase.from('events').select('id')
    .gt('event_date', nowISO)
    .order('event_date', { ascending: true }).limit(1).maybeSingle();
  const pastRes = inProgressRes.data || upcomingRes?.data ? null : await supabase.from('events').select('id')
    .lte('event_date', nowISO)
    .order('event_date', { ascending: false }).limit(1).maybeSingle();

  const referenceEvent = inProgressRes.data ?? upcomingRes?.data ?? pastRes?.data;

  // Si les trois requêtes ont échoué (plutôt que "légitimement aucune ligne"),
  // c'est un signal de panne DB (ex: projet Supabase en pause) — pas un vrai
  // 0 event. Distinguer explicitement pour ne pas retourner [] comme si la
  // carte était légitimement vide (cf investigation 2026-08-20).
  const queryErrors = [inProgressRes.error, upcomingRes?.error, pastRes?.error].filter(Boolean);
  if (!referenceEvent && queryErrors.length > 0) {
    console.error('GET /api/host-activations: échec requête events (DB injoignable ?)', queryErrors);
    return NextResponse.json({ error: 'db_unreachable' }, { status: 503 });
  }

  if (!referenceEvent) {
    return NextResponse.json([], { headers: mapCacheHeaders() });
  }

  const lastEvent = referenceEvent;

  const { data, error } = await supabase
    .from('host_activations')
    .select(`
      id, is_active, is_full, capacity, accepted_count,
      host_profiles!inner (
        id, first_name, city, country, lat, lng,
        whatsapp_group_url, geocoding_failed, host_type, quartier, is_women_only,
        presentation_message, profile_photo_url
      )
    `)
    .eq('event_id', lastEvent.id);

  if (error) {
    console.error('GET /api/host-activations: échec requête host_activations', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).flatMap((a) => {
    const hp = firstRow(a.host_profiles);
    return hp && hp.lat && hp.lng && !hp.geocoding_failed ? [{ a, hp }] : [];
  });

  // Signed URLs uniquement pour les hôtes actifs (photo affichée en popup,
  // jamais sur le pin) — pas de coût de signature pour les pins grisés.
  const activePhotoPaths = rows
    .filter(({ a }) => a.is_active)
    .map(({ hp }) => hp.profile_photo_url)
    .filter((path): path is string => Boolean(path));
  const photoUrls = await getPublicMapPhotoUrls(activePhotoPaths);

  const pins = rows.map(({ a, hp }) => {
    // Jitter décoratif (retour David 2026-09-27, voir lib/geo/jitter.ts) :
    // plusieurs ambassadeurs d'une même ville partagent aujourd'hui des lat/lng
    // identiques (géocodage ville) et s'empilaient au même pixel sur la carte,
    // quel que soit le zoom. Décalage déterministe dérivé de host_id — ne dérive
    // JAMAIS de lat_precise/lng_precise (voir commentaire du fichier pour la
    // raison : ça aurait amplifié /api/distance en oracle de triangulation).
    const { lat, lng } = jitterCoordinates(hp.lat, hp.lng, hp.id);
    return {
      id: hp.id,
      first_name: hp.first_name,
      city: hp.city,
      country: hp.country,
      lat,
      lng,
      is_active: a.is_active,
      is_full: a.is_full,
      accepted_count: a.accepted_count,
      capacity: a.capacity,
      whatsapp_group_url: hp.whatsapp_group_url ?? null,
      host_type: hp.host_type ?? 'domicile',
      quartier: hp.quartier ?? null,
      presentation_message: hp.presentation_message ?? null,
      is_women_only: hp.is_women_only ?? false,
      photo_url: a.is_active && hp.profile_photo_url ? (photoUrls[hp.profile_photo_url] ?? null) : null,
      activation_id: a.id,
    };
  });

  return NextResponse.json(pins, { headers: mapCacheHeaders() });
}
