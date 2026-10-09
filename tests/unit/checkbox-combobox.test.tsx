import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CheckboxCombobox, { normalizeSearch, type ComboGroup } from '@/components/ui/CheckboxCombobox';

const GROUPS: ComboGroup[] = [
  { label: 'Formations', options: [{ id: 't:defi', label: 'Défi Guérison' }] },
  {
    label: 'Livres',
    options: [
      { id: 'b:ecoute', label: 'À l’écoute de Dieu' },
      { id: 'b:jeune', label: 'Apprendre à jeûner' },
    ],
  },
];

function Harness({ initial = [] as string[], onChange = vi.fn() }) {
  const [selected, setSelected] = useState(initial);
  return (
    <CheckboxCombobox
      label="Formations et livres"
      groups={GROUPS}
      selected={selected}
      onChange={(next) => {
        setSelected(next);
        onChange(next);
      }}
      placeholder="Choisir"
    />
  );
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Formations et livres' }));

describe('CheckboxCombobox', () => {
  it('fermée : affiche le placeholder, aucune option visible', () => {
    render(<Harness />);
    expect(screen.getByText('Choisir')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('ouverte : formations en premier puis livres, chacun avec son titre de groupe', () => {
    render(<Harness />);
    open();
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Défi Guérison', 'À l’écoute de Dieu', 'Apprendre à jeûner']);
    expect(screen.getByText('Formations')).toBeTruthy();
    expect(screen.getByText('Livres')).toBeTruthy();
  });

  it('cocher / décocher met à jour la sélection et le résumé', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    open();

    fireEvent.click(screen.getByRole('option', { name: /défi guérison/i }));
    expect(onChange).toHaveBeenLastCalledWith(['t:defi']);
    expect(screen.getByRole('option', { name: /défi guérison/i }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('option', { name: /défi guérison/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('la recherche ignore accents et casse, et masque les groupes vides', () => {
    render(<Harness />);
    open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ECOUTE' } });

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['À l’écoute de Dieu']);
    expect(screen.queryByText('Formations')).toBeNull();
  });

  it('aucun résultat : message dédié', () => {
    render(<Harness />);
    open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Aucun résultat.')).toBeTruthy();
  });

  it('clavier : flèche bas puis Entrée coche l’option active ; Échap ferme', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    open();
    const search = screen.getByRole('combobox');

    fireEvent.keyDown(search, { key: 'ArrowDown' }); // 2e option
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['b:ecoute']);

    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('résumé replié : deux libellés puis « +N »', () => {
    render(<Harness initial={['t:defi', 'b:ecoute', 'b:jeune']} />);
    expect(screen.getByText('Défi Guérison, À l’écoute de Dieu +1')).toBeTruthy();
  });
});

describe('normalizeSearch', () => {
  it('retire accents, casse et espaces de bord', () => {
    expect(normalizeSearch('  À l’ÉCOUTE ')).toBe('a l’ecoute');
  });
});
