/**
 * Seed script — DavidTheryApp (pivot live-driven v2)
 * Prérequis : avoir exécuté scripts/reset-db.sql
 * Lance : node scripts/seed.js
 */
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
}

const BASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!BASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local');
  process.exit(1);
}

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function req(method, endpoint, body) {
  const res = await fetch(`${BASE_URL}/rest/v1${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function patch(endpoint, body) {
  const res = await fetch(`${BASE_URL}/rest/v1${endpoint}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PATCH ${endpoint} → ${res.status}: ${t.slice(0, 120)}`);
  }
}

async function authReq(method, path, body) {
  const res = await fetch(`${BASE_URL}/auth/v1${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function daysFromNow(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

// Soir de live "plausible" : 18h UTC = 22h La Réunion (soirée David Théry)
// = 20h Paris (heure d'été) / 19h Paris (hiver) / 18h Abidjan.
// Évite les heures bizarres (00:23, 03:14, etc.) liées au moment du seed.
function eveningInDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(18, 0, 0, 0);
  return d.toISOString();
}

async function run() {
  console.log('Seed DavidTheryApp (pivot live-driven v2)');
  console.log(`   ${BASE_URL}\n`);

  // ── 1. Nettoyage ─────────────────────────────────────────────────────────
  console.log('→ Nettoyage...');
  const byId   = '?id=neq.00000000-0000-0000-0000-000000000000';
  const byUid  = '?user_id=neq.00000000-0000-0000-0000-000000000000';

  const tablesById = [
    'campaign_recipients', 'scheduled_campaigns', 'moderation_log',
    'live_feedbacks', 'blacklist', 'live_signals', 'testimonials',
    'contact_requests', 'host_activations', 'host_profiles', 'events',
  ];
  for (const table of tablesById) {
    const res = await fetch(`${BASE_URL}/rest/v1/${table}${byId}`, { method: 'DELETE', headers });
    if (!res.ok) console.log(`  · ${table}: ${(await res.text()).slice(0, 80)}`);
  }
  // admin_users a user_id comme PK
  const resAdm = await fetch(`${BASE_URL}/rest/v1/admin_users${byUid}`, { method: 'DELETE', headers });
  if (!resAdm.ok) console.log(`  · admin_users: ${(await resAdm.text()).slice(0, 80)}`);

  console.log('  OK tables vidées\n');

  // ── 2. Ambassadeurs ───────────────────────────────────────────────────────
  // Insérés AVANT les events → trigger trg_auto_activate_hosts crée les
  // host_activations (is_active=FALSE) dès qu'un event est inséré.
  console.log('→ Ambassadeurs (14 validés + 2 enrichment_pending + 1 pending_review dont 5 cluster Paris + 2 proches à Nantes)...');

  const hostsData = [
    {
      first_name: 'Marie', last_name: 'Dubois', email: 'marie.dubois@demo.fr',
      phone: '+33 6 12 34 56 78',
      city: 'Paris', country: 'France',
      host_type: 'individual', capacity: 15,
      address_private: '12 rue de la Paix, 75001 Paris',
      consignes: 'Sonner à l\'interphone "Dubois". Ascenseur disponible. Parking Opéra à 200m.',
      viewing_setup: 'TV salon 55 pouces', healing_challenge_done: true,
      lat: 48.8698, lng: 2.3315, quartier: 'Paris 15e', status: 'validated',
      is_women_only: true,
      presentation_message: "Chez nous, c'est simple et chaleureux — on prie ensemble avant le live autour d'un café.",
    },
    {
      first_name: 'Jean-Pierre', last_name: 'Martin', email: 'jp.martin@demo.fr',
      phone: '+33 6 98 76 54 32',
      city: 'Lyon', country: 'France',
      host_type: 'church', capacity: 80,
      address_private: '5 place Bellecour, 69002 Lyon',
      consignes: 'Entrée principale sur la place. Grande salle au premier étage. Accessible PMR.',
      whatsapp_group_url: 'https://chat.whatsapp.com/DemoGroupLyon123',
      viewing_setup: 'Vidéoprojecteur 4K + sono', church_subtype: 'permanent_open',
      healing_challenge_done: true, denomination: 'évangélique',
      lat: 45.7578, lng: 4.8320, quartier: "Lyon Presqu'île", status: 'validated',
      presentation_message: 'Grande salle accueillante, ouverte à tous. Café et thé partagés après le live.',
    },
    {
      first_name: 'Fatou', last_name: 'Diallo', email: 'fatou.diallo@demo.fr',
      phone: '+32 478 00 11 22',
      city: 'Bruxelles', country: 'Belgique',
      host_type: 'individual', capacity: 40,
      address_private: 'Avenue Louise 54, 1050 Bruxelles',
      consignes: 'Salle communautaire au rez-de-chaussée. Pas de parking sur place.',
      viewing_setup: 'Écran 40 pouces + enceinte Bluetooth',
      lat: 50.8503, lng: 4.3517, status: 'validated',
    },
    {
      first_name: 'Samuel', last_name: 'Eko', email: 'samuel.eko@demo.fr',
      phone: '+1 514 123 4567',
      city: 'Montréal', country: 'Canada',
      host_type: 'individual', capacity: 12,
      address_private: '1420 rue Sherbrooke O, Montréal, QC H3G 1K4',
      consignes: 'Appartement 4B. Buzzer : SAMUEL. Métro Guy-Concordia à 5 min.',
      viewing_setup: 'TV + projecteur portable',
      lat: 45.5017, lng: -73.5673, status: 'validated',
    },
    {
      first_name: 'Claire', last_name: 'Bernard', email: 'claire.bernard@demo.fr',
      phone: '+41 78 901 23 45',
      city: 'Genève', country: 'Suisse',
      host_type: 'individual', capacity: 8,
      address_private: 'Rue du Rhône 10, 1204 Genève',
      consignes: 'Digicode : 4521. 3ème étage, porte droite.',
      viewing_setup: 'Ordinateur portable + Chromecast sur TV',
      lat: 46.2044, lng: 6.1432, status: 'validated',
    },
    {
      first_name: 'Kofi', last_name: 'Asante', email: 'kofi.asante@demo.fr',
      phone: '+225 07 01 23 45 67',
      city: 'Abidjan', country: "Côte d'Ivoire",
      host_type: 'church', capacity: 120,
      address_private: 'Carrefour Anono, Cocody, Abidjan',
      consignes: 'Temple évangélique Lumière. Grande salle climatisée.',
      whatsapp_group_url: 'https://chat.whatsapp.com/DemoGroupAbidjan456',
      church_subtype: 'permanent_open', denomination: 'protestant',
      viewing_setup: 'Écran LED 80 pouces + sonorisation pro', healing_challenge_done: true,
      lat: 5.3600, lng: -4.0083, quartier: 'Abidjan Cocody', status: 'validated',
    },
    {
      first_name: 'Aminata', last_name: 'Sow', email: 'aminata.sow@demo.fr',
      phone: '+221 77 123 45 67',
      city: 'Dakar', country: 'Sénégal',
      host_type: 'church', capacity: 60,
      address_private: 'Quartier Almadies, Dakar',
      consignes: 'Centre communautaire Foi & Vie. Salle principale, rez-de-chaussée.',
      church_subtype: 'occasional', denomination: 'protestant',
      viewing_setup: 'Vidéoprojecteur + écran de projection 3m',
      lat: 14.7645, lng: -17.3660, status: 'validated',
    },
    // Nathalie : 2e profil women-only, isolé hors cluster Paris pour tester
    // le pin rose actif et l'icône Lucide Flower2 sur un marker individuel.
    {
      first_name: 'Nathalie', last_name: 'Blanc', email: 'nathalie.blanc@demo.fr',
      phone: '+33 6 87 65 43 21',
      city: 'Nantes', country: 'France',
      host_type: 'individual', capacity: 8,
      address_private: '14 rue Crébillon, 44000 Nantes',
      consignes: 'Sonner à l\'interphone "Blanc". Premier étage, accueil dans le salon.',
      viewing_setup: 'TV 50 pouces + barre de son', healing_challenge_done: true,
      lat: 47.2173, lng: -1.5534, quartier: 'Nantes Centre', status: 'validated',
      is_women_only: true,
    },
    // Manon : 2e ambassadeur à Nantes, à ~600m de Nathalie (coordonnées
    // proches mais volontairement PAS identiques — Nominatim géocode par
    // ville et ne renvoie pas toujours le même point d'une inscription à
    // l'autre). Reproduit le bug QA de juillet 2026 : à faible zoom, deux
    // pins à coordonnées différentes mais visuellement superposés se
    // recouvraient silencieusement sans regroupement en cluster (cf
    // components/MapPublique.tsx, migration vers leaflet.markercluster).
    {
      first_name: 'Manon', last_name: 'Girard', email: 'manon.girard@demo.fr',
      phone: '+33 6 45 67 89 01',
      city: 'Nantes', country: 'France',
      host_type: 'church', capacity: 15,
      address_private: '2 rue Fénelon, 44000 Nantes',
      consignes: 'Entrée par la cour, salle paroissiale au fond à droite.',
      viewing_setup: 'Vidéoprojecteur + enceintes', healing_challenge_done: true,
      lat: 47.2210, lng: -1.5480, quartier: 'Nantes Saint-Léonard', status: 'validated',
    },
    // ── Cluster Paris (5 ambassadeurs supplémentaires pour tester le rendu dense) ──
    {
      first_name: 'Lucas', last_name: 'Dupont', email: 'lucas.dupont@demo.fr',
      phone: '+33 6 11 22 33 44',
      city: 'Paris', country: 'France',
      host_type: 'individual', capacity: 10,
      address_private: '34 rue de Rivoli, 75004 Paris',
      consignes: 'Code immeuble : B312. 2ème étage gauche.',
      viewing_setup: 'TV 50 pouces', healing_challenge_done: true,
      lat: 48.8698, lng: 2.3315, quartier: 'Paris 10e', status: 'validated',
    },
    {
      first_name: 'Camille', last_name: 'Petit', email: 'camille.petit@demo.fr',
      phone: '+33 6 22 33 44 55',
      city: 'Paris', country: 'France',
      host_type: 'individual', capacity: 8,
      address_private: '7 rue du Temple, 75003 Paris',
      consignes: 'Interphone "Petit". Pas d\'ascenseur, 3ème étage.',
      viewing_setup: 'Ordinateur + grand écran externe',
      lat: 48.8698, lng: 2.3315, quartier: 'Paris 11e', status: 'validated',
    },
    {
      first_name: 'Antoine', last_name: 'Moreau', email: 'antoine.moreau@demo.fr',
      phone: '+33 6 33 44 55 66',
      city: 'Paris', country: 'France',
      host_type: 'church', capacity: 50,
      address_private: '22 boulevard Voltaire, 75011 Paris',
      consignes: 'Salle du bas, entrée latérale côté rue Roquette.',
      church_subtype: 'occasional', denomination: 'évangélique',
      viewing_setup: 'Vidéoprojecteur + sono', healing_challenge_done: true,
      lat: 48.8698, lng: 2.3315, quartier: 'Paris 3e', status: 'validated',
    },
    {
      first_name: 'Julie', last_name: 'Fontaine', email: 'julie.fontaine@demo.fr',
      phone: '+33 6 44 55 66 77',
      city: 'Paris', country: 'France',
      host_type: 'individual', capacity: 12,
      address_private: '58 avenue de la République, 75011 Paris',
      consignes: 'Digicode 1453. Appartement 6, bâtiment B.',
      viewing_setup: 'Smart TV 55 pouces',
      lat: 48.8698, lng: 2.3315, quartier: 'Paris 7e', status: 'validated',
    },
    {
      first_name: 'Théo', last_name: 'Garnier', email: 'theo.garnier@demo.fr',
      phone: '+33 6 55 66 77 88',
      city: 'Paris', country: 'France',
      host_type: 'individual', capacity: 6,
      address_private: '15 rue de la Roquette, 75011 Paris',
      consignes: 'Sonnette "Garnier". 1er étage, porte verte.',
      viewing_setup: 'TV + barre de son',
      lat: 48.8698, lng: 2.3315, quartier: 'Paris 20e', status: 'validated',
    },
    // Sophie : candidate pending_review (pour tester le gate self-service onboarding sur /dashboard)
    {
      first_name: 'Sophie', last_name: 'Leroux', email: 'sophie.leroux@demo.fr',
      phone: '+33 6 55 44 33 22',
      city: 'Bordeaux', country: 'France',
      host_type: 'individual', capacity: 10,
      address_private: "8 cours de l'Intendance, 33000 Bordeaux",
      consignes: null, viewing_setup: null,
      lat: 44.8378, lng: -0.5792, quartier: 'Bordeaux Chartrons', status: 'pending_review',
    },
    // Émilie : enrichment_pending (questionnaire soumis, en attente de validation admin)
    {
      first_name: 'Émilie', last_name: 'Rousseau', email: 'emilie.rousseau@demo.fr',
      phone: '+33 6 78 90 12 34',
      city: 'Toulouse', country: 'France',
      host_type: 'individual', capacity: 12,
      address_private: '24 rue Saint-Rome, 31000 Toulouse',
      consignes: 'Digicode 7842. 4ème étage sans ascenseur. Parking gratuit après 19h place du Capitole.',
      viewing_setup: 'TV 50 pouces + barre de son',
      profile_photo_url: 'seed-placeholder/emilie-rousseau/profile.jpg',
      healing_challenge_done: true,
      church_attendance: 'hebdomadaire',
      denomination: 'évangélique',
      parcours_spirituel: "Convertie il y a 8 ans après une guérison physique pendant un séminaire. Je sers dans l'équipe d'accueil de mon église locale et accompagne des nouvelles converties depuis 3 ans.",
      livres_lus: null,
      books_read: ['guerir-les-malades', 'defi-guerison'],
      trainings_done: ['defi_guerison'],
      has_seen_healings: true, has_leadership_role: true, leadership_role: "Responsable de l'équipe d'accueil",
      conferences_assistees: true,
      lat: 43.6047, lng: 1.4442, quartier: 'Toulouse Capitole', status: 'enrichment_pending',
    },
    // Pascal : enrichment_pending (église occasionnelle, dossier complet en attente)
    {
      first_name: 'Pascal', last_name: 'Nguyen', email: 'pascal.nguyen@demo.fr',
      phone: '+33 6 21 43 65 87',
      city: 'Strasbourg', country: 'France',
      host_type: 'church', capacity: 50,
      address_private: '12 rue du Faubourg de Pierre, 67000 Strasbourg',
      consignes: 'Salle communautaire au sous-sol. Entrée par la cour intérieure côté gauche. Accessible PMR.',
      whatsapp_group_url: 'https://chat.whatsapp.com/DemoGroupStrasbourg789',
      viewing_setup: 'Vidéoprojecteur Full HD + sonorisation + écran 3m',
      church_subtype: 'occasional', denomination: 'protestant',
      profile_photo_url: 'seed-placeholder/pascal-nguyen/profile.jpg',
      room_photo_urls: ['seed-placeholder/pascal-nguyen/room-1.jpg', 'seed-placeholder/pascal-nguyen/room-2.jpg'],
      healing_challenge_done: true,
      church_attendance: 'hebdomadaire',
      parcours_spirituel: "Pasteur associé de l'Église Évangélique Strasbourg-Centre depuis 5 ans. J'accompagne le ministère de prière pour les malades et anime les rencontres de jeunes adultes.",
      livres_lus: 'La puissance de la prière',
      books_read: ['guerir-les-malades', 'vraiment-libre'],
      trainings_done: ['defi_guerison', 'vraiment_libre'],
      has_seen_healings: true, has_leadership_role: true, leadership_role: 'Pasteur associé',
      conferences_assistees: true,
      lat: 48.5734, lng: 7.7521, quartier: 'Strasbourg Centre', status: 'enrichment_pending',
    },

    // ── Questionnaire enrichi v2 : trois états pour tester le parcours ─────────────
    // Ruth : pre_approved, brouillon à moitié rempli (teste « reprendre plus tard » :
    // /dashboard/questionnaire doit retrouver ces réponses). Pas encore de photos.
    {
      first_name: 'Ruth', last_name: 'Kabongo', email: 'ruth.kabongo@demo.fr',
      phone: '+33 6 34 56 78 90',
      city: 'Lille', country: 'France',
      host_type: 'individual', capacity: 8,
      address_private: '18 rue Solférino, 59000 Lille',
      consignes: 'Sonnette « Kabongo », 2e étage. Parking gratuit rue Nationale.',
      viewing_setup: 'TV 43 pouces',
      healing_challenge_done: true,
      books_read: ['guerir-les-malades', 'defi-guerison', 'joie-surnaturelle'],
      trainings_done: ['defi_guerison'],
      has_seen_healings: true,
      church_attendance: 'regular',
      lat: 50.6292, lng: 3.0573, quartier: 'Lille Centre', status: 'pre_approved',
    },
    // Daniel : pre_approved, questionnaire encore vierge (état de départ d'un nouveau candidat).
    {
      first_name: 'Daniel', last_name: 'Mbemba', email: 'daniel.mbemba@demo.fr',
      phone: '+33 6 45 67 89 01',
      city: 'Rennes', country: 'France',
      host_type: 'individual', capacity: 6,
      address_private: '7 rue de la Monnaie, 35000 Rennes',
      consignes: 'Interphone « Mbemba ». Pas d\'ascenseur, 1er étage.',
      viewing_setup: 'Ordinateur portable branché sur TV',
      lat: 48.1147, lng: -1.6794, quartier: 'Rennes Centre', status: 'pre_approved',
    },
    // Esther : enrichment_pending, réponses « non » partout (fonction de responsabilité,
    // guérisons vues) — distingue « a répondu non » de « pas répondu » côté admin.
    {
      first_name: 'Esther', last_name: 'Rakoto', email: 'esther.rakoto@demo.fr',
      phone: '+33 6 56 78 90 12',
      city: 'Montpellier', country: 'France',
      host_type: 'individual', capacity: 10,
      address_private: '31 rue Foch, 34000 Montpellier',
      consignes: 'Code 2580. Rez-de-chaussée, entrée par le jardin.',
      viewing_setup: 'TV 50 pouces',
      profile_photo_url: 'seed-placeholder/esther-rakoto/profile.jpg',
      room_photo_urls: ['seed-placeholder/esther-rakoto/room-1.jpg'],
      church_attendance: 'occasional', denomination: 'catholique',
      parcours_spirituel: "Je découvre la prière pour les malades depuis un an, après avoir suivi le Défi Guérison avec mon mari. Nous aimerions ouvrir notre salon aux voisins.",
      livres_lus: null,
      books_read: ['apprendre-a-jeuner'],
      trainings_done: [],
      has_seen_healings: false, has_leadership_role: false,
      conferences_assistees: false,
      lat: 43.6108, lng: 3.8767, quartier: 'Montpellier Écusson', status: 'enrichment_pending',
    },
  ];

  // lat_precise/lng_precise viennent normalement de l'adresse complète saisie
  // via AddressInput (mode=address, distinct du geocoding ville lat/lng) —
  // utilisées uniquement par POST /api/distance (tri par distance dans les
  // clusters). Sans elles, /api/distance retourne null pour tout le monde et
  // le badge de distance ne s'affiche jamais. Décalage déterministe (~150m)
  // pour rester réaliste sans dépendre d'un géocodage réel en seed.
  for (const h of hostsData) {
    if (h.trainings_done === undefined && h.healing_challenge_done) h.trainings_done = ['defi_guerison'];
    if (h.lat != null && h.lng != null && h.lat_precise == null) {
      h.lat_precise = h.lat + 0.0013;
      h.lng_precise = h.lng - 0.0009;
    }
  }

  const hostIds = {};
  for (const h of hostsData) {
    try {
      const [row] = await req('POST', '/host_profiles', h);
      hostIds[h.email] = row.id;
      console.log(`  OK ${h.first_name.padEnd(12)} ${h.city}, ${h.country} — cap ${h.capacity} — ${h.status}`);
    } catch (e) {
      console.log(`  ERR ${h.first_name}: ${e.message.slice(0, 120)}`);
    }
  }

  // Comptes auth pour chaque ambassadeur démo + lien user_id sur host_profiles.
  // Sans ça, le dashboard (`.eq('user_id', user.id)`) ne trouve pas le profil
  // après magic link et redirige vers `/inscription`.
  console.log('\n→ Comptes auth ambassadeurs...');
  let authUsersCache = [];
  try {
    const res = await authReq('GET', '/admin/users?per_page=1000');
    authUsersCache = res?.users ?? [];
  } catch (e) {
    console.log(`  Impossible de lister les utilisateurs Auth: ${e.message.slice(0, 80)}`);
  }
  for (const h of hostsData) {
    try {
      const existing = authUsersCache.find(u => u.email === h.email);
      const userId = existing?.id ?? (await authReq('POST', '/admin/users', {
        email: h.email,
        email_confirm: true,
        user_metadata: { role: 'host' },
      })).id;
      await patch(`/host_profiles?email=eq.${encodeURIComponent(h.email)}`, { user_id: userId });
      console.log(`  OK ${h.first_name.padEnd(12)} ${existing ? '(auth existant)' : '(auth créé)'}`);
    } catch (e) {
      console.log(`  ERR ${h.first_name}: ${e.message.slice(0, 120)}`);
    }
  }

  const validatedHosts = hostsData.filter(h => h.status === 'validated');

  // ── 3. Événements ─────────────────────────────────────────────────────────
  // Le trigger trg_auto_activate_hosts crée les host_activations (is_active=FALSE)
  // pour chaque hôte validé dès qu'un event est inséré.
  console.log('\n→ Événements...');

  const [evtOld] = await req('POST', '/events', {
    title: 'Live Guérison — Foi sans frontières',
    description: 'Live de guérison et de délivrance animé depuis La Réunion.',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    event_date: daysAgo(60),
  });
  console.log(`  OK [J-60] ${evtOld.title}`);

  const [evtMid] = await req('POST', '/events', {
    title: 'Live Guérison — Touché par la grâce',
    description: 'Une soirée de prière et de guérisons avec David Théry.',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    event_date: daysAgo(30),
  });
  console.log(`  OK [J-30] ${evtMid.title}`);

  const [evtRecent] = await req('POST', '/events', {
    title: 'Nuit de Prière — Souffle nouveau',
    description: 'Nuit de prière collective depuis les ambassades du monde entier.',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    live_link: 'https://youtube.com/live/example-recent',
    event_date: daysAgo(7),
  });
  console.log(`  OK [J-7]  ${evtRecent.title}  (event principal pour démo modération)`);

  const [evtFutur] = await req('POST', '/events', {
    title: "Live Guérison — La puissance de l'Amour",
    description: "Rejoignez David Théry pour une soirée de prière collective depuis votre ambassade locale.",
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    live_link: 'https://youtube.com/live/example15',
    event_date: eveningInDays(10),
  });
  console.log(`  OK [J+10] ${evtFutur.title}  (prochain live)`);

  // ── 4. Activer les hôtes pour les events passés ───────────────────────────
  // is_active=FALSE par défaut (trigger). On simule que tous les ambassadeurs
  // ont cliqué "J'accueille" pour les 3 events passés.
  console.log('\n→ Activation hôtes (events passés)...');

  const countsOld    = { Marie: 12, 'Jean-Pierre': 65, Fatou: 30, Samuel: 8,  Claire: 6, Kofi: 90,  Aminata: 45, Lucas: 9, Camille: 7, Antoine: 38, Julie: 11, Théo: 5 };
  const countsMid    = { Marie: 14, 'Jean-Pierre': 78, Fatou: 35, Samuel: 11, Claire: 7, Kofi: 110, Aminata: 52, Lucas: 10, Camille: 8, Antoine: 42, Julie: 12, Théo: 6 };

  for (const [evtId, counts, label] of [
    [evtOld.id, countsOld, 'J-60'],
    [evtMid.id, countsMid, 'J-30'],
  ]) {
    for (const h of validatedHosts) {
      const hid = hostIds[h.email];
      if (!hid) continue;
      const accepted = counts[h.first_name] ?? 0;
      try {
        await patch(
          `/host_activations?host_profile_id=eq.${hid}&event_id=eq.${evtId}`,
          { is_active: true, accepted_count: accepted, is_full: accepted >= h.capacity }
        );
      } catch (e) {
        console.log(`  ERR [${label}] ${h.first_name}: ${e.message.slice(0, 80)}`);
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`  OK [${label}] ${total} participants, tous hôtes is_active=TRUE`);
  }

  // Event J-7 : activer tous les hôtes (les contacts seront créés ensuite)
  for (const h of validatedHosts) {
    const hid = hostIds[h.email];
    if (!hid) continue;
    try {
      await patch(
        `/host_activations?host_profile_id=eq.${hid}&event_id=eq.${evtRecent.id}`,
        { is_active: true }
      );
    } catch (e) {
      console.log(`  ERR [J-7] ${h.first_name}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`  OK [J-7]  ${validatedHosts.length} hôtes activés (is_active=TRUE)`);

  // Event J+10 : 5 ambassadeurs ont cliqué "J'accueille" dont 3 parisiens pour le cluster
  // + Nathalie et Manon à Nantes (coordonnées proches mais distinctes — cf
  // hostsData plus haut) toutes deux actives simultanément, pour tester le
  // clustering par proximité pixel sur la carte publique.
  const activatedForFutur = [
    'marie.dubois@demo.fr', 'jp.martin@demo.fr', 'kofi.asante@demo.fr',
    'lucas.dupont@demo.fr', 'camille.petit@demo.fr', 'antoine.moreau@demo.fr',
    'nathalie.blanc@demo.fr', 'manon.girard@demo.fr',
  ];
  for (const email of activatedForFutur) {
    const hid = hostIds[email];
    if (!hid) continue;
    try {
      await patch(
        `/host_activations?host_profile_id=eq.${hid}&event_id=eq.${evtFutur.id}`,
        { is_active: true }
      );
    } catch (e) {
      console.log(`  ERR [J+10] ${email}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`  OK [J+10] 8/14 hôtes activés dont 3 parisiens + Nathalie & Manon à Nantes (6 en attente)`);

  // ── 5. Demandes de contact (event J-7, hôtes actifs) ──────────────────────
  console.log('\n→ Demandes de contact...');

  const activationsRecent = await req('GET',
    `/host_activations?event_id=eq.${evtRecent.id}&is_active=eq.true&select=id,host_profile_id`
  );
  const actBy = email => activationsRecent.find(a => a.host_profile_id === hostIds[email]);

  const contactsData = [
    {
      host: 'marie.dubois@demo.fr', first: 'Pierre', email: 'pierre.moreau@mail.com',
      phone: '+33612345678', nb_personnes: 2,
      msg: 'Je viens avec ma femme.', status: 'pending',
    },
    {
      host: 'marie.dubois@demo.fr', first: 'Nathalie', email: 'nathalie.v@mail.com',
      phone: '+33645789632', nb_personnes: 1,
      msg: null, status: 'pending',
    },
    {
      host: 'marie.dubois@demo.fr', first: 'Luc', email: 'luc.fontaine@mail.com',
      phone: '+33688112233', nb_personnes: 1,
      msg: "Premier live pour moi, hâte d'y être !", status: 'accepted',
    },
    {
      host: 'jp.martin@demo.fr', first: 'Ahmed', email: 'ahmed.mansour@mail.com',
      phone: '+33698765432', nb_personnes: 1,
      msg: "Merci pour cette initiative, je viens seul.", status: 'accepted',
    },
    {
      host: 'jp.martin@demo.fr', first: 'Isabelle', email: 'isabelle.r@mail.com',
      phone: '+33671234598', nb_personnes: 5,
      msg: "Ma famille sera là aussi, 5 personnes.", status: 'pending',
    },
    {
      host: 'fatou.diallo@demo.fr', first: 'Laure', email: 'laure.d@mail.com',
      phone: '+32488334455', nb_personnes: 1,
      msg: null, status: 'declined',
    },
    {
      host: 'fatou.diallo@demo.fr', first: 'Thomas', email: 'thomas.b@mail.com',
      phone: '+32478001122', nb_personnes: 1,
      msg: "Je suis en déplacement à Bruxelles ce soir.", status: 'pending',
    },
    {
      host: 'samuel.eko@demo.fr', first: 'Emmanuel', email: 'emmanuel.b@mail.com',
      phone: '+15141234567', nb_personnes: 1,
      msg: "J'habite à 10 minutes, avec plaisir !", status: 'accepted',
    },
    {
      host: 'kofi.asante@demo.fr', first: 'Bénédicte', email: 'benedicte.k@mail.com',
      phone: '+2250701234567', nb_personnes: 15,
      msg: "Notre groupe viendra en bus depuis Yopougon.", status: 'pending',
    },
    {
      host: 'aminata.sow@demo.fr', first: 'Oumar', email: 'oumar.dia@mail.com',
      phone: '+221771234567', nb_personnes: 3,
      msg: "Présent avec ma communauté.", status: 'accepted',
    },
  ];

  let contactCreated = 0;
  const contactIdMap = {};
  for (const c of contactsData) {
    const act = actBy(c.host);
    if (!act) { console.log(`  · Activation manquante pour ${c.first} (${c.host})`); continue; }
    try {
      // Insertion en 'pending' puis PATCH vers le statut final : le trigger
      // fn_contact_request_count_update n'incrémente accepted_count que sur le
      // passage à 'accepted' (UPDATE OF status), jamais à la création.
      const [row] = await req('POST', '/contact_requests', {
        host_activation_id: act.id,
        visitor_first_name: c.first,
        visitor_email: c.email,
        visitor_phone: c.phone,
        nb_personnes: c.nb_personnes,
        visitor_message: c.msg,
        status: 'pending',
      });
      if (c.status !== 'pending') {
        await patch(`/contact_requests?id=eq.${row.id}`, { status: c.status });
      }
      contactIdMap[c.email] = row.id;
      contactCreated++;
    } catch (e) {
      console.log(`  ERR ${c.first}: ${e.message.slice(0, 120)}`);
    }
  }
  console.log(`  OK ${contactCreated} demandes créées (trigger accepted_count actif sur passage à accepted)`);

  // ── 6. Témoignages ────────────────────────────────────────────────────────
  console.log('\n→ Témoignages...');

  const tOld = [
    { email: 'kofi.asante@demo.fr', visible: true,
      content: "Abidjan était en feu. Les gens priaient debout, les bras levés. Un homme qui boitait depuis des années a recommencé à marcher normalement pendant la prière. Nous avons vu de nos yeux." },
    { email: 'samuel.eko@demo.fr', visible: true,
      content: "Un frère de Montréal qui traversait une dépression profonde depuis six mois m'a dit après le live : 'Pour la première fois depuis longtemps, j'ai envie de me lever.' Dieu est là." },
  ];

  const tMid = [
    { email: 'marie.dubois@demo.fr', visible: true,
      content: "Nous étions 14 ce soir dans mon salon. À un moment de prière intense, une sœur qui souffrait de migraines chroniques a senti sa tête se libérer complètement. Elle pleurait de joie." },
    { email: 'fatou.diallo@demo.fr', visible: true,
      content: "Mon mari était sceptique. Il est venu par amour pour moi. À la fin du live il priait les mains levées, les yeux fermés. Il m'a dit : 'Je ne sais pas ce que j'ai ressenti, mais je veux revenir.'" },
    { email: 'claire.bernard@demo.fr', visible: true,
      content: "7 personnes dans mon appartement. Ambiance intime mais présence forte. Une amie souffrant d'insomnies chroniques a dormi d'un trait cette nuit-là — première fois depuis des mois." },
  ];

  const tRecent = [
    { email: 'jp.martin@demo.fr', visible: true,
      content: "Plus de 78 personnes réunies dans notre église. Pendant la prière des mains levées, des gens témoignaient de douleurs qui disparaissaient en temps réel. Une atmosphère de ferveur comme rarement vécue depuis des années." },
    { email: 'aminata.sow@demo.fr', visible: true,
      content: "Dakar était connecté ! 58 frères et sœurs chez nous. Quand David a déclaré la guérison pour les maladies de dos, trois personnes ont immédiatement témoigné que la douleur avait quitté. Nous avons chanté jusqu'à minuit." },
    { email: 'kofi.asante@demo.fr', visible: true,
      content: "Le Seigneur a visité Abidjan cette nuit. 118 présents. Un homme sourd d'une oreille depuis l'enfance a commencé à entendre pendant la prière de David. Nous avons tous pleuré. Que son nom soit béni." },
    { email: 'marie.dubois@demo.fr', visible: true,
      content: "15 présents à Paris. La soirée était puissante. Une participante qui n'avait pas pu travailler depuis 3 semaines à cause de douleurs dorsales s'est levée et a dit : 'C'est parti.' On attendait déjà le prochain live." },
    { email: 'samuel.eko@demo.fr', visible: false,
      content: "Live intense à Montréal. Petite assemblée mais Dieu était là. Un ami qui luttait contre l'anxiété depuis des mois est reparti avec une paix inexplicable. Il m'a texté le lendemain : 'Je vais bien.' C'est tout." },
  ];

  const tAnon = [
    { event_id: evtRecent.id, visible: true,
      visitor_name: 'Grâce', submitter_city: 'Nantes',
      content: "Je regardais seule chez moi. Quand David a prié pour les genoux, les miens brûlaient et puis d'un coup, plus rien. Je n'osais pas y croire. J'ai recommencé à monter les escaliers sans m'arrêter." },
    { event_id: evtRecent.id, visible: true,
      visitor_name: 'Patrick', submitter_city: 'Marseille',
      content: "C'est ma première fois sur un live de David. Ma sœur m'avait dit de regarder. Je suis athée. Ce que j'ai ressenti pendant la prière, je ne peux pas l'expliquer. Je cherche des réponses." },
    { event_id: evtMid.id, visible: true,
      visitor_name: 'Christelle', submitter_city: 'Douala',
      content: "Nous regardions à plusieurs dans un appartement à Douala. L'atmosphère était lourde et tout d'un coup une paix est descendue. Ma voisine qui avait des problèmes aux yeux depuis longtemps a pleuré et dit : 'Je vois mieux.'" },
    { event_id: evtRecent.id, visible: false,
      visitor_name: null, submitter_city: null,
      content: "J'ai suivi le live depuis mon téléphone dans le métro. Ce n'est pas le meilleur endroit pour prier mais j'ai quand même senti quelque chose. Je reviendrai depuis chez moi la prochaine fois." },
  ];

  let tCreated = 0;
  for (const t of tOld) {
    const hid = hostIds[t.email];
    if (!hid) continue;
    try {
      await req('POST', '/testimonials', { host_profile_id: hid, event_id: evtOld.id, content: t.content, is_visible: t.visible });
      tCreated++;
    } catch (e) { console.log(`  ERR tOld ${t.email}: ${e.message.slice(0, 80)}`); }
  }
  for (const t of tMid) {
    const hid = hostIds[t.email];
    if (!hid) continue;
    try {
      await req('POST', '/testimonials', { host_profile_id: hid, event_id: evtMid.id, content: t.content, is_visible: t.visible });
      tCreated++;
    } catch (e) { console.log(`  ERR tMid ${t.email}: ${e.message.slice(0, 80)}`); }
  }
  for (const t of tRecent) {
    const hid = hostIds[t.email];
    if (!hid) continue;
    try {
      await req('POST', '/testimonials', { host_profile_id: hid, event_id: evtRecent.id, content: t.content, is_visible: t.visible });
      tCreated++;
    } catch (e) { console.log(`  ERR tRecent ${t.email}: ${e.message.slice(0, 80)}`); }
  }
  for (const t of tAnon) {
    try {
      await req('POST', '/testimonials', {
        host_profile_id: null, contact_request_id: null,
        visitor_name: t.visitor_name, submitter_city: t.submitter_city,
        event_id: t.event_id, content: t.content, is_visible: t.visible,
      });
      tCreated++;
    } catch (e) { console.log(`  ERR tAnon ${t.visitor_name ?? '(sans nom)'}: ${e.message.slice(0, 80)}`); }
  }

  const visibleCount = [...tOld, ...tMid, ...tRecent, ...tAnon].filter(t => t.visible).length;
  const pendingCount = [...tOld, ...tMid, ...tRecent, ...tAnon].filter(t => !t.visible).length;
  console.log(`  OK ${tCreated} témoignages — ${visibleCount} publiés, ${pendingCount} en attente`);

  // ── 7. Signaux live (event J-7) ───────────────────────────────────────────
  console.log('\n→ Signaux live...');

  const signalsData = [
    { email: 'jp.martin@demo.fr',    status: 'approved', link_shared: true,
      description: 'Salle pleine. Les gens prient debout, les bras levés. Ambiance de ferveur exceptionnelle.' },
    { email: 'kofi.asante@demo.fr',  status: 'approved', link_shared: true,
      description: 'Abidjan en feu ! 118 présents. Guérison témoignée en direct — homme sourd qui entend. Gloire à Dieu.' },
    { email: 'aminata.sow@demo.fr',  status: 'pending', link_shared: false,
      description: '58 frères et sœurs à Dakar. Trois témoignages de guérison de dos pendant la prière.' },
    { email: 'marie.dubois@demo.fr', status: 'used', link_shared: true,
      description: 'Paris, 15 présents. Atmosphère de paix. Une sœur libérée de migraines chroniques.' },
    { email: 'fatou.diallo@demo.fr', status: 'declined', link_shared: false,
      description: 'Bruxelles — live difficile à suivre ce soir, connexion instable. On revient au prochain.' },
  ];

  let sigCreated = 0;
  for (const s of signalsData) {
    const hid = hostIds[s.email];
    if (!hid) continue;
    try {
      await req('POST', '/live_signals', {
        host_profile_id: hid, event_id: evtRecent.id,
        description: s.description, status: s.status, link_shared: s.link_shared,
      });
      sigCreated++;
      const host = hostsData.find(h => h.email === s.email);
      console.log(`  OK ${host.first_name.padEnd(12)} [${s.status}]`);
    } catch (e) { console.log(`  ERR ${s.email}: ${e.message.slice(0, 80)}`); }
  }
  console.log(`  OK ${sigCreated} signaux créés`);

  // ── 8. Feedbacks post-live (event J-7) ────────────────────────────────────
  console.log('\n→ Feedbacks post-live...');

  const feedbacksData = [
    {
      event_id: evtRecent.id, host_profile_id: hostIds['marie.dubois@demo.fr'],
      contact_request_id: contactIdMap['luc.fontaine@mail.com'] ?? null,
      visitor_email: 'luc.fontaine@mail.com',
      rating_welcome: 5, rating_friendliness: 5, rating_listening: 4, rating_prayer: 5,
      free_text: "Marie nous a très bien accueillis. Le temps de prière était puissant.",
      reported: false, direction: 'visitor_to_host',
    },
    {
      event_id: evtRecent.id, host_profile_id: hostIds['jp.martin@demo.fr'],
      contact_request_id: contactIdMap['ahmed.mansour@mail.com'] ?? null,
      visitor_email: 'ahmed.mansour@mail.com',
      rating_welcome: 4, rating_friendliness: 5, rating_listening: 5, rating_prayer: 5,
      free_text: "Soirée extraordinaire à Lyon. Je reviendrai pour le prochain live.",
      reported: false, direction: 'visitor_to_host',
    },
    {
      event_id: evtRecent.id, host_profile_id: hostIds['fatou.diallo@demo.fr'],
      contact_request_id: null,
      visitor_email: 'thomas.b@mail.com',
      rating_welcome: 2, rating_friendliness: 2, rating_listening: 1, rating_prayer: 2,
      free_text: "L'accueil était froid. Je ne me suis pas senti à l'aise.",
      reported: true, report_reason: "L'hôte a fait des commentaires déplacés sur ma foi.",
      report_status: 'pending', direction: 'visitor_to_host',
    },
  ];

  let fbCreated = 0;
  for (const fb of feedbacksData) {
    try {
      await req('POST', '/live_feedbacks', fb);
      fbCreated++;
    } catch (e) { console.log(`  ERR feedback ${fb.visitor_email}: ${e.message.slice(0, 80)}`); }
  }
  console.log(`  OK ${fbCreated} feedbacks créés (1 signalement en attente de triage)`);

  // ── 9. Comptes admin (auth + admin_users) ─────────────────────────────────
  console.log('\n→ Comptes admin...');

  const admins = [
    { email: 'david.thery@demo.fr',     role: 'super_admin', label: 'David Théry (démo)' },
    { email: 'theo.nelson.ia@gmail.com', role: 'super_admin', label: 'Théophile (dev)'    },
  ];

  let existingAuthUsers = [];
  try {
    const res = await authReq('GET', '/admin/users?per_page=1000');
    existingAuthUsers = res?.users ?? [];
  } catch (e) {
    console.log(`  Impossible de lister les utilisateurs Auth: ${e.message.slice(0, 80)}`);
  }

  for (const admin of admins) {
    const existing = existingAuthUsers.find(u => u.email === admin.email);
    let userId;
    try {
      if (existing) {
        userId = existing.id;
        // Garder user_metadata.role pour compat avec les routes non encore migrées
        await authReq('PUT', `/admin/users/${existing.id}`, {
          user_metadata: { ...(existing.user_metadata ?? {}), role: 'admin' },
        });
        console.log(`  OK ${admin.label} — auth confirmé`);
      } else {
        const created = await authReq('POST', '/admin/users', {
          email: admin.email,
          email_confirm: true,
          user_metadata: { role: 'admin' },
        });
        userId = created.id;
        console.log(`  OK ${admin.label} — créé`);
      }

      // Insérer dans admin_users (source de vérité RLS)
      if (userId) {
        const res = await fetch(`${BASE_URL}/rest/v1/admin_users`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: userId, role: admin.role }),
        });
        if (!res.ok) {
          console.log(`  ERR admin_users ${admin.label}: ${(await res.text()).slice(0, 80)}`);
        } else {
          console.log(`  OK ${admin.label} — admin_users role=${admin.role}`);
        }
      }
    } catch (e) {
      console.log(`  ERR ${admin.label}: ${e.message.slice(0, 100)}`);
    }
  }
  console.log('  → node scripts/magic-link.js <email> pour se connecter\n');

  // ── 10. Config onboarding ─────────────────────────────────────────────────
  console.log('→ Config onboarding...');
  try {
    const res = await fetch(`${BASE_URL}/rest/v1/onboarding_config`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, video_url: '', pdf_url: '/docs/guide-ambassade.pdf' }),
    });
    if (res.ok) {
      console.log('  OK Config initialisée (video_url vide → fallback config/onboarding.ts)');
    } else {
      console.log(`  ERR ${(await res.text()).slice(0, 80)}`);
    }
  } catch (e) { console.log(`  ERR ${e.message.slice(0, 80)}`); }

  // ── 11. Config timing ─────────────────────────────────────────────────────
  console.log('→ Config timing...');
  try {
    const res = await fetch(`${BASE_URL}/rest/v1/event_timing_config`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1 }),
    });
    if (res.ok) {
      console.log('  OK Config timing initialisée (valeurs par défaut)');
    } else {
      console.log(`  ERR ${(await res.text()).slice(0, 80)}`);
    }
  } catch (e) { console.log(`  ERR ${e.message.slice(0, 80)}`); }

  // ── 12. Résumé ────────────────────────────────────────────────────────────
  console.log('\nRésumé :');
  const tables = [
    ['events',            'events'],
    ['host_profiles',     'host_profiles'],
    ['admin_users',       'admin_users?select=user_id'],
    ['host_activations',  'host_activations'],
    ['contact_requests',  'contact_requests'],
    ['testimonials',      'testimonials'],
    ['live_signals',      'live_signals'],
    ['live_feedbacks',    'live_feedbacks'],
  ];
  for (const [label, endpoint] of tables) {
    const res = await fetch(`${BASE_URL}/rest/v1/${endpoint}`, {
      headers: { ...headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' },
    });
    const total = (res.headers.get('content-range') ?? '?/?').split('/')[1] ?? '?';
    console.log(`  ${label.padEnd(22)} ${total} lignes`);
  }

  console.log('\nSeed terminé !');
  console.log('   → npm run dev → http://localhost:3000');
  console.log('   → /admin/live          : 5 signaux (approved/pending/used/declined)');
  console.log('   → /admin/temoignages   : 2 témoignages en attente de modération');
  console.log('   → /admin/feedback      : 1 signalement pending (Thomas B / Fatou)');
  console.log('   → /temoignages         : 10 publiés, filtre 3 events');
  console.log('   → J+10 live            : 8/14 ambassades activées (Marie, JP, Kofi + 3 cluster Paris + Nathalie & Manon à Nantes)');
  console.log('   → carte publique       : Nathalie & Manon (Nantes, ~600m d\'écart) testent le clustering leaflet.markercluster');
}

run().catch(e => {
  console.error('\nErreur:', e.message);
  process.exit(1);
});
