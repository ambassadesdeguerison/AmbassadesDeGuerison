'use client';

import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import { Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type * as Leaflet from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { useBrowserTimezone } from '@/lib/hooks/use-browser-timezone';

// Marqueur Leaflet portant l'hôte qu'il représente (relu par le handler 'clusterclick').
type HostMarker = Leaflet.Marker & { hostData: HostPin };

interface EventInfo {
  id: string;
  title: string;
  event_date: string;
  live_link: string | null;
}

interface Props {
  nextEvent: EventInfo | null;
  lastEvent: EventInfo | null;
  liveInProgress: boolean;
  totalAmbassadors: number;
  totalCountries: number;
  soonThresholdDays: number;
  dbError?: boolean;
}

interface HostPin {
  id: string;
  first_name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  is_active: boolean;
  is_full: boolean;
  accepted_count: number | null;
  capacity: number | null;
  whatsapp_group_url?: string;
  host_type: string;
  quartier?: string | null;
  presentation_message?: string | null;
  photo_url?: string | null;
  is_women_only: boolean;
}

// "Trier par distance" — géolocalisation navigateur ÉPHÉMÈRE déclenchée par une
// action utilisateur explicite (jamais automatique, cf design doc Phase 2 :
// piggybacker sur l'auto-locate de la carte violerait le consentement). La
// position n'est envoyée qu'une fois à /api/distance, jamais stockée, jamais
// ré-exposée : seule la distance arrondie au km revient.
async function sortClusterByDistance(
  activeGroup: HostPin[],
  btn: HTMLButtonElement,
  hint: HTMLElement | null,
  rowsContainer: HTMLElement | null,
  renderRow: (host: HostPin, distanceKm?: number | null) => string,
) {
  btn.disabled = true;
  btn.textContent = 'Localisation…';
  if (hint) hint.style.display = 'none';

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10_000 });
    });

    const res = await fetch('/api/distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        host_ids: activeGroup.map((h) => h.id),
      }),
    });

    if (!res.ok) throw new Error('distance_api_failed');
    const distances: Record<string, number | null> = await res.json();

    const sorted = [...activeGroup].sort((a, b) => {
      const da = distances[a.id];
      const db = distances[b.id];
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });

    if (rowsContainer) {
      rowsContainer.innerHTML = sorted.map((h) => renderRow(h, distances[h.id] ?? null)).join('');
    }
    btn.style.display = 'none';
  } catch {
    btn.disabled = false;
    btn.textContent = 'Trier par distance';
    if (hint) {
      hint.textContent = "Localisation refusée ou indisponible — les ambassades restent visibles sans tri par distance.";
      hint.style.display = 'block';
    }
  }
}

// Avatar en popup (jamais sur le pin — cf design C.1, évite la surcharge
// visuelle sur les clusters denses type Paris et le glissement "annonce").
// Fallback initiale + couleur si pas de photo (accompagnement pastoral, pas
// un blocage technique — cf design doc R2).
function avatarHtml(host: { first_name: string; photo_url?: string | null }, size = 40): string {
  if (host.photo_url) {
    return `<img src="${escapeHtml(host.photo_url)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:9999px;object-fit:cover;flex-shrink:0;" />`;
  }
  const initial = escapeHtml((host.first_name || '?').trim().charAt(0).toUpperCase());
  return `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#eef2ff;color:#4f46e5;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:${Math.round(size * 0.4)}px;flex-shrink:0;">${initial}</div>`;
}

// Échappe les caractères HTML dangereux avant interpolation dans les popups
// Leaflet (chaînes HTML brutes, pas de JSX) — first_name/quartier/presentation_message
// sont du texte libre saisi par l'ambassadeur, jamais fait confiance tel quel.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// SVG inline de l'icône Lucide `Flower2` pour les popups Leaflet (HTML strings,
// le composant React lucide-react n'est pas utilisable ici).
function flowerIconHtml(color: string, size = 10): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;display:inline-block;"><path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/></svg>`;
}

const MAP_VIEW_STORAGE_KEY = 'map-view-state';

function readSavedMapView(): { lat: number; lng: number; zoom: number } | null {
  try {
    const raw = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && typeof parsed.zoom === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveMapView(map: LeafletMap) {
  try {
    const center = map.getCenter();
    localStorage.setItem(
      MAP_VIEW_STORAGE_KEY,
      JSON.stringify({ lat: center.lat, lng: center.lng, zoom: map.getZoom() })
    );
  } catch {
    // localStorage indisponible (mode privé strict) — pas bloquant
  }
}

function makeClusterIcon(L: typeof Leaflet, count: number) {
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50%;background:#4f46e5;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;line-height:1;">${count}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  });
}

function makeIcon(L: typeof Leaflet, hostType: string, isFull: boolean, isActive: boolean, isWomenOnly: boolean) {
  const isChurch = hostType === 'eglise' || hostType === 'church';
  // Précédence de couleur :
  // 1. Inactif (grisé) — prime sur tout (full ignoré, women-only en pastel rose pâle)
  // 2. Actif + complet — rouge (ou pink-800 si women-only)
  // 3. Actif + women-only — rose (pink-500)
  // 4. Actif + église — violet
  // 5. Actif + domicile — indigo
  let bg: string;
  if (!isActive) {
    bg = isWomenOnly ? '#f9a8d4' : '#94a3b8';
  } else if (isFull) {
    bg = isWomenOnly ? '#be185d' : '#ef4444';
  } else if (isWomenOnly) {
    bg = '#ec4899';
  } else if (isChurch) {
    bg = '#7c3aed';
  } else {
    bg = '#4f46e5';
  }
  const stroke = isActive ? 'white' : '#e2e8f0';
  const symbol = isChurch
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M9 5h6M3 21h18M5 21V10l7-4 7 4v11M10 21v-5h4v5"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

  return L.divIcon({
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);display:flex;">${symbol}</span></div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -34],
  });
}

// Popup d'un pin individuel (hôte non regroupé au zoom courant par
// leaflet.markercluster). Extrait en fonction pure pour être réutilisable
// entre le rendu initial des marqueurs et un éventuel re-rendu.
function renderSinglePopup(host: HostPin, effectiveIsFull: boolean, liveInProgress: boolean): string {
  const inactiveMessage = liveInProgress
    ? 'Pas disponible pour ce live'
    : 'Pas encore confirmé pour le prochain live';
  const womenBadge = host.is_women_only
    ? `<p class="text-xs mt-1" style="color:#ec4899;font-weight:600;display:inline-flex;align-items:center;gap:4px;">${flowerIconHtml('#ec4899', 12)}Groupe femmes</p>`
    : '';
  let bodyHtml: string;
  if (!host.is_active) {
    bodyHtml = `<p class="text-xs text-slate-400 mt-1">${inactiveMessage}</p>${womenBadge}`;
  } else {
    const fullBadge = effectiveIsFull
      ? '<span class="inline-block bg-red-50 text-red-600 text-xs px-1.5 py-0.5 rounded font-medium ml-1">Complet</span>'
      : '';
    bodyHtml = `
      <p class="text-xs text-indigo-500 mt-1">${host.host_type === 'church' ? 'Lieu de prière en église' : 'Lieu de prière à domicile'}</p>
      <p class="text-xs text-slate-500 mt-0.5">${host.accepted_count ?? 0}/${host.capacity ?? '?'} places${fullBadge}</p>
      ${womenBadge}
      ${host.whatsapp_group_url ? `<a href="${host.whatsapp_group_url}" target="_blank" class="text-emerald-600 text-xs mt-2 block hover:underline">Rejoindre le groupe WhatsApp</a>` : ''}
      ${!effectiveIsFull ? `<a href="/ambassade/${host.id}" class="mt-2 inline-flex items-center gap-1 text-indigo-600 text-sm font-medium hover:text-indigo-800">Contacter →</a>` : ''}
    `;
  }
  const headerHtml = host.is_active
    ? `
      <div style="display:flex;align-items:flex-start;gap:8px;">
        ${avatarHtml(host)}
        <div style="min-width:0;">
          <p class="font-semibold text-slate-800 text-sm">${escapeHtml(host.first_name)}</p>
          <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(host.city)}, ${escapeHtml(host.country)}</p>
          ${host.quartier ? `<p class="text-xs text-slate-400 mt-0">${escapeHtml(host.quartier)}</p>` : ''}
        </div>
      </div>
    `
    : `
      <p class="font-semibold text-slate-800 text-sm">${escapeHtml(host.first_name)}</p>
      <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(host.city)}, ${escapeHtml(host.country)}</p>
      ${host.quartier ? `<p class="text-xs text-slate-400 mt-0">${escapeHtml(host.quartier)}</p>` : ''}
    `;
  return `
    <div style="min-width:190px;padding:2px 0">
      ${headerHtml}
      ${host.is_active && host.presentation_message ? `<p class="text-xs text-slate-500 mt-1.5" style="line-height:1.4;">${escapeHtml(host.presentation_message)}</p>` : ''}
      ${bodyHtml}
    </div>
  `;
}

function renderActiveRow(host: HostPin, distanceKm?: number | null): string {
  const typeLabel = host.host_type === 'church' ? 'Église' : 'Domicile';
  const effectiveIsFull = host.is_full;
  const fullBadge = effectiveIsFull
    ? '<span style="display:inline-block;background:#fef2f2;color:#dc2626;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:600;margin-left:4px;">Complet</span>'
    : '';
  const womenBadge = host.is_women_only
    ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#fdf2f8;color:#ec4899;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:600;margin-left:4px;">${flowerIconHtml('#ec4899', 10)}Femmes</span>`
    : '';
  const distanceBadge = distanceKm != null
    ? `<span style="display:inline-block;background:#eef2ff;color:#4f46e5;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:600;margin-left:4px;">≈ ${distanceKm} km</span>`
    : '';
  const cta = !effectiveIsFull
    ? `<a href="/ambassade/${host.id}" style="color:#4f46e5;font-size:12px;font-weight:600;text-decoration:none;display:inline-block;margin-top:2px;">Contacter →</a>`
    : '';
  return `
    <div style="padding:8px 0;border-top:1px solid #f1f5f9;display:flex;gap:8px;align-items:flex-start;">
      ${avatarHtml(host, 28)}
      <div style="min-width:0;flex:1;">
        <p style="font-weight:600;font-size:13px;color:#1e293b;margin:0;">${escapeHtml(host.first_name)}${fullBadge}${womenBadge}${distanceBadge}</p>
        <p style="font-size:11px;color:#6366f1;margin:2px 0 0;">${typeLabel} · ${host.accepted_count ?? 0}/${host.capacity ?? '?'} places</p>
        ${host.quartier ? `<p style="font-size:11px;color:#94a3b8;margin:1px 0 0;">${escapeHtml(host.quartier)}</p>` : ''}
        ${host.presentation_message ? `<p style="font-size:11px;color:#64748b;margin:3px 0 0;line-height:1.4;">${escapeHtml(host.presentation_message)}</p>` : ''}
        ${cta}
      </div>
    </div>
  `;
}

function renderInactiveRow(host: HostPin): string {
  const typeLabel = host.host_type === 'church' ? 'Église' : 'Domicile';
  const womenBadge = host.is_women_only
    ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#fdf2f8;color:#ec4899;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:600;margin-left:4px;">${flowerIconHtml('#ec4899', 10)}Femmes</span>`
    : '';
  return `
    <div style="padding:8px 0;border-top:1px solid #f1f5f9;">
      <p style="font-weight:600;font-size:13px;color:#94a3b8;margin:0;">${escapeHtml(host.first_name)}${womenBadge}</p>
      <p style="font-size:11px;color:#94a3b8;margin:2px 0 0;">${typeLabel}</p>
      ${host.quartier ? `<p style="font-size:11px;color:#cbd5e1;margin:1px 0 0;">${escapeHtml(host.quartier)}</p>` : ''}
    </div>
  `;
}

// Popup d'un cluster leaflet.markercluster — regroupement dynamique par
// proximité en pixels à l'écran (recalculé à chaque zoom/déplacement), pas
// par coordonnées exactes. Deux ambassadeurs proches mais géocodés à des
// coordonnées légèrement différentes (cas fréquent : Nominatim ne renvoie pas
// toujours le même point pour la même ville) tombent maintenant dans le même
// cluster dès qu'ils se recouvrent visuellement, au lieu de s'empiler
// silencieusement l'un sur l'autre sans indication (bug observé à Nantes).
function renderClusterPopup(group: HostPin[], liveInProgress: boolean, idSafe: string) {
  const inactiveMessage = liveInProgress
    ? 'Pas disponible pour ce live'
    : 'Pas encore confirmé pour le prochain live';
  const activeGroup = group.filter((h) => h.is_active);
  const inactiveGroup = group.filter((h) => !h.is_active);

  // Le regroupement étant désormais spatial (pixels) et non plus par
  // coordonnées exactes, deux villes proches mais distinctes peuvent
  // techniquement tomber dans le même cluster à faible zoom — n'afficher le
  // nom de la ville dans l'en-tête que si tous les membres la partagent.
  const cities = new Set(group.map((h) => h.city));
  const cityLabel = cities.size === 1 ? ` · ${escapeHtml(group[0].city)}` : '';

  const rowsContainerId = `dist-rows-${idSafe}`;
  const sortButtonId = `dist-btn-${idSafe}`;
  const sortHintId = `dist-hint-${idSafe}`;

  const sortButtonHtml = activeGroup.length > 1
    ? `
      <button id="${sortButtonId}" type="button" style="display:flex;align-items:center;gap:5px;background:#eef2ff;color:#4f46e5;font-size:11px;font-weight:600;padding:4px 10px;border-radius:8px;border:none;cursor:pointer;margin:4px 0 2px;">
        Trier par distance
      </button>
      <p id="${sortHintId}" style="display:none;font-size:10px;color:#94a3b8;margin:2px 0 4px;"></p>
    `
    : '';

  const activeSection = activeGroup.length > 0
    ? `<p style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin:8px 0 0;">Disponibles (${activeGroup.length})</p>
       ${sortButtonHtml}
       <div id="${rowsContainerId}">${activeGroup.map((h) => renderActiveRow(h)).join('')}</div>`
    : '';
  const inactiveSection = inactiveGroup.length > 0
    ? `<p style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin:8px 0 0;">${inactiveMessage} (${inactiveGroup.length})</p>${inactiveGroup.map(renderInactiveRow).join('')}`
    : '';

  const html = `
    <div style="min-width:200px;max-height:280px;overflow-y:auto;padding:2px 0;">
      <p style="font-weight:700;font-size:13px;color:#1e293b;margin:0 0 4px;">${group.length} ambassades${cityLabel}</p>
      ${activeSection}
      ${inactiveSection}
    </div>
  `;

  return { html, rowsContainerId, sortButtonId, sortHintId, activeGroup };
}

function formatEventDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function formatEventTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });
}

function StatsLine({ totalAmbassadors, totalCountries }: { totalAmbassadors: number; totalCountries: number }) {
  if (totalAmbassadors === 0) return null;
  return (
    <p className="text-slate-400 text-xs mt-3">
      {totalAmbassadors} ambassadeur{totalAmbassadors > 1 ? 's' : ''} · {totalCountries} pays
    </p>
  );
}

function EmptyMapContent({ nextEvent, lastEvent, liveInProgress, totalAmbassadors, totalCountries, soonThresholdDays, dbError }: Props) {
  const tzLabel = useBrowserTimezone();
  // Instant du montage : la carte se repollera bien avant que « dans N jours » change.
  const [mountedAt] = useState(() => Date.now());
  const daysUntilNext = nextEvent
    ? Math.ceil((new Date(nextEvent.event_date).getTime() - mountedAt) / 86_400_000)
    : null;

  // Panne de chargement (pas un vrai calme plat) — priorité sur tous les
  // autres états, y compris "aucun event", pour ne jamais afficher un CTA
  // "Devenir ambassadeur" trompeur pendant une indisponibilité de la carte.
  if (dbError) {
    return (
      <>
        <p className="text-slate-700 text-sm font-medium">Carte momentanément indisponible</p>
        <p className="text-slate-400 text-xs mt-1">Réessayez dans quelques instants.</p>
      </>
    );
  }

  // Live en cours mais aucun hôte confirmé (cas rare)
  if (liveInProgress) {
    return (
      <>
        <p className="text-slate-700 text-sm font-medium">Live en cours</p>
        <p className="text-slate-400 text-xs mt-1">Les ambassades confirment leur participation...</p>
        <StatsLine totalAmbassadors={totalAmbassadors} totalCountries={totalCountries} />
        {lastEvent?.live_link && (
          <a
            href={lastEvent.live_link}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-indigo-600 text-xs font-medium hover:text-indigo-800 transition-colors"
          >
            Regarder le live →
          </a>
        )}
      </>
    );
  }

  // Prochain live dans ≤ soonThresholdDays jours (état "soon" — confirmations en cours)
  if (nextEvent && daysUntilNext !== null && daysUntilNext <= soonThresholdDays) {
    const label = daysUntilNext <= 0 ? "aujourd'hui" : `dans ${daysUntilNext} jour${daysUntilNext > 1 ? 's' : ''}`;
    return (
      <>
        <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">Prochain live</p>
        <p className="text-slate-800 text-sm font-semibold capitalize">{formatEventDate(nextEvent.event_date)}</p>
        <p className="text-slate-500 text-xs mt-0.5">à {formatEventTime(nextEvent.event_date)} · {tzLabel} · {label}</p>
        <p className="text-slate-400 text-xs mt-2.5">Les ambassades confirment leur participation...</p>
        <StatsLine totalAmbassadors={totalAmbassadors} totalCountries={totalCountries} />
        <a href="/temoignages" className="mt-3 inline-flex items-center gap-1 text-indigo-600 text-xs font-medium hover:text-indigo-800 transition-colors">
          Voir les témoignages →
        </a>
      </>
    );
  }

  // Prochain live dans > 2 jours (état "upcoming")
  if (nextEvent && daysUntilNext !== null) {
    return (
      <>
        <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1">Prochain live</p>
        <p className="text-slate-800 text-sm font-semibold capitalize">{formatEventDate(nextEvent.event_date)}</p>
        <p className="text-slate-500 text-xs mt-0.5">à {formatEventTime(nextEvent.event_date)} · {tzLabel} · dans {daysUntilNext} jours</p>
        <p className="text-slate-400 text-xs mt-2.5">
          Les ambassades ci-dessus confirmeront leur participation prochainement.
        </p>
        <StatsLine totalAmbassadors={totalAmbassadors} totalCountries={totalCountries} />
        <a href="/temoignages" className="mt-3 inline-flex items-center gap-1 text-indigo-600 text-xs font-medium hover:text-indigo-800 transition-colors">
          Voir les témoignages →
        </a>
      </>
    );
  }

  // Live terminé, pas de prochain live annoncé (état "closed" ou "past")
  if (lastEvent) {
    return (
      <>
        <p className="text-slate-700 text-sm font-medium">Dernier live</p>
        <p className="text-slate-500 text-xs mt-0.5 capitalize">{formatEventDate(lastEvent.event_date)}</p>
        <p className="text-slate-400 text-xs mt-2.5">Prochain live annoncé prochainement.</p>
        <StatsLine totalAmbassadors={totalAmbassadors} totalCountries={totalCountries} />
        <a href="/temoignages/nouveau" className="mt-3 inline-flex items-center gap-1 text-indigo-600 text-xs font-medium hover:text-indigo-800 transition-colors">
          Partager un témoignage →
        </a>
      </>
    );
  }

  // Aucun event — vrai état vide
  return (
    <>
      <p className="text-slate-700 text-sm font-medium">Pas encore de live prévu</p>
      <p className="text-slate-400 text-xs mt-1">Rejoignez la communauté des groupes de prière.</p>
      <a
        href="/inscription"
        className="mt-3 inline-flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
      >
        Devenir ambassadeur
      </a>
    </>
  );
}

export default function MapPublique({ nextEvent, lastEvent, liveInProgress, totalAmbassadors, totalCountries, soonThresholdDays }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Groupe leaflet.markercluster — créé une fois dans initMap, alimenté à
  // chaque changement de `hosts` (voir l'effet updatePins plus bas).
  const clusterGroupRef = useRef<Leaflet.MarkerClusterGroup | null>(null);
  const [hosts, setHosts] = useState<HostPin[]>([]);
  const hostsRef = useRef<HostPin[]>([]);
  // Lu (pas fermé sur une valeur figée) par le handler 'clusterclick', bindé
  // une seule fois au montage — sans ce ref le message "pas disponible" du
  // popup de cluster resterait sur la valeur de liveInProgress du premier rendu.
  const liveInProgressRef = useRef(liveInProgress);
  useEffect(() => { liveInProgressRef.current = liveInProgress; }, [liveInProgress]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Distinct de "carte vide" : la toute première requête a échoué (réseau ou
  // 503 db_unreachable) et on n'a encore aucune donnée à afficher à la place —
  // sans cet état, ça retombait dans le même overlay "Pas encore de live prévu"
  // qu'un vrai calme plat, invisible pour quiconque diagnostique une panne DB.
  const [dbError, setDbError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [mapZoom, setMapZoom] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; city: string; country: string; label: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Exposé par initMap() une fois la carte prête ; déclenché par le bouton
  // "Me localiser" rendu en React à côté de la barre de recherche (le contrôle
  // Leaflet natif était en bas à droite, peu visible — voir retour David 2026-09-27).
  const locateHandlerRef = useRef<(() => void) | null>(null);
  const [locating, setLocating] = useState(false);
  // CTA "première fois" (Phase 4) — masquable, mémorisé en localStorage
  // (même pattern que tz-city) pour ne pas fatiguer les visiteurs récurrents.
  const discoverStored = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem('discover-cta-dismissed') === '1';
      } catch {
        return false; // Safari mode privé — pas de crash, bandeau visible par défaut
      }
    },
    () => false
  );
  const [discoverClosedNow, setDiscoverClosedNow] = useState(false);
  const discoverDismissed = discoverStored || discoverClosedNow;
  // Hint "Pas d'ambassade dans votre ville ?" — fermable, non mémorisé (dépend du
  // viewport courant, contrairement au CTA "première fois" qui est global).
  const [noAmbassadorHintDismissed, setNoAmbassadorHintDismissed] = useState(false);
  const wasHintVisibleRef = useRef(false);

  function dismissDiscoverCta() {
    setDiscoverClosedNow(true);
    try { localStorage.setItem('discover-cta-dismissed', '1'); } catch { /* ignore */ }
  }

  // Polling 30s pour les activations
  useEffect(() => {
    async function fetchHosts() {
      setRefreshing(true);
      try {
        const res = await fetch('/api/host-activations');
        if (res.ok) {
          const data = await res.json();
          hostsRef.current = data;
          setHosts(data);
          setDbError(false);
        } else {
          console.error('MapPublique: /api/host-activations a échoué', res.status);
          if (hostsRef.current.length === 0) setDbError(true);
        }
      } catch (e) {
        console.error('MapPublique: /api/host-activations injoignable', e);
        // Réseau indisponible — on garde les données précédentes si on en a déjà
        if (hostsRef.current.length === 0) setDbError(true);
      } finally {
        setRefreshing(false);
        setLoaded(true);
      }
    }

    fetchHosts();
    const interval = setInterval(fetchHosts, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      const L = (await import('leaflet')).default;
      // Import à effet de bord : étend L avec `L.markerClusterGroup`.
      await import('leaflet.markercluster');

      if (cancelled || !containerRef.current) return;
      if ((containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) return;

      const savedView = readSavedMapView();
      const map = L.map(containerRef.current, { zoomControl: false }).setView(
        savedView ? [savedView.lat, savedView.lng] : [20, 10],
        savedView ? savedView.zoom : 3
      );
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      if (cancelled) { map.remove(); return; }
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles by <a href="https://www.openstreetmap.fr" target="_blank">OSM France</a>',
        maxZoom: 20,
      }).addTo(map);

      // Regroupement par proximité en pixels à l'écran (pas par coordonnées
      // exactes) — recalculé automatiquement à chaque zoom/déplacement.
      // zoomToBoundsOnClick/spiderfyOnMaxZoom désactivés : on garde notre
      // propre popup de cluster (liste + tri par distance) au lieu du
      // comportement par défaut du plugin (zoom automatique / éclatement en
      // étoile), pour ne pas changer l'UX existante en plus de corriger le bug.
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        zoomToBoundsOnClick: false,
        spiderfyOnMaxZoom: false,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster: Leaflet.MarkerCluster) => makeClusterIcon(L, cluster.getChildCount()),
      });
      clusterGroup.on('clusterclick', (e: Leaflet.LeafletEvent) => {
        const clusterLayer = (e as Leaflet.LeafletEvent & { layer: Leaflet.MarkerCluster }).layer;
        const group: HostPin[] = clusterLayer.getAllChildMarkers().map((m: Leaflet.Marker) => (m as HostMarker).hostData);
        const leafletId = (clusterLayer as unknown as { _leaflet_id?: number })._leaflet_id;
        const idSafe = leafletId != null ? String(leafletId) : Math.random().toString(36).slice(2);
        const { html, rowsContainerId, sortButtonId, sortHintId, activeGroup } = renderClusterPopup(
          group,
          liveInProgressRef.current,
          idSafe
        );
        clusterLayer.bindPopup(html, { maxWidth: 300 }).openPopup();
        if (activeGroup.length > 1) {
          const btn = document.getElementById(sortButtonId) as HTMLButtonElement | null;
          const hint = document.getElementById(sortHintId);
          const rowsContainer = document.getElementById(rowsContainerId);
          if (btn && !btn.dataset.bound) {
            btn.dataset.bound = '1';
            btn.addEventListener('click', () => sortClusterByDistance(activeGroup, btn, hint, rowsContainer, renderActiveRow));
          }
        }
      });
      clusterGroup.addTo(map);
      clusterGroupRef.current = clusterGroup;

      // Cible de zoom pour le prochain `locationfound` — diffère entre l'auto-locate
      // au chargement (vue métropole, discret) et le bouton manuel (vue ville, plus
      // proche : un clic explicite sur "Trouvez-moi" doit zoomer près, pas l'inverse —
      // corrigé 2026-09-27, le zoom manuel était réglé plus large que l'auto-locate).
      let nextLocateZoom = 9;

      // Bouton "Me localiser" rendu en React (voir JSX) plutôt qu'en contrôle
      // Leaflet natif — celui-ci était en bas à droite de la carte, peu visible
      // (retour David 2026-09-27). La fonction de déclenchement reste ici car
      // elle capture `map` et `nextLocateZoom` par closure.
      locateHandlerRef.current = () => {
        setLocating(true);
        nextLocateZoom = 12;
        map.locate({ enableHighAccuracy: false });
      };
      map.on('locationerror', () => setLocating(false));
      map.on('locationfound', (e: Leaflet.LocationEvent) => {
        // flyTo anime le pan + zoom au lieu du saut sec de setView.
        map.flyTo(e.latlng, nextLocateZoom, { duration: 1.4 });
        nextLocateZoom = 9; // reset pour le prochain auto-trigger éventuel
        setLocating(false);
      });

      // Géolocalisation automatique au premier chargement : zoome sur la zone
      // du visiteur s'il accepte la permission. Si refus → vue monde conservée.
      // enableHighAccuracy: false → résolution ~50km (cell tower / Wi-Fi triangulation)
      // au lieu de ~10m (GPS). Plus rapide (100-500 ms vs 1-5 s) et largement suffisant
      // pour un zoom niveau métropole (zoom 9).
      // Sauté si une position de carte a déjà été mémorisée (retour visiteur) —
      // sinon chaque refresh réanime un flyTo qui écrase la vue que l'utilisateur
      // avait volontairement choisie.
      if (!savedView) {
        map.locate({ enableHighAccuracy: false });
      }

      function updateViewport() {
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        const visible = hostsRef.current.filter(
          (h) => h.lat && h.lng && bounds.contains([h.lat, h.lng] as [number, number])
        );
        setVisibleCount(visible.length);
        setMapZoom(zoom);
        // Ré-autorise le hint "Pas d'ambassade" à réapparaître la prochaine
        // fois que sa condition d'affichage redevient vraie — sinon un clic
        // sur "×" le fermerait définitivement pour toute la session, même
        // après que l'utilisateur ait déplacé la carte vers une autre zone vide.
        const hintVisible = zoom >= 5 && (zoom < 8 || visible.length === 0);
        if (!hintVisible && wasHintVisibleRef.current) {
          setNoAmbassadorHintDismissed(false);
        }
        wasHintVisibleRef.current = hintVisible;
      }
      map.on('moveend zoomend', updateViewport);
      map.on('moveend zoomend', () => saveMapView(map));
    }

    initMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      clusterGroupRef.current = null;
    };
  }, []);

  // Met à jour les pins quand les hosts changent. Chaque hôte devient un
  // marqueur individuel avec son propre popup ; c'est leaflet.markercluster
  // qui décide dynamiquement, à chaque zoom/déplacement, de les afficher tels
  // quels ou fusionnés sous un badge de cluster — plus de regroupement manuel
  // par coordonnées exactes ici (voir renderClusterPopup plus haut).
  useEffect(() => {
    async function updatePins() {
      const clusterGroup = clusterGroupRef.current;
      if (!mapRef.current || !clusterGroup) return;
      const L = (await import('leaflet')).default;

      clusterGroup.clearLayers();

      const markers = hosts
        .filter((h) => h.lat && h.lng)
        .map((host) => {
          // is_full sur un pin grisé est sans objet (D2) — forcer false pour
          // éviter d'afficher rouge sur fond gris.
          const effectiveIsFull = host.is_active ? host.is_full : false;
          const marker = L.marker([host.lat, host.lng], {
            icon: makeIcon(L, host.host_type, effectiveIsFull, host.is_active, host.is_women_only),
          });
          // Porté par le marqueur pour que le handler 'clusterclick' (bindé une
          // fois dans initMap) puisse reconstruire la liste des hôtes du cluster.
          (marker as HostMarker).hostData = host;
          marker.bindPopup(renderSinglePopup(host, effectiveIsFull, liveInProgress), { maxWidth: 280 });
          return marker;
        });

      clusterGroup.addLayers(markers);
    }

    updatePins();

    // Recalcule les pins visibles après chaque mise à jour des hosts
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      const zoom = mapRef.current.getZoom();
      const visible = hosts.filter(
        (h) => h.lat && h.lng && bounds.contains([h.lat, h.lng] as [number, number])
      );
      setVisibleCount(visible.length);
      setMapZoom(zoom);
    }
  }, [hosts, liveInProgress]);

  // Nominatim (OSM) : politique d'usage = 1 req/s par IP.
  // Le debounce 400ms est suffisant pour un usage normal (< ~50 req/min par utilisateur).
  // TODO: migrer vers Photon (Komoot) ou Mapbox Geocoding si la base d'ambassadeurs
  // dépasse ~200 actifs et que le trafic simultané devient significatif (>50 users).
  // Photon est self-hostable et gratuit ; Mapbox nécessite une clé API.
  async function searchCity(query: string) {
    if (query.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    try {
      // Passe par le proxy /api/geocode plutôt que Nominatim direct : il filtre
      // sur featuretype=city et déduplique par label (Nominatim retourne parfois
      // deux entités distinctes pour la même ville, ex: ville + relation
      // administrative, en plus des homonymes internationaux légitimes comme
      // Nantes FR / Nantes BR / Nantes CA).
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSearchResults(data);
      setSearchOpen(data.length > 0);
    } catch {
      // réseau indisponible
    }
  }

  function handleResultClick(lat: number, lng: number) {
    mapRef.current?.flyTo([lat, lng], 10);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full z-0" />
      {/* Barre de recherche par ville + bouton de géolocalisation juste à côté
          (avant : contrôle Leaflet natif en bas à droite, peu visible — retour
          David 2026-09-27). */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto z-[1000] flex items-start gap-2 pointer-events-auto">
        <div className="relative w-full sm:w-64 lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const q = e.target.value;
              setSearchQuery(q);
              if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = setTimeout(() => searchCity(q), 400);
            }}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Rechercher une ville…"
            className="w-full bg-white/95 backdrop-blur-sm border border-slate-100 rounded-xl shadow-md pl-8 pr-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-shadow"
          />
          {searchOpen && searchResults.length > 0 && (
            <ul className="absolute top-full mt-1 w-full bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden">
              {searchResults.map((r, i) => {
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onMouseDown={() => handleResultClick(r.lat, r.lng)}
                      className="w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <span className="font-medium text-slate-800">{r.city}</span>
                      {r.country && r.country !== r.city && <span className="text-slate-400 text-xs ml-1.5">{r.country}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button
          type="button"
          title="Me géolocaliser sur la carte"
          onClick={() => locateHandlerRef.current?.()}
          disabled={locating}
          className="shrink-0 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-slate-100 rounded-xl shadow-md pl-2.5 pr-3 py-2 text-sm font-medium text-indigo-600 whitespace-nowrap outline-none focus:ring-2 focus:ring-indigo-500/30 transition-shadow disabled:opacity-60 disabled:cursor-wait"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={locating ? 'animate-pulse' : ''}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="8" strokeOpacity=".3" />
          </svg>
          <span className="hidden sm:inline">Trouvez-moi</span>
        </button>
      </div>
      {/* Carte vide — overlay contextuel selon l'état de l'app */}
      {/* D7 : conditionné sur le nombre de pins ACTIFS (les grisés ne comptent pas */}
      {/* comme une carte "remplie") — sinon l'overlay disparaîtrait dès qu'il y a */}
      {/* un seul ambassadeur validé non-confirmé pour le live. */}
      {loaded && hosts.filter((h) => h.is_active).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[500] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-lg px-6 py-5 text-center max-w-xs pointer-events-auto">
            <EmptyMapContent
              nextEvent={nextEvent}
              lastEvent={lastEvent}
              liveInProgress={liveInProgress}
              totalAmbassadors={totalAmbassadors}
              totalCountries={totalCountries}
              soonThresholdDays={soonThresholdDays}
              dbError={dbError}
            />
          </div>
        </div>
      )}
      {/* Ambassadeurs existent ailleurs mais pas dans le viewport actuel */}
      {loaded && hosts.length > 0 && mapZoom >= 5 && (mapZoom < 8 || visibleCount === 0) && !noAmbassadorHintDismissed && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-slate-100 shadow-md px-4 py-3 pr-8 text-center relative pointer-events-auto">
            <button
              type="button"
              onClick={() => setNoAmbassadorHintDismissed(true)}
              aria-label="Fermer"
              className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors"
            >
              ×
            </button>
            <p className="text-slate-600 text-xs">Pas d&apos;ambassade dans votre ville&nbsp;?</p>
            <a
              href="/inscription"
              className="mt-1.5 inline-flex items-center gap-1 text-indigo-600 text-xs font-medium hover:text-indigo-800 transition-colors"
            >
              Sois le premier ambassadeur ici →
            </a>
          </div>
        </div>
      )}
      {/* CTA "première fois" (Phase 4) — coin bas-droit pour ne pas chevaucher
          le hint "pas d'ambassade" (centré) ni la recherche (haut-gauche) */}
      {!discoverDismissed && (
        <div className="absolute bottom-6 right-3 z-[500] max-w-[220px]">
          <div className="discover-cta bg-white/95 backdrop-blur-sm rounded-xl border border-indigo-100 shadow-md px-4 py-3 relative">
            <button
              type="button"
              onClick={dismissDiscoverCta}
              aria-label="Fermer"
              className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors"
            >
              ×
            </button>
            <p className="text-slate-800 text-sm font-medium pr-4">C&apos;est votre première fois&nbsp;?</p>
            <a
              href="/decouvrir"
              className="mt-1.5 inline-flex items-center gap-1 text-indigo-600 text-xs font-medium hover:text-indigo-800 transition-colors"
            >
              Découvrir comment ça se passe →
            </a>
          </div>
        </div>
      )}
      {refreshing && (
        <div className="absolute top-3 right-12 z-[1000] bg-white/80 rounded-full p-1.5 shadow-sm">
          <svg className="animate-spin w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
    </div>
  );
}
