/**
 * Obtient le jeton d'accès pCloud (une seule fois) et l'écrit dans .env.local.
 * Prérequis : PCLOUD_CLIENT_ID et PCLOUD_CLIENT_SECRET dans .env.local.
 *
 * Usage :
 *   node scripts/pcloud-token.js                  # affiche l'adresse d'autorisation
 *   node scripts/pcloud-token.js <code>           # échange le code contre un jeton
 *   node scripts/pcloud-token.js "<adresse de redirection complète>"   # idem (le code y est lu)
 *
 * Le jeton n'expire pas (sauf révocation). Le serveur pCloud (Europe ou États-Unis) est
 * détecté automatiquement : le jeton n'est valable que sur celui du compte.
 */
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env.local');
const envFile = fs.readFileSync(ENV_PATH, 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
}

const CLIENT_ID = env.PCLOUD_CLIENT_ID;
const CLIENT_SECRET = env.PCLOUD_CLIENT_SECRET;
const HOSTS = ['eapi.pcloud.com', 'api.pcloud.com'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('PCLOUD_CLIENT_ID / PCLOUD_CLIENT_SECRET manquants dans .env.local');
  process.exit(1);
}

function setEnv(key, value) {
  const current = fs.readFileSync(ENV_PATH, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  const next = re.test(current)
    ? current.replace(re, `${key}=${value}`)
    : `${current.replace(/\n*$/, '\n')}${key}=${value}\n`;
  fs.writeFileSync(ENV_PATH, next);
}

function extractCode(arg) {
  try {
    const code = new URL(arg).searchParams.get('code');
    if (code) return code;
  } catch {
    /* pas une adresse : c'est le code lui-même */
  }
  return arg.trim();
}

async function run() {
  const arg = process.argv[2];
  if (!arg) {
    console.log('\n1. Ouvrez cette adresse, connecté au compte pCloud dédié, et acceptez :\n');
    console.log(`   https://my.pcloud.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code\n`);
    console.log('2. Copiez le code affiché (ou l\'adresse de redirection complète), puis lancez :\n');
    console.log('   node scripts/pcloud-token.js "<code ou adresse>"\n');
    return;
  }

  const code = extractCode(arg);
  let found = null;
  for (const host of HOSTS) {
    const url = `https://${host}/oauth2_token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${encodeURIComponent(code)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (data.access_token) {
      found = { host, token: data.access_token };
      break;
    }
    console.log(`  ${host} : ${data.error ?? 'échec'} (result ${data.result ?? '?'})`);
  }
  if (!found) {
    console.error('\nÉchec. Le code est à usage unique et expire vite : relancez sans argument pour en obtenir un nouveau.');
    process.exit(1);
  }

  setEnv('PCLOUD_ACCESS_TOKEN', found.token);
  setEnv('PCLOUD_API_HOST', found.host);
  console.log(`\n✅ Jeton enregistré dans .env.local (serveur ${found.host}).`);
  console.log('   Ajoutez aussi PCLOUD_ACCESS_TOKEN et PCLOUD_API_HOST dans les variables Vercel.\n');
}

run().catch((e) => {
  console.error('Erreur :', e.message);
  process.exit(1);
});
