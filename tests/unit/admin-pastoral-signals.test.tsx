import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

// Le tableau admin importe ces modules au chargement ; aucun n'est nécessaire au rendu du panneau.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/admin/api-call', () => ({ apiCall: vi.fn() }));

import { PastoralSignals } from '@/components/AmbassadeursTable';

type Props = ComponentProps<typeof PastoralSignals>['a'];

// Revue admin du questionnaire (2026-10-01) : la vue masquait les absences. Un candidat qui n'avait rien
// coché ni filmé affichait un panneau sans formations ni vidéo, indiscernable d'un champ oublié ; la
// dénomination s'affichait loin de la fréquentation d'église.
const base = {
  healing_challenge_done: false,
  conferences_assistees: false,
  church_attendance: 'regular',
  denomination: 'catho',
  parcours_spirituel: null,
  livres_lus: null,
  books_read: [],
  trainings_done: [],
  has_seen_healings: true,
  has_leadership_role: false,
  leadership_role: null,
  intro_video_path: null,
  intro_video_mime: null,
  intro_video_play_url: null,
  intro_video_download_url: null,
} as unknown as Props;

describe('PastoralSignals (admin)', () => {
  it('dit explicitement quand rien n’a été indiqué et quand la vidéo manque', () => {
    render(<PastoralSignals a={base} />);
    expect(screen.getByText('Aucune indiquée')).toBeTruthy();
    expect(screen.getByText('Non fournie')).toBeTruthy();
  });

  it('affiche la dénomination dans la carte, avec la fréquentation d’église', () => {
    render(<PastoralSignals a={base} />);
    expect(screen.getByText('Dénomination')).toBeTruthy();
    expect(screen.getByText('catho')).toBeTruthy();
    expect(screen.getByText('Régulièrement')).toBeTruthy();
  });

  it('liste formations, conférence, livres et « autres »', () => {
    render(
      <PastoralSignals
        a={{
          ...base,
          trainings_done: ['vraiment_libre'],
          books_read: ['guerir-les-malades'],
          conferences_assistees: true,
          livres_lus: 'La puissance de la prière',
        } as unknown as Props}
      />
    );
    expect(screen.getByText('Vraiment Libre (formation)')).toBeTruthy();
    expect(screen.getByText('Conférence de David Théry')).toBeTruthy();
    expect(screen.getByText('Guérir les malades')).toBeTruthy();
    expect(screen.getByText('La puissance de la prière')).toBeTruthy();
    expect(screen.queryByText('Aucune indiquée')).toBeNull();
  });

  it('un ancien Défi Guérison coché (healing_challenge_done) apparaît comme formation', () => {
    render(<PastoralSignals a={{ ...base, healing_challenge_done: true } as unknown as Props} />);
    expect(screen.getByText('Défi Guérison (formation)')).toBeTruthy();
  });

  it('distingue « non » de « pas répondu »', () => {
    render(
      <PastoralSignals
        a={{ ...base, has_seen_healings: null, has_leadership_role: false } as unknown as Props}
      />
    );
    expect(screen.getAllByText('Non renseigné').length).toBe(1); // guérisons vues
    expect(screen.getByText('Non')).toBeTruthy(); // pas de fonction de responsabilité
  });

  it('étiquette le parcours écrit comme un secours de la vidéo', () => {
    render(<PastoralSignals a={{ ...base, parcours_spirituel: 'bibibi' } as unknown as Props} />);
    expect(screen.getByText(/Parcours écrit/)).toBeTruthy();
    expect(screen.getByText('bibibi')).toBeTruthy();
  });

  it('vidéo présente : lecteur et lien de téléchargement', () => {
    render(
      <PastoralSignals
        a={{
          ...base,
          intro_video_path: 'p/intro.mp4',
          intro_video_mime: 'video/mp4',
          intro_video_play_url: 'https://signed/play',
          intro_video_download_url: 'https://signed/dl',
        } as unknown as Props}
      />
    );
    expect(screen.queryByText('Non fournie')).toBeNull();
    expect(screen.getByRole('link', { name: /télécharger le fichier/i }).getAttribute('href')).toBe('https://signed/dl');
  });
});
