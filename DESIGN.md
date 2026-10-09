# Design System — Ambassades de Guérison

## Product Context
- **What this is:** Carte interactive des groupes de prière pour les lives de guérison de David Théry (pasteur, guérison, francophonie)
- **Who it's for:** Ambassadeurs (hôtes) + visiteurs qui cherchent un groupe près de chez eux — audience 65-70% mobile, forte présence africaine francophone
- **Space/industry:** Application communautaire chrétienne francophone
- **Project type:** Web app — carte publique + dashboard ambassadeur + espace admin

## Aesthetic Direction
- **Direction:** Minimal/Chaleureux — blanc, slate, indigo. Pas corporate, pas froid. La propreté d'un outil sérieux au service d'une communauté chaleureuse.
- **Decoration level:** Minimal — la typographie et l'espacement font le travail. Aucun gradient, aucune illustration, aucun blob décoratif.
- **Mood:** Confiance et accueil. L'utilisateur doit sentir que l'app est fiable et que derrière se trouve une communauté réelle.
- **Anti-patterns:** Pas de purple gradient, pas de hero centré générique, pas de 3-col feature grid avec icônes en cercles colorés.

## Typography
- **Display/Hero:** Geist Sans (Next.js default) — clean, moderne, lisible à toutes les tailles. Pas Inter.
- **Body:** Geist Sans — même famille, cohérence maximale
- **UI/Labels:** Geist Sans — idem
- **Data/Tables:** Geist Sans avec `tabular-nums` pour les chiffres alignés
- **Code:** Geist Mono (présent dans le projet)
- **Loading:** Fourni par Next.js `next/font/google` — déjà configuré
- **Scale (Tailwind):**
  - `text-xs` (12px) — métadonnées, labels secondaires
  - `text-sm` (14px) — corps de texte, boutons, cards
  - `text-base` (16px) — paragraphes
  - `text-lg` (18px) — titres de section
  - `text-xl` (20px) — titres de page mobile
  - `text-2xl` (24px) — titres de page desktop

## Color
- **Approach:** Restrained — 1 accent indigo + slate neutrals + emerald sémantique
- **Primary (indigo-600):** `#4f46e5` — CTAs, icônes accent, focus rings, liens actifs
- **Primary dark (indigo-700):** `#4338ca` — hover states sur primary
- **Primary light (indigo-50):** `#eef2ff` — backgrounds légers, badges, icônes en fond
- **Primary muted (indigo-400):** `#818cf8` — icônes secondaires, états passifs
- **Neutral background:** `white` (#ffffff) — surfaces cards, headers
- **Neutral surface:** `slate-50` (#f8fafc) — backgrounds de pages
- **Neutral border:** `slate-100` (#f1f5f9) — borders de cards
- **Neutral muted:** `slate-400` (#94a3b8) — texte secondaire, icônes neutres
- **Neutral body:** `slate-700` (#334155) — texte principal
- **Neutral strong:** `slate-800` (#1e293b) — titres, labels importants
- **Success (emerald-600):** `#059669` — WhatsApp, states positifs, badges actifs
- **Error (red-600):** `#dc2626` — actions destructives (Suspendre, Supprimer)
- **Couleur des actions (règle d'usage) :** positif (Accepter, Valider, Approuver, Publier, Réactiver, Réintégrer) = emerald ; refus ou destructif (Refuser, Suspendre, Supprimer, Bloquer) = red, jamais gris ; annulation ou retour = neutre (slate) ; envoi de formulaire et CTA générique = indigo. Un bouton « Refuser » est au minimum en `bg-red-50 text-red-700` (liste, action secondaire) ou en contour rouge / rouge plein (décision principale). Même règle dans les e-mails (`Btn` : `green` / `red`).
- **Dark mode:** Non implémenté en v1. Aucune `@media (prefers-color-scheme: dark)` dans `globals.css`.

## Spacing
- **Base unit:** 4px (Tailwind default)
- **Density:** Comfortable — ni compact ni spacieux. `p-5` sur les cards, `px-4 py-3` sur les headers.
- **Container padding mobile:** `px-4` (16px) — jamais moins sur mobile
- **Container max-width:** `max-w-lg` (512px) pour les pages focused (inscription, ambassade), `max-w-2xl` (672px) pour les pages riches (dashboard, onboarding)
- **Scale référence:**
  - gap-1 (4px), gap-2 (8px) — séparation d'éléments inline
  - gap-4 (16px) — séparation de blocs dans un composant
  - gap-6 (24px) — séparation entre sections
  - space-y-6 — spacing vertical entre cards dans une page

## Layout
- **Approach:** Grid-disciplined sur mobile, hybrid sur desktop
- **Grid:**
  - Mobile : 1 colonne, `px-4`
  - sm (640px+) : 2 colonnes pour les grilles de cards (`sm:grid-cols-2`)
  - Jamais de 3 colonnes sur les pages publiques
- **Max content width:** `max-w-lg` (forms/detail) ou `max-w-2xl` (listes/dashboard)
- **Border radius:**
  - sm: `rounded-lg` (8px) — inputs, badges, petits boutons
  - md: `rounded-xl` (12px) — boutons principaux, composants intermédiaires
  - lg: `rounded-2xl` (16px) — cards, modals, containers
  - full: `rounded-full` — pills, avatars, loaders circulaires

## Responsive Design — Règles

### Stratégie breakpoints
```
Utiliser uniquement sm: (640px) pour 95% des adaptations mobiles.
md: et lg: réservés aux cas exceptionnels (admin sidebar si besoin futur).
Les classes sans préfixe = mobile first.
```

### Breakpoint sm: (640px) — référence
```
Mobile (<640px)     → sm: (640px+)
─────────────────────────────────────────────────
Sidebar admin: w-14 → sm:w-52
Labels nav admin: hidden → sm:block
Sous-titre AppHeader: hidden → sm:flex flex-col
Labels boutons nav: hidden → sm:inline
Grille cards: grid-cols-1 → sm:grid-cols-2
```

### Touch targets
```
Tout élément interactif sur mobile : min 44px de hauteur
├── Boutons principaux : py-2.5 minimum (40px) ou py-3 (44px) ✓
├── Liens nav : py-2 (32px) acceptable si gap généreux
└── Boutons icon-only : w-11 h-11 (44px) minimum
```

### Textes longs dans les bandeaux pill
```
Règle : jamais de whitespace-nowrap sur strings > 20 caractères
Bandeaux EventBanner :
  Mobile : message court ("Live dans 2h", "Live en cours")
  Desktop (sm:) : message complet avec date et heure
Implémentation : conditions sur la prop calculée, pas de CSS text-overflow
```

### Popups Leaflet
```
maxWidth: 280 (au lieu de 240)
Pas de CSS custom — utiliser les options L.popup()
Le positionnement mobile est géré par Leaflet nativement
```

### Grilles de cards
```
items-start obligatoire — les hauteurs de colonnes sont libres
Éviter items-stretch sur des grilles de contenu éditorial
```

### Admin sidebar (mobile icon-only)
```
<aside className="w-14 sm:w-52 shrink-0 bg-slate-900 flex flex-col">
  {/* Monogramme AG : même identité que AppHeader.tsx (carte publique), mais
      fond indigo-600 plein (pas indigo-50) — le fond quasi-blanc de la version
      claire manque de contraste sur bg-slate-900. Pas de nom complet à côté :
      "Ambassades de Guérison" ne tient pas dans sm:w-52 sans troncature. */}
  <div className="px-4 py-5 border-b border-slate-800">
    <div className="w-7 h-7 shrink-0 bg-indigo-600 rounded-lg flex items-center justify-center">
      <span className="text-[11px] font-bold text-white tracking-tight">AG</span>
    </div>
    <p className="hidden sm:block text-slate-500 text-xs">Espace admin</p>
  </div>
  {/* Nav items : icône toujours, label caché sur mobile */}
  <Link className="flex items-center justify-center sm:justify-start gap-3 px-3 py-2 ...">
    <Icon className="w-4 h-4 shrink-0" />
    <span className="hidden sm:inline">{label}</span>
  </Link>
```

## Motion
- **Approach:** Minimal-functional — seulement les transitions qui aident la compréhension
- **Easing:** `transition-colors` pour les hover/focus, `transition-opacity` pour les états de chargement
- **Duration:** 150ms pour les color transitions (Tailwind default)
- **Pas de:** scroll-driven, entrance animations, keyframes décoratifs

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-24 | sm: comme seul breakpoint | L'app est soit mobile soit desktop, tablettes = desktop |
| 2026-04-24 | Pas de dark mode v1 | Complexité non justifiée pour la v1 |
| 2026-04-24 | Geist Sans conservé | Meilleur que Inter pour la lisibilité à petite taille |
| 2026-04-24 | whitespace-nowrap interdit sur >20 chars | EventBanner overflow sur iPhone SE (320px) |
| 2026-04-24 | Admin sidebar icon-only (pas hamburger) | David = admin solo, icon-only suffit, zéro JS |
| 2026-04-24 | maxWidth popup Leaflet : 280px | 240px trop étroit sur mobile portrait |
| 2026-04-24 | items-start obligatoire sur card grids | Évite l'étirement des colonnes quand une card est expand |
| 2026-05-02 | Geist appliqué via `geist.className` sur body (`layout.tsx`) | Précédemment, `globals.css` référençait `var(--font-geist-sans)` mais la variable était nommée `--font-geist` côté `layout.tsx` → fallback `Arial, Helvetica` partout. Pattern canonique Next.js : `geist.className` directement sur body. |
| 2026-05-02 | ~~Pin églises = indigo-700 (était `#7c3aed` violet-600)~~ — **jamais livré** | Décision prise mais non appliquée au code (`components/MapPublique.tsx:74` utilise toujours `#7c3aed`). Corrigé le 2026-07-27 (`/plan-design-review`) pour refléter l'état réel plutôt qu'une décision non shippée — `CLAUDE.md` documentait déjà correctement le violet. |
| 2026-07-27 | Pin églises = violet `#7c3aed` (confirmé, pas un token du système) | Couleur hors palette officielle (le système ne définit qu'indigo/slate/emerald/red), tolérée uniquement pour ce cas précis car elle distingue visuellement domicile vs église sur la carte publique — pas de gradient, usage ponctuel non extensible à d'autres composants. |
| 2026-05-02 | Touch targets header : `py-2.5 sm:py-1.5` | Mobile = 40px conforme à la règle "Boutons principaux : py-2.5 minimum". Desktop reste compact à 32px (`sm:py-1.5`). Concerne `AppHeader.tsx` + `MonEspaceLink.tsx`. |
| 2026-05-02 | Event J+10 démo fixé à 18h UTC dans `seed.js` | Avant : `daysFromNow(10)` héritait de l'heure du run du seed → EventBanner pouvait afficher des heures aberrantes (ex "00:23"). 18h UTC = 22h Réunion / 20h Paris été / 18h Abidjan : créneau soir cohérent pour la francophonie. |
| 2026-07-27 | Accordéon FAQ (`FaqAccordion`) : touch target 44px minimum par question | Persona "mamie 60 ans à Abidjan" (cf `/plan-design-review`) — `<button>` natif + `aria-expanded`, navigable clavier sans JS custom. |
| 2026-07-27 | CTA "première fois" sur la carte : coin bas-droit, masquable + mémorisé `localStorage` | Évite le chevauchement avec le hint "Pas d'ambassade dans ta ville" (centré) et la barre de recherche (haut-gauche). Même pattern de persistance que `tz-city` pour ne pas fatiguer les visiteurs récurrents. |
| 2026-07-27 | `AddressInput` calqué sur `CityInput` (autocomplétion Nominatim) plutôt qu'un nouveau pattern | Cohérence UX — le visiteur/ambassadeur retrouve la même interaction (dropdown + confirmation) pour ville et adresse précise. |
| 2026-07-29 | Clustering carte publique : `leaflet.markercluster` (proximité pixel) au lieu du groupement par coordonnées exactes | Bug QA : deux ambassadeurs proches mais géocodés à des coordonnées légèrement différentes ne se regroupaient jamais — à faible zoom l'un masquait silencieusement l'autre, sans badge ni indice. Le plugin recalcule le regroupement par distance à l'écran à chaque zoom, pas par égalité stricte de coordonnées. |
| 2026-08-05 | Monogramme "AG" dans `AdminLayout.tsx`, fond indigo-600 plein (pas indigo-50 comme `AppHeader.tsx`), sans nom complet à côté | L'admin affichait seulement "✦ David Théry" — aucun signal reliant l'espace admin au produit. Première tentative avec indigo-50 (calque exact de `AppHeader.tsx`) + nom complet a été rejetée après capture d'écran : contraste trop faible sur `bg-slate-900`, et "Ambassades de Guérison" tronqué dans `sm:w-52`. Monogramme seul + "Espace admin" suffit, cohérent avec l'esprit minimal du design system. |
| 2026-08-06 | Composant `Avatar` (`components/ui/Avatar.tsx`) : photo si disponible, sinon initiale sur fond `indigo-50`/texte `indigo-600`, `rounded-full` | Reprend telle quelle la palette déjà utilisée en HTML string par `avatarHtml()` dans `MapPublique.tsx` (popups Leaflet) — extraite en composant React pour être réutilisable dans `MonEspaceLink.tsx` (header public, 28px), `/mon-espace` (64px) et `/dashboard` (48px). L'admin garde le monogramme "AG" (pas de photo personnelle pour ce rôle) — l'Avatar ne concerne que visiteur/ambassadeur. |
| 2026-10-09 | Notifications (`components/ui/Toast.tsx`) : pile en haut (pleine largeur `inset-x-4` sur mobile, `sm:w-96` à droite sur desktop), fond teinté par ton (emerald/red/amber, blanc pour info), `rounded-2xl shadow-lg`, fermeture 44 px, **sans animation d'entrée** | Haut plutôt que bas : le dashboard ambassadeur a des onglets fixes en bas sur mobile (`DashboardTabs`) qui masqueraient le message. Teintes = celles d'`AdminNotice` et d'`ErrorMessage` (cohérence, pas de nouvelle couleur). Pas d'animation : règle Motion du système. Avertissement (amber) réservé au cas « action faite mais e-mail non parti ». |
| 2026-08-06 | Dashboard ambassadeur (`/dashboard`) : navigation par onglets (bottom tabs mobile, tabs sticky desktop) plutôt qu'une sidebar façon `AdminLayout` | Contenu auparavant empilé en une seule colonne sans navigation — demandes de visite enterrées après 2 sections, rien retrouvable sans scroll. Sidebar écartée : conçue pour un admin solo avec ~9 sections réelles, ici seulement 4 destinations (Accueil/Demandes/Profil/Formation) et audience 65-70% mobile où une colonne latérale coûte de la largeur pour aucun bénéfice de navigation. Bottom tabs = convention native des apps mobiles (Instagram, Uber), zéro scroll pour changer de contexte. Header devenu `sticky top-0`. |
| 2026-10-09 | Espace visiteur (`/mon-espace`) : 3 onglets Demandes · Profil · Guide via `TabNav` (partagé avec le dashboard), onglet actif dans l'URL (`?onglet=`) ; demandes en deux groupes, « En cours » puis « Historique (N) » replié avec « Voir plus » par 5 | Une seule colonne mêlait profil et liste plate triée par date de demande, sans distinguer un live à venir d'un live d'il y a 6 mois. Le plafond de demandes par live (3 par défaut) garde « En cours » court par construction ; c'est l'historique qui grossit, d'où le repli. Chaque carte porte l'action utile (suivre, voir les détails, donner son avis, chercher une autre ambassade) plutôt qu'un lien d'aide par carte. Le Guide reprend `/decouvrir` pour relire l'explication une fois connecté. Même choix que le dashboard (bottom tabs mobile, tabs sticky desktop, pas de sidebar), avec en plus les rôles ARIA `tablist`/`tab`/`tabpanel` et la navigation aux flèches. |
