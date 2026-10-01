import type { SupabaseClient } from '@supabase/supabase-js';

// Plafond anti-démarchage : un visiteur ne peut avoir plus de N demandes en cours
// pour un même live. Comptent les demandes en attente et acceptées ; une demande
// refusée (`declined`) ou restée sans réponse (`cancelled_no_response`) libère sa place.
export const COUNTED_STATUSES = ['pending', 'accepted'] as const;

/** Nombre de demandes en cours d'un visiteur pour un live, ou `null` si la lecture a échoué. */
export async function countActiveRequests(
  supabase: SupabaseClient,
  visitorProfileId: string,
  eventId: string,
): Promise<number | null> {
  // Jointure interne plutôt qu'un `.in('host_activation_id', [...])` : un live peut
  // avoir des centaines d'activations, et la liste d'identifiants ferait dépasser
  // la longueur d'URL de PostgREST.
  const { count, error } = await supabase
    .from('contact_requests')
    .select('id, host_activations!inner(event_id)', { count: 'exact', head: true })
    .eq('visitor_profile_id', visitorProfileId)
    .eq('host_activations.event_id', eventId)
    .in('status', [...COUNTED_STATUSES]);

  if (error) {
    console.error('[request-limit] comptage des demandes en échec', error);
    return null;
  }
  return count ?? 0;
}

export function requestLimitMessage(max: number): string {
  const demandes = max === 1 ? '1 demande' : `${max} demandes`;
  return `Vous avez déjà ${demandes} en cours pour ce live. Attendez la réponse d'un ambassadeur avant d'en envoyer une autre, ou écrivez-nous si vous avez besoin d'aide.`;
}
