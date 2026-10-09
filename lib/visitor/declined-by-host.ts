import type { SupabaseClient } from '@supabase/supabase-js';

// Quand une ambassade choisit « ne plus accueillir cette personne », le visiteur ne
// peut plus lui demander de visite, pour aucun live. Le choix est lu dans l'historique
// des demandes (`declined_permanently`), sans nouvelle table. Un simple « pas
// disponible cette fois » (`declined` seul) ne bloque rien : la personne peut
// redemander pour un autre live.

/** `true` si cette ambassade a définitivement écarté ce visiteur, ou `null` si la lecture a échoué. */
export async function wasDeclinedByHost(
  supabase: SupabaseClient,
  visitorProfileId: string,
  hostProfileId: string,
): Promise<boolean | null> {
  // Jointure interne : une ambassade a une activation par live, la liste des
  // identifiants ferait dépasser la longueur d'URL de PostgREST (cf request-limit.ts).
  const { count, error } = await supabase
    .from('contact_requests')
    .select('id, host_activations!inner(host_profile_id)', { count: 'exact', head: true })
    .eq('visitor_profile_id', visitorProfileId)
    .eq('host_activations.host_profile_id', hostProfileId)
    .eq('declined_permanently', true);

  if (error) {
    console.error('[declined-by-host] lecture de l’historique en échec', error);
    return null;
  }
  return (count ?? 0) > 0;
}

// Honnête, sans accuser : le visiteur sait que la porte est fermée ici, et qu'elle
// reste ouverte ailleurs. Pas de faux succès silencieux (cf « Modération anti-abus »).
export const DECLINED_BY_HOST_MESSAGE =
  "Cette ambassade ne peut pas vous accueillir. Vous ne pouvez pas lui renvoyer de demande, mais vous pouvez en contacter une autre.";
