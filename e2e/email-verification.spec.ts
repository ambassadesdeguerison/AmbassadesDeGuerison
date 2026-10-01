import { test, expect } from '@playwright/test';
import { waitForMail, findLink, mailCount } from './helpers/mailhog';
import { serviceClient, throwawayEmail, authUserByEmail, purgeTestAccount } from './helpers/test-db';

/**
 * Vérification réelle de l'adresse e-mail — ambassadeurs ET visiteurs.
 *
 * Ces tests lisent les vrais e-mails dans Mailhog (docker, `npm run mailhog`) et créent des comptes
 * jetables dans la base de démo, supprimés en fin de test.
 * Prérequis : USE_MAILHOG=true et MAILHOG_SMTP_HOST=127.0.0.1 dans .env.local, serveur dev redémarré.
 */

// 60 s : chaque test attend un vrai e-mail et le serveur de dev compile les pages à la première visite.
test.describe.configure({ mode: 'serial', timeout: 60_000 });
test.skip(({ isMobile }) => isMobile, 'Parcours identique sur mobile : un seul projet suffit pour limiter les comptes créés');

const db = serviceClient();

// Le rate-limit de proxy.ts compte par IP (en mémoire, 60 s) : sans IP propre à chaque test, deux passes
// rapprochées se bloquent entre elles. `x-forwarded-for` est celui que lit le proxy en local.
let ipHeaders: Record<string, string> = {};
test.beforeEach(async ({ page }) => {
  const ip = `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  ipHeaders = { 'x-forwarded-for': ip };
  await page.setExtraHTTPHeaders(ipHeaders); // pages ; les appels page.request reçoivent ipHeaders explicitement
});

const created: string[] = [];
function track(email: string) {
  created.push(email);
  return email;
}
test.afterAll(async () => {
  for (const email of created) await purgeTestAccount(db, email);
});

test.describe('Ambassadeur — adresse confirmée AVANT toute création', () => {
  test('sans preuve, l’API refuse et rien n’est créé', async ({ request }) => {
    const email = track(throwawayEmail('amb-noproof'));
    const res = await request.post('/api/inscriptions', {
      data: {
        email, first_name: 'Test', last_name: 'E2E', phone: '+33612345678', city: 'Paris',
        country: 'France', address_private: '12 rue de la Paix', lat: 48.85, lng: 2.35,
      },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('email_not_verified');
    expect(await authUserByEmail(db, email)).toBeNull();
  });

  test('/inscription commence par la confirmation de l’adresse, pas par le formulaire', async ({ page }) => {
    await page.goto('/inscription');
    await expect(page.getByRole('heading', { name: 'Devenir ambassadeur' })).toBeVisible();
    await expect(page.getByLabel('Votre adresse e-mail')).toBeVisible();
    await expect(page.getByText('Prénom')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Recevoir le lien de confirmation' })).toBeDisabled();
  });

  test('le lien reçu par e-mail ouvre le formulaire, adresse verrouillée, sans créer de compte', async ({ page }) => {
    const email = track(throwawayEmail('amb-link'));
    await page.goto('/inscription');
    await page.getByLabel('Votre adresse e-mail').fill(email);
    await page.getByRole('button', { name: 'Recevoir le lien de confirmation' }).click();
    await expect(page.getByRole('heading', { name: 'Regardez votre boîte mail' })).toBeVisible();

    const mail = await waitForMail(email);
    expect(mail.subject).toContain('Confirmez votre adresse');
    const link = findLink(mail.html, '/inscription?verify=');

    // Aucun compte tant que le formulaire n'est pas envoyé
    expect(await authUserByEmail(db, email)).toBeNull();

    await page.goto(link);
    await expect(page.getByText('Récapitulatif')).toHaveCount(0);
    const emailField = page.locator('input[type="email"][readonly]');
    await expect(emailField).toHaveValue(email);
    await expect(page.getByText('Adresse confirmée')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeVisible();

    expect(await authUserByEmail(db, email)).toBeNull();
  });

  test('un lien falsifié ne mène pas au formulaire et propose d’en recevoir un nouveau', async ({ page }) => {
    await page.goto('/inscription?verify=faux.jeton');
    await expect(page.getByText(/n.est plus valable/)).toBeVisible();
    await expect(page.getByLabel('Votre adresse e-mail')).toBeVisible();
  });

  test('« Renvoyer le lien » envoie un second e-mail', async ({ page }) => {
    const email = track(throwawayEmail('amb-resend'));
    await page.goto('/inscription');
    await page.getByLabel('Votre adresse e-mail').fill(email);
    await page.getByRole('button', { name: 'Recevoir le lien de confirmation' }).click();
    await waitForMail(email);
    const before = await mailCount(email);

    await page.getByRole('button', { name: 'Renvoyer le lien' }).click();
    await expect.poll(() => mailCount(email), { timeout: 15_000 }).toBeGreaterThan(before);
  });
});

test.describe('Visiteur — adresse confirmée avant toute session', () => {
  async function activeHostsOfOneEvent(min: number) {
    const { data } = await db
      .from('host_activations')
      .select('id, event_id, host_profile_id, events(registration_closes_at)')
      .eq('is_active', true)
      .eq('is_full', false);
    const now = new Date().toISOString();
    const byEvent = new Map<string, { host_profile_id: string }[]>();
    for (const a of (data ?? []) as unknown as Array<{ event_id: string; host_profile_id: string; events: { registration_closes_at: string | null } | null }>) {
      if (a.events?.registration_closes_at && a.events.registration_closes_at < now) continue;
      byEvent.set(a.event_id, [...(byEvent.get(a.event_id) ?? []), { host_profile_id: a.host_profile_id }]);
    }
    const found = [...byEvent.entries()].find(([, hosts]) => hosts.length >= min);
    return found ? { eventId: found[0], hosts: found[1] } : null;
  }

  async function createVisitorAndVerify(page: import('@playwright/test').Page, email: string, redirect: string) {
    await page.goto(`/mon-espace/creer?redirect=${encodeURIComponent(redirect)}`);
    await page.getByLabel('Votre prénom').fill('Testeur');
    await page.getByLabel('Votre adresse e-mail').fill(email);
    await page.locator('#visitor-account-phone').fill('+33 6 12 34 56 78');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByRole('heading', { name: 'Regardez votre boîte mail' })).toBeVisible();
    return waitForMail(email);
  }

  test('le compte est créé mais AUCUNE session ne s’ouvre avant le clic sur le lien', async ({ page }) => {
    const email = track(throwawayEmail('vis-verify'));
    const mail = await createVisitorAndVerify(page, email, '/');
    expect(mail.subject).toContain('Confirmez votre adresse');

    // Pas de session : le profil est refusé et une demande de visite aussi
    expect((await page.request.get('/api/visitor/profile', { headers: ipHeaders })).status()).toBe(401);
    const attempt = await page.request.post('/api/visit-requests', {
      headers: ipHeaders,
      data: { event_id: '00000000-0000-0000-0000-000000000000', host_profile_id: '00000000-0000-0000-0000-000000000000', consent: true },
    });
    expect(attempt.status()).toBe(401);

    // Clic sur le lien : la session s'ouvre et ramène à la page d'origine
    await page.goto(findLink(mail.html, '/auth/confirm'));
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
    expect((await page.request.get('/api/visitor/profile', { headers: ipHeaders })).status()).toBe(200);
  });

  test('plafond de demandes : refus au-delà de la limite réglée, une demande refusée libère la place', async ({ page }) => {
    const target = await activeHostsOfOneEvent(2);
    test.skip(!target, 'Il faut au moins deux ambassades actives pour un même live dans la base de démo');

    const email = track(throwawayEmail('vis-cap'));
    const mail = await createVisitorAndVerify(page, email, '/');
    await page.goto(findLink(mail.html, '/auth/confirm'));
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });

    // Limite abaissée à 1 pour le test (réglage admin), restaurée ensuite quoi qu'il arrive
    const { data: before } = await db.from('event_timing_config').select('max_requests_per_visitor_per_event').eq('id', 1).single();
    const original = before?.max_requests_per_visitor_per_event ?? 3;
    await db.from('event_timing_config').update({ max_requests_per_visitor_per_event: 1 }).eq('id', 1);
    try {
      const ask = (hostId: string) =>
        page.request.post('/api/visit-requests', {
          headers: ipHeaders,
          data: { event_id: target!.eventId, host_profile_id: hostId, nb_personnes: 1, consent: true },
        });

      const first = await ask(target!.hosts[0].host_profile_id);
      expect(first.status()).toBe(201);

      const second = await ask(target!.hosts[1].host_profile_id);
      expect(second.status()).toBe(429);
      expect((await second.json()).error).toContain('1 demande en cours');

      // L'ambassadeur refuse la première demande : la place se libère
      await db.from('contact_requests').update({ status: 'declined' }).eq('visitor_email', email);
      const third = await ask(target!.hosts[1].host_profile_id);
      expect(third.status(), await third.text()).toBe(201);
    } finally {
      await db.from('event_timing_config').update({ max_requests_per_visitor_per_event: original }).eq('id', 1);
    }
  });
});
