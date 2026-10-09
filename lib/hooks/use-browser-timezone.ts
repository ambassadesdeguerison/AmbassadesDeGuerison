'use client';

import { useEffect, useSyncExternalStore } from 'react';

const DEFAULT_LABEL = 'heure locale';
const CITY_PATTERN = /^[A-Za-zÀ-ÿ\s-]+$/;

function buildLabel(city: string): string {
  const prep = /^[AEIOUaeiouÀÂÈÉÊËÎÏÔÙÛ]/i.test(city) ? "d'" : 'de ';
  return `heure ${prep}${city}`;
}

// Ville du fuseau du navigateur ("Europe/Paris" → "Paris"), ou null si l'identifiant
// n'en contient pas ("UTC", "GMT") ou si Intl est absent.
function browserCity(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz.includes('/')) return null;
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? null;
    return city && CITY_PATTERN.test(city) ? city : null;
  } catch {
    return null;
  }
}

// Le fuseau du navigateur prime ; à défaut (ex : "UTC"), la dernière ville mémorisée.
function getSnapshot(): string {
  const city = browserCity();
  if (city) return buildLabel(city);
  try {
    const cached = localStorage.getItem('tz-city');
    if (cached && CITY_PATTERN.test(cached)) return buildLabel(cached);
  } catch {
    // localStorage indisponible (Safari privé)
  }
  return DEFAULT_LABEL;
}

const subscribeNever = () => () => {};

export function useBrowserTimezone(): string {
  // Instantané serveur = libellé neutre : pas de décalage à l'hydratation.
  const label = useSyncExternalStore(subscribeNever, getSnapshot, () => DEFAULT_LABEL);

  // Mémorise la ville pour les prochaines visites (aucun setState : simple écriture).
  useEffect(() => {
    const city = browserCity();
    if (!city) return;
    try {
      localStorage.setItem('tz-city', city);
    } catch {
      // localStorage indisponible (Safari privé)
    }
  }, []);

  return label;
}
