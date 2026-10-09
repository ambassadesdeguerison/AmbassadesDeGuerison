import { describe, it, expect } from 'vitest';
import {
  addToast,
  removeToast,
  toastDuration,
  MAX_TOASTS,
  type ToastItem,
} from '@/lib/toast/state';

function item(id: string, overrides: Partial<ToastItem> = {}): ToastItem {
  return { id, tone: 'success', title: `Message ${id}`, duration: 6000, ...overrides };
}

describe('toastDuration', () => {
  it('un message court de succès reste au moins 6 s', () => {
    expect(toastDuration('success', 'OK')).toBe(6000);
  });

  it('une erreur ou un avertissement reste au moins 10 s (il faut le lire, puis agir)', () => {
    expect(toastDuration('error', 'Raté')).toBe(10_000);
    expect(toastDuration('warning', 'Attention')).toBe(10_000);
  });

  it('augmente avec la longueur du texte', () => {
    const court = toastDuration('success', 'Ambassade validée');
    const long = toastDuration(
      'success',
      'Ambassade validée',
      'Un e-mail de bienvenue a été envoyé à camille@example.com. Elle pourra ouvrir sa maison au prochain live.'
    );
    expect(long).toBeGreaterThan(court);
  });

  it('est plafonnée', () => {
    expect(toastDuration('info', 'x'.repeat(5000))).toBe(20_000);
  });
});

describe('addToast', () => {
  it('ajoute en fin de file', () => {
    const list = addToast([item('1')], item('2'));
    expect(list.map((t) => t.id)).toEqual(['1', '2']);
  });

  it("remplace un message identique au lieu de l'empiler (double clic)", () => {
    const first = item('1', { title: 'Ambassade validée' });
    const again = item('2', { title: 'Ambassade validée' });
    const list = addToast([first], again);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('2');
  });

  it("n'écrase pas un message de même titre mais de ton différent", () => {
    const ok = item('1', { title: 'Validée', tone: 'success' });
    const warn = item('2', { title: 'Validée', tone: 'warning' });
    expect(addToast([ok], warn)).toHaveLength(2);
  });

  it('distingue deux messages de même titre dont la description diffère', () => {
    const a = item('1', { title: 'Demande acceptée', description: 'Marie' });
    const b = item('2', { title: 'Demande acceptée', description: 'Paul' });
    expect(addToast([a], b)).toHaveLength(2);
  });

  it(`ne garde que les ${MAX_TOASTS} plus récents`, () => {
    let list: ToastItem[] = [];
    for (let i = 1; i <= MAX_TOASTS + 2; i++) list = addToast(list, item(String(i)));
    expect(list).toHaveLength(MAX_TOASTS);
    expect(list[0].id).toBe('3');
    expect(list[list.length - 1].id).toBe(String(MAX_TOASTS + 2));
  });
});

describe('removeToast', () => {
  it('retire le message demandé', () => {
    expect(removeToast([item('1'), item('2')], '1').map((t) => t.id)).toEqual(['2']);
  });

  it('renvoie la même liste si le message a déjà disparu (pas de re-rendu inutile)', () => {
    const list = [item('1')];
    expect(removeToast(list, 'inconnu')).toBe(list);
  });
});
