import { test, expect, type Page } from '@playwright/test';
import { waitForMail, findLink } from './helpers/mailhog';
import { throwawayEmail } from './helpers/test-db';

/**
 * E2E — formulaire d'inscription ambassadeur : libellés et textes d'aide.
 *
 * Le formulaire ne s'ouvre qu'après confirmation de l'adresse par e-mail : on passe par le vrai
 * e-mail dans Mailhog (voir e2e/email-verification.spec.ts pour la vérification elle-même).
 * La recherche de ville est simulée (`/api/geocode`) pour ne pas dépendre d'Internet.
 */

// 60 s : chaque test attend un vrai e-mail et le serveur de dev compile les pages à la première visite.
test.describe.configure({ timeout: 60_000 });

const LYON =[{ label: 'Lyon, France', city: 'Lyon', country: 'France', lat: 45.764, lng: 4.8357 }];

async function openVerifiedForm(page: Page) {
  const email = throwawayEmail('labels');
  // Le rate-limit de proxy.ts compte par IP : une IP propre à chaque test évite qu'ils se bloquent entre eux.
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.9` });
  await page.route('**/api/geocode**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LYON) }),
  );

  await page.goto('/inscription');
  await page.getByLabel('Votre adresse e-mail').fill(email);
  await page.getByRole('button', { name: 'Recevoir le lien de confirmation' }).click();
  const mail = await waitForMail(email);
  await page.goto(findLink(mail.html, '/inscription?verify='));
  await expect(page.getByText('Adresse confirmée')).toBeVisible();
}

async function fillStep1(page: Page) {
  await page.getByPlaceholder('Votre prénom').fill('Test');
  await page.getByPlaceholder('Votre nom').fill('Dupont');
  await page.locator('#phone').fill('+33 6 12 34 56 78');
  await page.locator('#city').fill('Lyon');
  await page.getByRole('button', { name: 'Lyon, France' }).click();
}

test.describe('Inscription — labels et copy', () => {
  test.beforeEach(async ({ page }) => {
    await openVerifiedForm(page);
  });

  test('Étape 1 — l’adresse confirmée est verrouillée et le téléphone dit à quoi il sert', async ({ page }) => {
    await expect(page.locator('input[type="email"][readonly]')).toBeVisible();
    await expect(page.locator('label', { hasText: 'Téléphone' })).toBeVisible();
    await expect(page.getByText(/Privé — utilisé par David pour vous joindre/)).toBeVisible();
  });

  test('Étape 1 — le bouton Continuer est désactivé sans ville confirmée', async ({ page }) => {
    await page.getByPlaceholder('Votre prénom').fill('Test');
    await page.getByPlaceholder('Votre nom').fill('Dupont');
    await page.locator('#phone').fill('+33 6 12 34 56 78');
    // Sans ville → bouton désactivé
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();

    // Ville choisie dans la liste → bouton actif
    await page.locator('#city').fill('Lyon');
    await page.getByRole('button', { name: 'Lyon, France' }).click();
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeEnabled();
  });

  test('Étape 2 — adresse et détails utiles : finalité et destinataire annoncés', async ({ page }) => {
    await fillStep1(page);
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByText('Adresse complète')).toBeVisible();
    await expect(page.getByText(/Jamais affichée sur la carte\. Partagée uniquement avec les visiteurs que vous acceptez/)).toBeVisible();
    await expect(page.getByText('Détails utiles pour vos visiteurs')).toBeVisible();
    await expect(page.getByText(/Sera transmis aux visiteurs acceptés/)).toBeVisible();
  });

  test('Étape 2 — le champ « détails utiles » fait 3 lignes', async ({ page }) => {
    await fillStep1(page);
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.locator('textarea')).toHaveAttribute('rows', '3');
  });

  test('Étape 2 — « Groupe réservé aux femmes » n’est proposé que pour un domicile', async ({ page }) => {
    await fillStep1(page);
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByText('Ce groupe est réservé aux femmes uniquement')).toBeVisible();
    await page.getByRole('combobox').selectOption('church');
    await expect(page.getByText('Ce groupe est réservé aux femmes uniquement')).toHaveCount(0);
  });
});

test.describe('Inscription — chargement', () => {
  test('la page charge sans erreur JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/inscription');
    await page.waitForLoadState('networkidle');
    const fatal = errors.filter((e) => e.includes('TypeError') || e.includes('ReferenceError'));
    expect(fatal).toHaveLength(0);
  });
});
