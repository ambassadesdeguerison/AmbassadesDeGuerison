/**
 * Génère un lien de connexion magique sans passer par Resend.
 * Utile en dev/demo quand le sender Resend est limité au sandbox (onboarding@resend.dev).
 *
 * Usage :
 *   node scripts/magic-link.js david.thery@demo.fr
 *   node scripts/magic-link.js theo.nelson.ia@gmail.com
 */
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
}

const BASE_URL   = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL    = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const email = process.argv[2];
if (!email) {
  console.error('Usage : node scripts/magic-link.js <email>');
  process.exit(1);
}

async function run() {
  const res = await fetch(`${BASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      ...(SERVICE_KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${SERVICE_KEY}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Erreur Supabase :', data);
    process.exit(1);
  }

  // L'endpoint REST retourne hashed_token à la racine (le SDK Supabase le met dans properties).
  const token = data.hashed_token ?? data.properties?.hashed_token;
  if (!token) {
    console.error('hashed_token manquant dans la réponse :', data);
    process.exit(1);
  }

  const link = `${APP_URL}/auth/confirm?token_hash=${token}&type=magiclink`;
  console.log('\n✅ Lien de connexion pour', email);
  console.log('──────────────────────────────────────────────────');
  console.log(link);
  console.log('──────────────────────────────────────────────────');
  console.log('⚠️  Valable 1 heure. Ouvrir dans le navigateur.\n');
}

run().catch(e => {
  console.error('Erreur :', e.message);
  process.exit(1);
});
