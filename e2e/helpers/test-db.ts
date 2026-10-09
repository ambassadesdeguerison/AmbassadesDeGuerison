import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Accès service_role pour préparer et NETTOYER les données créées par les tests E2E.
// La base liée est une base de démo (cf CLAUDE.md « Phase actuelle ») : chaque test supprime
// ce qu'il a créé, identifié par une adresse e-mail jetable.

export function serviceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export function throwawayEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@demo.fr`;
}

export async function authUserByEmail(db: SupabaseClient, email: string) {
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

/** Supprime tout ce qu'un test a pu créer pour cette adresse (demandes, profils, compte auth). */
export async function purgeTestAccount(db: SupabaseClient, email: string) {
  await db.from('contact_requests').delete().eq('visitor_email', email);
  await db.from('visitor_profiles').delete().eq('email', email);
  await db.from('host_profiles').delete().eq('email', email);
  const user = await authUserByEmail(db, email);
  if (user) await db.auth.admin.deleteUser(user.id);
}
