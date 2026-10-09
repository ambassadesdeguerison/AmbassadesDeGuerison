import { createServiceClient } from '@/lib/supabase/server';

export interface FeaturedTestimonial {
  content: string;
  displayName: string | null;
}

// Témoignage vedette — jamais d'état vide visible (design doc Pass 2) :
// fallback sur le témoignage global le plus récent si aucun n'est publié
// pour le prochain live spécifiquement (même requête que /temoignages,
// sans filtre event). Partagé par /decouvrir et l'onglet « Guide » de /mon-espace.
export async function getFeaturedTestimonial(): Promise<FeaturedTestimonial | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('testimonials')
    .select('content, visitor_name, submitter_city, host_profile:host_profiles(first_name, city)')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const hp = Array.isArray(data.host_profile) ? data.host_profile[0] : data.host_profile;
  const displayName = hp
    ? `${hp.first_name}, ${hp.city}`
    : data.visitor_name
      ? `${data.visitor_name}${data.submitter_city ? `, ${data.submitter_city}` : ''}`
      : null;

  return { content: data.content as string, displayName };
}
