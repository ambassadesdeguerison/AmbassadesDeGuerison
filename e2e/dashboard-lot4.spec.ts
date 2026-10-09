import { test, expect } from '@playwright/test';
import { AMBASSADOR_STATE } from './auth-state';

/**
 * E2E Lot 4 — Dashboard refondu (layout contextuel)
 *
 * Vérifie que :
 * - Le stepper StatusTimeline est absent pour un ambassadeur validé
 * - La section "Mes lives" affiche un CTA « J'ouvre ma maison / mon église » au lieu d'un toggle
 * - La section "Mes demandes" n'utilise pas line-clamp-2 sur les messages
 * - Les boutons Accepter / Refuser sont bien présents pour les demandes en attente
 * - Le dashboard redirige non-authentifié vers /auth
 */

// 60 s : le serveur de dev compile le dashboard à la première visite, lentement quand les workers se partagent la machine.
test.describe.configure({ timeout: 60_000 });

test.describe('Dashboard Lot 4 — non authentifié', () => {
  test('redirige vers /auth', async ({ page }) => {
    // Purge explicite des cookies/storage pour éviter toute contamination entre workers parallèles.
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });
});

test.describe('Dashboard Lot 4 — structure (authentifié)', () => {
  test.use({ storageState: AMBASSADOR_STATE });

  test.beforeEach(async ({ page }) => {
    // Stubber /api/geocode pour éviter que CityInput (MesInfosSection) déclenche
    // un fetch au mount et empêche waitForLoadState('networkidle') de se stabiliser.
    await page.route('/api/geocode**', (route) =>
      route.fulfill({ status: 200, body: '[]', contentType: 'application/json' })
    );
  });

  test('stepper parcours absent pour un ambassadeur validé', async ({ page }) => {
    await page.goto('/dashboard');
    // Pour un ambassadeur validé, le stepper (StatusTimeline) est retiré — il a terminé son parcours.
    // On attend d'abord que la page soit chargée (le greeting apparaît), puis on vérifie l'absence.
    await expect(page.getByText('Bonjour')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Pré-approbation')).not.toBeVisible();
    await expect(page.getByText('Profil enrichi')).not.toBeVisible();
  });

  test('section Mes lives — CTA "J\'ouvre ma maison/mon église" ou badge "est ouverte" visibles', async ({ page }) => {
    await page.goto('/dashboard');

    // La section n'est visible que si des lives existent
    const section = page.getByRole('heading', { name: /Mes lives/ });
    if (!await section.isVisible({ timeout: 8_000 }).catch(() => false)) return; // pas de lives dans le seed → skip implicite

    // L'un ou l'autre doit être présent (selon l'état is_active courant)
    const ctaParticipe = page.getByRole('button', { name: /J'ouvre (ma maison|mon église) pour ce live/ });
    const badgeParticipe = page.getByText(/Votre (maison|église) est ouverte pour ce live/);
    const hasParticipe = await ctaParticipe.isVisible().catch(() => false);
    const hasConfirmed = await badgeParticipe.isVisible().catch(() => false);
    expect(hasParticipe || hasConfirmed).toBe(true);
  });

  test('section Mes demandes — pas de line-clamp-2 sur les messages', async ({ page }) => {
    await page.goto('/dashboard');

    // Vérifier qu'aucun élément avec line-clamp-2 n'est présent dans la section demandes.
    // Si la section n'existe pas (seed sans demandes), le test passe aussi (pas de line-clamp-2).
    const hasLineClamp = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));
      const demandeSection = sections.find((s) =>
        s.querySelector('h2')?.textContent?.includes('Mes demandes')
      );
      if (!demandeSection) return false; // section absente → pas de line-clamp-2
      return demandeSection.querySelector('.line-clamp-2') !== null;
    });
    expect(hasLineClamp).toBe(false);
  });

  test('demandes en attente — boutons Accepter et Refuser présents en tandem', async ({ page }) => {
    await page.goto('/dashboard');
    // Si des demandes en attente existent, les deux boutons doivent être visibles ensemble
    const acceptBtn = page.getByRole('button', { name: /Accepter/ }).first();
    const refuseBtn = page.getByRole('button', { name: /Refuser/ }).first();
    if (await acceptBtn.isVisible()) {
      await expect(refuseBtn).toBeVisible();
    }
  });
});
