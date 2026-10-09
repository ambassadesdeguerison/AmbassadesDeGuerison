'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface AddressResult {
  label: string;
  address: string;
  city: string;
  country: string;
  quartier: string | null;
  lat_precise: number;
  lng_precise: number;
}

export interface AddressSelection {
  address: string;
  city: string;
  country: string;
  quartier: string | null;
  lat_precise: number;
  lng_precise: number;
}

interface AddressInputProps {
  value: string;
  onChange: (address: string) => void;
  onSelect: (selection: AddressSelection) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

// Autocomplete adresse complète (Nominatim, mode=address) — distinct de
// CityInput (recherche ville uniquement). Phase 2 : capture lat_precise/
// lng_precise (privées, jamais publiques) + quartier auto-déduit.
export default function AddressInput({
  value,
  onChange,
  onSelect,
  id = 'address-input',
  label,
  placeholder = '12 rue de la Paix, 75001 Paris',
  required,
}: AddressInputProps) {
  const [query, setQuery] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // Valeur changée de l'extérieur (ex : le parent recharge le profil) : la saisie suit,
  // ajustée pendant le rendu plutôt que par un effet.
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasUserTyped = useRef(false);
  const ownedValueRef = useRef(value);

  useEffect(() => {
    if (value !== ownedValueRef.current) {
      hasUserTyped.current = false;
      ownedValueRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Saisie trop courte : on vide les suggestions, dans un callback plutôt que dans le corps de l'effet.
    const tooShort = query.length < 5;

    debounceRef.current = setTimeout(async () => {
      if (tooShort) { setResults([]); setOpen(false); return; }
      setLoading(true);
      const res = await fetch(`/api/geocode?mode=address&q=${encodeURIComponent(query)}`).catch(() => null);
      const data: AddressResult[] = res?.ok ? await res.json() : [];
      setResults(data);
      setOpen(hasUserTyped.current && data.length > 0);
      setLoading(false);
    }, tooShort ? 0 : 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleSelect(r: AddressResult) {
    hasUserTyped.current = false;
    ownedValueRef.current = r.address;
    setQuery(r.address);
    setOpen(false);
    setResults([]);
    onSelect({
      address: r.address,
      city: r.city,
      country: r.country,
      quartier: r.quartier,
      lat_precise: r.lat_precise,
      lng_precise: r.lng_precise,
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    hasUserTyped.current = true;
    const v = e.target.value;
    ownedValueRef.current = v;
    setQuery(v);
    onChange(v);
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
        <input
          id={id}
          type="text"
          required={required}
          value={query}
          onChange={handleInputChange}
          onFocus={() => hasUserTyped.current && results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white"
        />
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.map((r) => (
            <li key={`${r.lat_precise}-${r.lng_precise}`}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 flex items-start gap-2 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
