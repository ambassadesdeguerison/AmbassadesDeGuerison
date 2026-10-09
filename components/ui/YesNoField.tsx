'use client';

import { useId } from 'react';

interface Props {
  label: string;
  /** `null` = pas encore répondu. */
  value: boolean | null;
  onChange: (value: boolean) => void;
}

// Oui / Non en boutons radio natifs (navigation aux flèches gratuite), habillés en
// pastilles de 44px. Pas de valeur par défaut : « pas répondu » reste distinct de « Non ».
export default function YesNoField({ label, value, onChange }: Props) {
  const name = useId();

  return (
    <fieldset>
      <legend className="text-sm text-slate-700 mb-2">{label}</legend>
      <div className="flex gap-2">
        {([true, false] as const).map((option) => (
          <label key={String(option)} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              checked={value === option}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <span className="inline-flex items-center justify-center min-h-[44px] min-w-[72px] px-4 rounded-full border border-slate-200 bg-white text-sm text-slate-700 transition-colors hover:bg-slate-50 peer-checked:bg-indigo-50 peer-checked:border-indigo-600 peer-checked:text-indigo-700 peer-checked:font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500">
              {option ? 'Oui' : 'Non'}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
