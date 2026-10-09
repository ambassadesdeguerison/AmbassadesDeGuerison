import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render } from 'react-email';
import ContactReceivedHost from '@/emails/contact-received-host';

// L'ambassadeur doit savoir, avant d'accepter, si le visiteur a mis une photo.
// La photo reste facultative : on informe l'hôte, on ne bloque personne.

const base = {
  hostFirstName: 'Paul',
  visitorFirstName: 'Marie',
  visitorEmail: 'marie@example.com',
  acceptUrl: 'https://app.example/accueillir/t',
  declineUrl: 'https://app.example/refuser/t',
};

describe('e-mail « demande reçue » (hôte) — photo du visiteur', () => {
  it('avec photo : lien vers le tableau de bord, pas de mention « sans photo »', async () => {
    const html = await render(React.createElement(ContactReceivedHost, { ...base, dashboardUrl: 'https://app.example/dashboard' }));
    expect(html).toContain('a ajouté une photo de profil');
    expect(html).toContain('https://app.example/dashboard');
    expect(html).not.toContain('pas ajouté de photo');
  });

  it('sans photo : le dit clairement', async () => {
    // React sépare le prénom du texte par des commentaires `<!-- -->` dans le HTML rendu.
    const html = (await render(React.createElement(ContactReceivedHost, { ...base, dashboardUrl: null }))).replace(/<!-- -->/g, '');
    expect(html).toMatch(/Marie n(&#x27;|&#39;|')a pas ajouté de photo de profil/);
    expect(html).not.toContain('a ajouté une photo de profil');
  });
});
