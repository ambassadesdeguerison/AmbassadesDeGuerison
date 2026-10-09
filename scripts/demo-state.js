/**
 * Pilotage des états de démo — DavidTheryApp
 *
 * L'app affiche 4 UI distincts selon le timing du live. Ce script
 * manipule les event_date en base pour basculer entre chaque état.
 *
 * Usage :
 *   node scripts/demo-state.js live      → 🔴 Live en cours  (EventBanner rouge)
 *   node scripts/demo-state.js soon      → ⏱ Prochain dans 3j (countdown)
 *   node scripts/demo-state.js upcoming  → 📅 Prochain dans 10j (date affichée)
 *   node scripts/demo-state.js past      → ⏪ Aucun futur (dernier live il y a X jours)
 *   node scripts/demo-state.js status    → Affiche l'état actuel sans rien modifier
 *
 * Prérequis : .env.local avec NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
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
  apikey: SERVICE_KEY,
  ...(SERVICE_KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${SERVICE_KEY}` }),
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function req(method, endpoint, body) {
  const res = await fetch(`${BASE_URL}/rest/v1${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function patch(endpoint, body) {
  const res = await fetch(`${BASE_URL}/rest/v1${endpoint}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PATCH ${endpoint} → ${res.status}: ${t.slice(0, 200)}`);
  }
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function daysFromNow(d) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
}

function daysAgo(d) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

function describeState(pastEvents, futureEvents) {
  const WINDOW_H = parseFloat(env.NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS ?? '4');
  const now = Date.now();
  const liveEvent = pastEvents.find(e => {
    const ms = new Date(e.event_date).getTime();
    return ms <= now && now <= ms + WINDOW_H * 3600 * 1000;
  });
  const nextEvent = futureEvents[0] ?? null;
  const lastEvent = pastEvents[pastEvents.length - 1] ?? null;

  if (liveEvent) {
    const startedMinsAgo = Math.round((now - new Date(liveEvent.event_date).getTime()) / 60000);
    return `🔴 LIVE EN COURS — "${liveEvent.title}" (démarré il y a ${startedMinsAgo} min)`;
  }
  if (nextEvent) {
    const diffMs = new Date(nextEvent.event_date).getTime() - now;
    const diffDays = diffMs / (1000 * 3600 * 24);
    if (diffDays < 7) {
      const d = Math.floor(diffDays);
      const h = Math.floor((diffDays - d) * 24);
      const m = Math.floor(((diffDays - d) * 24 - h) * 60);
      return `⏱ PROCHAIN DANS <7J — dans ${d}j ${h}h ${m}min — "${nextEvent.title}"`;
    }
    return `📅 PROCHAIN DANS ≥7J — le ${new Date(nextEvent.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — "${nextEvent.title}"`;
  }
  if (lastEvent) {
    const diffDays = Math.round((now - new Date(lastEvent.event_date).getTime()) / (1000 * 3600 * 24));
    return `⏪ ENTRE DEUX LIVES — dernier il y a ${diffDays} jours — "${lastEvent.title}"`;
  }
  return '❓ AUCUN ÉVÉNEMENT en base';
}

async function run() {
  const target = process.argv[2];
  const validTargets = ['live', 'soon', 'upcoming', 'past', 'status'];

  if (!target || !validTargets.includes(target)) {
    console.log('Usage : node scripts/demo-state.js <état>');
    console.log('');
    console.log('États disponibles :');
    console.log('  live      → 🔴 Live en cours  — EventBanner rouge, signaux actifs');
    console.log('  soon      → ⏱ Prochain dans 3j — countdown');
    console.log('  upcoming  → 📅 Prochain dans 10j — date affichée (état par défaut du seed)');
    console.log('  past      → ⏪ Aucun futur — "Dernier live il y a X jours"');
    console.log('  status    → Affiche l\'état actuel sans modifier la base');
    process.exit(1);
  }

  const allEvents = await req('GET', '/events?select=id,title,event_date&order=event_date.asc');

  const now = Date.now();
  const pastEvents = allEvents.filter(e => new Date(e.event_date).getTime() <= now);
  const futureEvents = allEvents.filter(e => new Date(e.event_date).getTime() > now);

  console.log('\nDavidTheryApp — Pilotage état démo');
  console.log(`   ${BASE_URL}`);
  console.log(`\nÉtat actuel : ${describeState(pastEvents, futureEvents)}`);
  console.log(`   ${allEvents.length} événements en base (${pastEvents.length} passés, ${futureEvents.length} futurs)\n`);

  if (target === 'status') return;

  // ── L'événement "démo live" = l'event actuellement dans la fenêtre live (si on y est),
  // sinon le plus récent parmi les passés hors-fenêtre. C'est lui qu'on animera.
  // ── L'événement "futur démo" = le premier événement futur.
  const WINDOW_H = parseFloat(env.NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS ?? '4');
  const liveWindowEvent = allEvents.find(e => {
    const ms = new Date(e.event_date).getTime();
    return ms <= now && now <= ms + WINDOW_H * 3600 * 1000;
  }) ?? null;
  const outsideWindow = pastEvents.filter(e => {
    const ms = new Date(e.event_date).getTime();
    return now > ms + WINDOW_H * 3600 * 1000;
  });
  // Priorité : event en cours → sinon le plus récent hors-fenêtre → fallback dernier passé
  const demoLiveEvent = liveWindowEvent ?? outsideWindow[outsideWindow.length - 1] ?? pastEvents[pastEvents.length - 1];
  // demoFutureEvent : 1er futur, ou le 2e plus récent parmi les passés hors-fenêtre
  // (cas "past" : le futur a été déplacé au passé → on le retrouve comme 2e de outsideWindow)
  const demoFutureEvent =
    futureEvents[0] ??
    (outsideWindow.length >= 2 ? outsideWindow[outsideWindow.length - 2] : null);

  if (!demoLiveEvent) {
    console.error('Aucun événement passé trouvé. Relancez node scripts/seed.js d\'abord.');
    process.exit(1);
  }

  // ────────────────────────────────────────────────────────────────────────────

  if (target === 'live') {
    console.log('→ Passage en état LIVE EN COURS...');
    // 1. Déplacer l'événement principal à now - 2h, ouvrir la fenêtre d'inscription
    const newDate = hoursFromNow(-2);
    await patch(`/events?id=eq.${demoLiveEvent.id}`, {
      event_date: newDate,
      registration_opens_at: daysAgo(8),
      registration_closes_at: hoursFromNow(4),
    });
    console.log(`  OK event "${demoLiveEvent.title}" → now - 2h (inscriptions ouvertes)`);

    // 2. Activer tous les hôtes pour cet événement (is_active=TRUE)
    const activations = await req(
      'GET',
      `/host_activations?event_id=eq.${demoLiveEvent.id}&select=id,host_profile_id,is_active`
    );
    let activated = 0;
    for (const act of activations) {
      if (!act.is_active) {
        await patch(`/host_activations?id=eq.${act.id}`, { is_active: true });
      }
      activated++;
    }
    console.log(`  OK ${activated} host_activations is_active=TRUE`);

    // 3. Si un événement futur existe, le déplacer à J+10 pour ne pas interférer
    if (demoFutureEvent) {
      await patch(`/events?id=eq.${demoFutureEvent.id}`, { event_date: daysFromNow(10) });
      console.log(`  OK event futur "${demoFutureEvent.title}" → J+10`);
    }

    console.log('\n✅ État LIVE EN COURS actif.');
    console.log('   EventBanner : "Live en cours — rejoignez-nous" (rouge, Radio pulsant)');
    console.log('   Dashboard ambassadeur : section Signaux visible');
    console.log('   Carte : pins activés avec CTA "Contacter"');
    console.log(`\n   → Pour revenir : node scripts/demo-state.js upcoming`);
    return;
  }

  // ────────────────────────────────────────────────────────────────────────────

  if (target === 'soon') {
    console.log('→ Passage en état PROCHAIN DANS 3 JOURS...');
    // 1. Remettre l'événement principal à J-7, fermer la fenêtre d'inscription
    await patch(`/events?id=eq.${demoLiveEvent.id}`, {
      event_date: daysAgo(7),
      registration_opens_at: daysAgo(14),
      registration_closes_at: daysAgo(7),
    });
    console.log(`  OK event "${demoLiveEvent.title}" → J-7`);

    // 2. Déplacer (ou créer s'il n'existe pas) l'événement futur à J+3
    if (demoFutureEvent) {
      await patch(`/events?id=eq.${demoFutureEvent.id}`, { event_date: daysFromNow(3) });
      console.log(`  OK event futur "${demoFutureEvent.title}" → J+3`);
    } else {
      // Aucun événement futur : en créer un temporaire
      await req('POST', '/events', {
        title: 'Live Guérison — Prochainement',
        description: 'Live créé par demo-state.js pour démonstration.',
        youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        event_date: daysFromNow(3),
      });
      console.log('  OK événement futur créé (J+3)');
    }

    console.log('\n✅ État PROCHAIN DANS 3J actif.');
    console.log('   EventBanner : countdown "Prochain live dans 3j 0h 0min"');
    console.log('\n   → Pour revenir : node scripts/demo-state.js upcoming');
    return;
  }

  // ────────────────────────────────────────────────────────────────────────────

  if (target === 'upcoming') {
    console.log('→ Restauration état par défaut du seed (J-7 + J+10)...');
    await patch(`/events?id=eq.${demoLiveEvent.id}`, {
      event_date: daysAgo(7),
      registration_opens_at: daysAgo(14),
      registration_closes_at: daysAgo(7),
    });
    console.log(`  OK event "${demoLiveEvent.title}" → J-7`);

    if (demoFutureEvent) {
      await patch(`/events?id=eq.${demoFutureEvent.id}`, { event_date: daysFromNow(10) });
      console.log(`  OK event futur "${demoFutureEvent.title}" → J+10`);
    } else {
      await req('POST', '/events', {
        title: "Live Guérison — La puissance de l'Amour",
        description: "Rejoignez David Théry pour une soirée de prière collective.",
        youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        event_date: daysFromNow(10),
      });
      console.log('  OK événement futur recréé (J+10)');
    }

    console.log('\n✅ État PROCHAIN ≥7J actif (état par défaut du seed).');
    console.log('   EventBanner : "Prochain live le [date]" sur fond blanc');
    return;
  }

  // ────────────────────────────────────────────────────────────────────────────

  if (target === 'past') {
    console.log('→ Passage en état ENTRE DEUX LIVES (aucun futur)...');
    // 1. Remettre l'événement principal à J-7
    await patch(`/events?id=eq.${demoLiveEvent.id}`, {
      event_date: daysAgo(7),
      registration_opens_at: daysAgo(14),
      registration_closes_at: daysAgo(7),
    });
    console.log(`  OK event "${demoLiveEvent.title}" → J-7`);

    // 2. Repousser l'événement futur à J-10 (passé, hors fenêtre live)
    if (demoFutureEvent) {
      await patch(`/events?id=eq.${demoFutureEvent.id}`, { event_date: daysAgo(10) });
      console.log(`  OK event futur "${demoFutureEvent.title}" → J-10 (passé, hors fenêtre)`);
    }

    console.log('\n✅ État ENTRE DEUX LIVES actif.');
    console.log('   EventBanner : "Dernier live il y a 7 jours — prochainement"');
    console.log('\n   → Pour revenir : node scripts/demo-state.js upcoming');
    return;
  }
}

run().catch(e => {
  console.error('\nErreur:', e.message);
  process.exit(1);
});
