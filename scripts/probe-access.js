/**
 * Sonde de contrôle d'accès sur la base LIÉE (.env.local) — lecture seule, aucune donnée modifiée.
 *   node scripts/probe-access.js
 * Code de sortie 1 si un contrôle échoue (utilisable avant/après scripts/migration-rls-hardening.sql).
 *
 * Contrôles :
 *  1. un visiteur anonyme (clé publique) ne lit AUCUNE colonne de host_profiles, même d'un profil validé ;
 *  2. la vue host_profiles_public n'est pas lisible ;
 *  3. un candidat connecté ne peut pas écrire sa propre colonne `status` (mise à jour « no-op » : la valeur
 *     envoyée est la valeur actuelle, donc rien ne change même si le droit existait) ;
 *  4. les buckets ambassador-photos et ambassador-videos sont privés.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const env = {};
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error('Variables Supabase manquantes dans .env.local');
  process.exit(1);
}

const { createClient } = require(path.join(root, 'node_modules/@supabase/supabase-js'));
const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

(async () => {
  const anonHeaders = { apikey: ANON, ...(ANON.startsWith('sb_') ? {} : { Authorization: `Bearer ${ANON}` }) };
  const svcHeaders = { apikey: SERVICE, ...(SERVICE.startsWith('sb_') ? {} : { Authorization: `Bearer ${SERVICE}` }) };

  // 1. lecture anonyme de la table
  const sensitive = 'phone,email,address_private,lat_precise,lng_precise,admin_notes,denomination,leadership_role,intro_video_path';
  let r = await fetch(`${URL_}/rest/v1/host_profiles?select=${sensitive}&limit=5`, { headers: anonHeaders });
  const rows = r.ok ? await r.json() : [];
  check('anonyme : host_profiles illisible', Array.isArray(rows) && rows.length === 0, r.ok ? `${rows.length} ligne(s) lue(s)` : `HTTP ${r.status}`);

  // 2. vue publique
  r = await fetch(`${URL_}/rest/v1/host_profiles_public?select=*&limit=5`, { headers: anonHeaders });
  const viewRows = r.ok ? await r.json() : [];
  check('anonyme : host_profiles_public illisible', !r.ok || viewRows.length === 0, r.ok ? `${viewRows.length} ligne(s) lue(s)` : `HTTP ${r.status}`);

  // 3. écriture no-op de `status` par un candidat (session réelle)
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: candidates } = await admin.from('host_profiles').select('user_id,status,email').eq('status', 'pre_approved').limit(1);
  if (!candidates?.length) {
    console.log('SKIP  écriture de status : aucun candidat pre_approved en base');
  } else {
    const c = candidates[0];
    const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: c.email });
    const session = await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: link.properties.verification_type,
    });
    const token = session.data?.session?.access_token;
    const res = await fetch(`${URL_}/rest/v1/host_profiles?user_id=eq.${c.user_id}`, {
      method: 'PATCH',
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ status: c.status }),
    });
    const body = res.ok ? await res.json() : [];
    check('candidat : écriture directe de status refusée', !res.ok || body.length === 0, res.ok ? `${body.length} ligne(s) modifiable(s)` : `HTTP ${res.status}`);
  }

  // 4. buckets
  const buckets = await (await fetch(`${URL_}/storage/v1/bucket`, { headers: svcHeaders })).json();
  for (const id of ['ambassador-photos', 'ambassador-videos']) {
    const b = buckets.find((x) => x.id === id);
    check(`bucket ${id} privé`, Boolean(b) && b.public === false, b ? `public=${b.public}` : 'bucket absent');
  }

  process.exit(results.every(Boolean) ? 0 : 1);
})();
