# Architecture — Ambassades de Guérison

> Vue d'ensemble technique du projet. Le *pourquoi* des choix est dans
> [`decisions.md`](./decisions.md). Le *comment* des composants est dans
> [`../CLAUDE.md`](../CLAUDE.md).

---

## Couches du système

```
┌─────────────────────────────────────────────────────────────┐
│  Navigateur                                                 │
│  Client Components (React) — anon key Supabase              │
│  Leaflet, formulaires, DevOverlay                           │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / fetch
┌────────────────────▼────────────────────────────────────────┐
│  Vercel — Next.js 15 App Router                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Server Components (RSC)  — service_role Supabase   │    │
│  │  app/page.tsx, app/admin/*, app/temoignages/*       │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  API Routes (Edge-compatible Node.js)               │    │
│  │  app/api/**                                         │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Cron Jobs (Vercel Cron)                            │    │
│  │  /api/cron/dispatch-campaigns (08:00 UTC)           │    │
│  │  /api/cron/send-feedback-emails (10:00 UTC)         │    │
│  │  /api/cron/check-activations (09:00 UTC)            │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────────┘
                     │ PostgreSQL (port 6543 — pooler PgBouncer)
┌────────────────────▼────────────────────────────────────────┐
│  Supabase                                                   │
│  PostgreSQL + Auth + RLS + Triggers + Storage               │
└─────────────────────────────────────────────────────────────┘
                     │ API HTTP
┌────────────────────▼────────────────────────────────────────┐
│  Resend                                                     │
│  20 templates TSX (React Email v6) — emails transactionnels │
└─────────────────────────────────────────────────────────────┘
```

---

## Les deux clients Supabase

Règle absolue : deux clients, deux contextes, jamais interchangeables.

| Client | Fichier | Clé utilisée | Respecte RLS | Où |
|--------|---------|-------------|--------------|-----|
| `createServiceClient()` | `lib/supabase/server.ts` | `SUPABASE_SERVICE_ROLE_KEY` | **Non** — bypass RLS | Server Components, API routes |
| `createBrowserClient()` | `lib/supabase/browser.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Oui** | Client Components uniquement |

`service_role` bypass la Row Level Security. Si elle fuit côté client, n'importe qui
peut lire l'intégralité de la base. Le linter de CLAUDE.md interdit l'import de
`lib/supabase/server.ts` depuis un Client Component.

**Port 6543 obligatoire** côté serveur. Les Server Components peuvent créer une connexion
Postgres par requête HTTP. Sans le pooler PgBouncer (port 6543), on dépasse rapidement
la limite de 60 connexions simultanées du plan Supabase gratuit.

---

## Flux de données — Homepage (`/`)

C'est le chemin le plus chargé. Tout tient dans `getHomepageData()`.

```
Visiteur → GET /
  │
  ▼
app/page.tsx (Server Component, revalidate=60s)
  │
  ▼
lib/homepage-data.ts:getHomepageData()
  │  5 requêtes Supabase en parallèle (Promise.all)
  │  ├── nextEvent : prochain event dans le futur
  │  ├── lastEvent : dernier event passé (+ live_link)
  │  ├── totalAmbassadors : COUNT host_profiles WHERE status='validated'
  │  ├── totalCountries : SELECT country GROUP → Set
  │  └── topTestimonials : 20 derniers visibles, triés par longueur, top 5
  │
  ▼
MapWrapper (Client Component, SSR:false pour Leaflet)
  │
  ├── EventBanner  — 4 états selon liveInProgress / nextEvent / lastEvent
  │
  └── MapPublique (dynamic import, ssr:false)
        │
        ▼
      GET /api/host-activations
        │  Requête Supabase service_role
        │  Sélection de l'event de référence :
        │  1. Live en cours (dans la fenêtre WINDOW_H)
        │  2. Prochain event futur
        │  3. Dernier event passé
        │  Retourne les hôtes actifs (is_active=true) pour cet event
        │
        ├── si hosts.length > 0 → pins Leaflet + popup "Contacter"
        └── si hosts.length === 0 → EmptyMapContent (overlay contextuel)
              ├── liveInProgress → "Live en cours / Regarder le live →"
              ├── nextEvent ≤ 2j → "PROCHAIN LIVE / Les ambassades confirment..."
              ├── nextEvent > 2j → "PROCHAIN LIVE / S'afficheront dès confirmation"
              ├── lastEvent only → "Dernier live [date] / Prochain prochainement"
              └── aucun event  → "Pas encore de live prévu / Devenir ambassadeur"
```

**`liveInProgress`** est calculé côté server :
`!lastEvent.closed_at && lastEvent.event_date ≥ now - NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS`
(fenêtre par défaut 4h). Pas de requête DB supplémentaire — `closed_at` est sélectionné dans
la même requête `lastEvent` de `getHomepageData()`. Le check `closed_at` a été ajouté en
août 2026 (v0.1.9.0) : sans lui, un live clôturé via `/admin/live` (« Clôturer le live »)
continuait d'afficher le bandeau "Live en cours" sur la homepage jusqu'à la fin de la fenêtre
horaire, alors que `GET /api/host-activations` (pins carte) excluait déjà ce cas via
`getCurrentEvent()`.

**Panne Supabase indiscernable d'une carte vide (corrigé août 2026).** `getHomepageData()`
et `GET /api/host-activations` ne lisaient que `.data` sur leurs requêtes Supabase, jamais
`.error` — une panne DB (ex : projet Supabase en pause après 7 jours d'inactivité, cf
knowledge-transfer.md) produisait exactement la même forme de données qu'un état
légitimement calme (`nextEvent=null`, `[]` pins), sans aucun log serveur. Trouvé en
investigant pourquoi la carte publique affichait "Pas encore de live prévu" pendant une
pause du projet. Désormais : `GET /api/host-activations` distingue "0 lignes" de "requêtes
en échec" et retourne `503 {"error":"db_unreachable"}` + log serveur dans ce dernier cas ;
`getHomepageData()` logge toute requête en échec sans casser le rendu SSR ; `MapPublique.tsx`
affiche un état `dbError` dédié ("Carte momentanément indisponible") prioritaire sur tous
les autres états de `EmptyMapContent`, pour ne jamais montrer le CTA "Devenir ambassadeur"
pendant une panne.

---

## Cycle de vie d'un ambassadeur

Pipeline self-service jusqu'au questionnaire — l'admin n'intervient qu'à la fin, sur un dossier complet.

```
/inscription — étape 0 : confirmer son adresse e-mail AVANT le formulaire
  │  POST /api/inscriptions/verify-email → lien /inscription?verify=<jeton signé> (HMAC, 24 h,
  │  sans état : lib/auth/email-proof.ts). Aucun compte ni profil n'existe à ce stade.
  │  Le lien ouvre le formulaire avec l'adresse verrouillée (GET /api/inscriptions/verify-email
  │  valide le jeton). Sans cette étape, n'importe qui inscrivait l'adresse d'un tiers (profil
  │  rattaché à son compte, rôle d'un compte visiteur existant basculé en « host »).
  │  POST /api/inscriptions (exige `email_proof` valide pour cette adresse, sinon 403 `email_not_verified`)
  │  → status = 'pending_review'
  │  → réponse `login: { token_hash, type }` (adresse déjà prouvée) que le navigateur échange contre une
  │    session (`verifyOtp`) : exception documentée à « jamais de token_hash dans une réponse », cf CLAUDE.md
  │  → email sendRegistrationConfirmation (bouton → /dashboard ; le jeton unique est consommé par le navigateur)
  ▼
/dashboard (encart pending_review : vidéo + PDF + checkbox CGU + bouton)
  │  candidat regarde la vidéo, télécharge le guide, accepte les conditions
  │  PATCH /api/onboarding/complete  (auth, plus aucune action admin)
  │  → status = 'pre_approved' (idempotent : 200 noop si déjà ≥ pre_approved)
  │  → log structuré, aucun email envoyé
  ▼
/dashboard/questionnaire (ambassadeur, accessible dès pre_approved)
  │  Upload photos via POST /api/upload/ambassador-photo (type=profile|room)
  │   - Photo de profil : requise (path stocké dans profile_photo_url)
  │   - Photos du lieu : requise (au moins 1), max 5 (paths dans room_photo_urls[])
  │  Suppression d'une photo : DELETE /api/upload/ambassador-photo
  │   (ownership check par préfixe profile.id/)
  │  Réponses enregistrées en brouillon (PATCH …/enrichissement avec draft:true), sans changer le statut
  │  Vidéo facultative : POST/PATCH /api/ambassadeur/video (bucket privé ambassador-videos, envoi direct par URL signée)
  │  PATCH /api/ambassadeur/enrichissement (envoi final)
  │  → status = 'enrichment_pending'
  │  → garde : refuse si photo de profil / photo du lieu manquante, ou si une réponse obligatoire manque
  │    (fréquentation, dénomination ou famille d'église sauf « sans église », fonction de responsabilité, guérisons vues,
  │    message d'accueil, `live_screen` = « sur quoi regarderez-vous le live »)
  │    — la vidéo, la liste formations/livres et le parcours écrit ne bloquent pas
  │  → email sendEnrichissementRecu (notification admin)
  ▼
/admin/ambassadeurs (revue du dossier complet)
  │  PATCH /api/admin/ambassadeurs/[id]/status { action: 'validated' }
  │  → status = 'validated'
  │  → email sendValidationFinale (bienvenue ambassadeur)
  │  → trigger DB crée host_activations (is_active=false) pour tous les events futurs
  ▼
Hôte visible sur la carte au prochain live
  (après réception de la campagne email et clic sur le lien d'activation)
```

Transitions admin valides (`PATCH /api/admin/ambassadeurs/[id]/status`) :
- `validated` (depuis enrichment_pending uniquement)
- `validated_bypass` (escape hatch API uniquement — plus de bouton UI ; usage support/script SQL)
- `rejected` (depuis n'importe quel statut) — envoie `sendRefusCandidature` au candidat si `profile.user_id` a un email associé (message sobre + raison optionnelle reprise du champ `notes` du payload)
- `suspended` (depuis validated)
- `reactiver` (depuis suspended ou rejected) — restaure `validated` (+ email) **uniquement si le dossier est complet** (`profile_photo_url` non NULL et `room_photo_urls` non vide) ; sinon route vers `enrichment_pending` sans email. Empêche de valider silencieusement un candidat refusé avant d'avoir jamais complété son questionnaire (même risque que `validated_bypass`, sans le bouton dédié pour s'en prémunir).

L'action `pre_approve` n'existe **plus** côté admin — la transition `pending_review → pre_approved` est exclusivement self-service.

---

## Cycle de vie d'un live (de l'annonce aux pins)

```
David crée le live dans /admin/calendrier (section Lives)
  │  → INSERT INTO events (title, event_date, live_link, ...)
  │
  ▼
David programme une campagne dans /admin/calendrier (section Campagnes)
  │  → INSERT INTO scheduled_campaigns
  │  → INSERT INTO campaign_recipients (snapshot des hôtes validés à l'instant t)
  │
  ▼
Cron /api/cron/dispatch-campaigns (quotidien, ou immédiat si scheduled_at ≤ now)
  │  → email sendCampagneAmbassadeurs à chaque recipient
  │     (lien personnalisé avec token d'activation)
  │
  ▼
Hôte clique le lien dans l'email
  │  POST /api/campaign-activations
  │  → host_activations.is_active = TRUE pour cet event
  │
  ▼
Carte publique — le pin apparaît
  │  GET /api/host-activations
  │  → hôte retourné dans la liste, pin Leaflet affiché
  │
  ▼
Pendant le live — visiteur contacte un hôte
  │  POST /api/contact-requests (ou /api/visit-requests)
  │  → email contact-received-host (hôte notifié : prénom, e-mail, message + lien /accueillir/[token] + lien /refuser/[token] — sans téléphone)
  │  (deux jetons par demande : `action_token` = hôte seul, `visitor_token` = visiteur — `/accept` n'a pas
  │   d'authentification, donc `action_token` ne quitte jamais l'hôte ; cf CLAUDE.md § Modération anti-abus)
  │  → hôte accepte via /accueillir/[token] → email acceptation-visite (adresse + email + WhatsApp de l'hôte)
  │     ou hôte refuse via /refuser/[token] → email refus-visite (visiteur redirigé vers la carte)
     (deux refus possibles, composant `DeclineChoice` : « Pas disponible cette fois » → la personne peut redemander
      pour un autre live ; « Ne plus accueillir cette personne » → `contact_requests.declined_permanently = TRUE`,
      plus aucune demande de ce visiteur chez cette ambassade, tous lives confondus — `lib/visitor/declined-by-host.ts`,
      403 dans POST /api/visit-requests. Le second demande une confirmation et n'a pas de recours dans l'app :
      si c'était une erreur, l'équipe repasse `declined_permanently` à FALSE en base.)
  │
  ▼
Après le live
  │  Hôte soumet un signal → POST /api/live-signals
  │  Visiteur soumet un témoignage → POST /api/temoignages
  │  Admin modère → /admin/temoignages
  │
  ▼
Admin clique "Clôturer le live" (/admin/live)
  │  POST /api/admin/live/close
  │  → host_activations.is_active = FALSE (pins retirés de la carte publique)
  │  → events.closed_at = now() (exclu de getCurrentEvent() "en cours")
  │  → getCurrentEvent() bascule sur le dernier live passé / prochain live futur
```

---

## Profil visiteur réutilisable + distance éphémère

Ajouté en juillet 2026 pour répondre à un besoin concret : un visiteur qui contacte
plusieurs hôtes ne devrait pas retaper son téléphone/adresse à chaque demande, et un
visiteur devrait pouvoir trouver l'ambassade la plus proche sans que l'app ne stocke
jamais où il habite.

**Révisé en Phase 3 PR3** : la création de compte visiteur, initialement en best-effort
et silencieuse depuis `/api/visit-requests`, expose désormais un écran de compte
explicite (`/mon-espace/creer`) — l'ancienne approche acceptait n'importe quel email non
authentifié et pouvait écraser le profil d'un visiteur existant (faille trouvée par
Codex, cf `/plan-eng-review`).

```
Visiteur clique "Contacter" sur /ambassade/[id] ou /live/.../ambassade/[host_id]
  │  ContactForm / VisitRequestForm vérifient GET /api/visitor/profile au montage
  │  Pas de session visiteur → CTA "Créer mon compte" → /mon-espace/creer?redirect=...
  ▼
/mon-espace/creer — prénom, e-mail, téléphone (obligatoire), photo de profil (optionnelle)
  │  POST /api/visitor/check-email (blur, rate-limité 10/min) → classifyVisitorEmail()
  │     'new'              → formulaire continue
  │     'visitor_existing' → propose un renvoi de magic link
  │     'collision'        → refus (email host/admin/auth existant), message neutre
  ▼
POST /api/visitor/account (rate-limité 3/min, revalide la classification)
  │  → crée le compte Supabase Auth (user_metadata.role='visitor', email pré-confirmé)
  │  → insert visitor_profiles (user_id, first_name, email, phone, photo_url)
  │     photo optionnelle : bucket privé `visitor-photos`, compressée WebP, validée
  │     par magic bytes (sharp), jamais bloquante en cas d'échec de traitement
  │  → generateLink({ type: 'magiclink' }) puis sendVisitorCompteCree (attendu, 502 si
  │     l'envoi échoue). Le jeton n'est JAMAIS renvoyé au navigateur : la session ne
  │     s'ouvre que par le clic sur ce lien (vérification réelle de l'adresse — sinon
  │     n'importe qui créerait un compte avec l'e-mail d'un tiers).
  ▼
Écran « Regardez votre boîte mail » (/mon-espace/creer) — bouton « Renvoyer le lien »
  │  (POST /api/auth/magic-link, qui transmet aussi `redirect`)
  ▼
Clic sur /auth/confirm?token_hash=...&type=<type du jeton>&redirect=<page d'origine>
  │  (construit par buildConfirmUrl ; `redirect` filtré par lib/auth/safe-redirect.ts)
  │  → /auth/confirm route sur user_metadata.role : admin → /admin/stats,
  │     visitor → page d'origine (ou /mon-espace), sinon → /dashboard
  ▼
Formulaire de demande de visite pré-rempli ("Connecté avec {email}", nb personnes,
message, consentement notifications) → POST /api/visit-requests
  │  Exige une session visiteur authentifiée (401 sinon) — prénom/email/téléphone
  │  viennent de visitor_profiles, jamais du body de la requête
  │  Plafond : au plus `max_requests_per_visitor_per_event` demandes en cours (pending +
  │  accepted, 3 par défaut) par visiteur et par live, sinon 429. Une demande refusée ou
  │  sans réponse libère sa place. Réglable dans /admin/settings/timing
  │  (event_timing_config, lib/visitor/request-limit.ts)
  ▼
/mon-espace — 3 onglets (`TabNav`, onglet actif dans l'URL : `?onglet=demandes|profil|guide`, « Demandes » par défaut)
  │  • Demandes (`components/MesDemandes.tsx`, `GET /api/visitor/requests`) : « En cours » (live à venir,
  │    en attente ou acceptée, le live le plus proche d'abord) puis « Historique (N) » replié, « Voir plus »
  │    par 5. Tri dans `lib/visitor/group-requests.ts` (live terminé = `closed_at` OU fenêtre
  │    `NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS` écoulée). Action par carte : « Suivre ma demande » /
  │    « Voir les détails » → `/visitor/[token]`, « Donner mon avis » → `/feedback/[token]` (acceptée, live
  │    passé), « Chercher une autre ambassade » → `/`. Une demande restée « en attente » après son live
  │    s'affiche « Sans réponse ». Badge de l'onglet = demandes en attente d'un live à venir.
  │    La réponse renvoie `visitor_token` (jeton du visiteur, aucun pouvoir d'acceptation) mais jamais
  │    `action_token` (jeton de l'hôte) ; `declined_permanently` apparaît comme un refus ordinaire.
  │    Dates affichées dans le fuseau du navigateur (`formatLiveDate` + `useBrowserTimezone`).
  │  • Profil (`components/visitor/ProfilTab.tsx`) : e-mail, téléphone éditable, photo, déconnexion.
  │  • Guide (`components/decouvrir/DecouvrirContent.tsx`, partagé avec la page publique `/decouvrir`) :
  │    comment se passe une visite, FAQ, témoignage vedette. `app/mon-espace/page.tsx` est un Server
  │    Component (revalidate 60) qui charge le témoignage et le passe à `MonEspaceClient`.
  │  Les trois panneaux restent montés (`hidden`) : saisie du téléphone, FAQ et historique ne se perdent pas.
  │  PAS un dashboard complet — juste assez pour ne pas retaper ses infos et suivre ses demandes
```

**Photo de profil visiteur.** Distincte des photos ambassadeur (`ambassador-photos`) :
bucket Storage privé dédié `visitor-photos`. Signed URL toujours générée **côté
serveur** (`GET /api/visitor/profile` retourne `photo_signed_url`, via
`createServiceClient()`) — jamais côté client avec le SDK anon, pour rester
cohérent avec `lib/storage/photo-url.ts` et ne pas dépendre de l'état RLS/session
du SDK browser. Upload/remplacement/suppression après création de compte via
`POST`/`DELETE /api/upload/visitor-photo` (même pattern que
`POST /api/upload/ambassador-photo`, compression `compressAmbassadorPhoto` en
WebP 512×512). Visible par l'hôte concerné via `POST /api/dashboard/contact-photos`
(signed URL 15 min, vérifie que la demande de visite appartient bien à un
`host_activation` de l'hôte connecté avant de révéler la photo — ne fuit jamais
l'email/téléphone du visiteur par cette route).

**Distance ambassadeur ↔ visiteur — jamais de stockage d'adresse visiteur.**
`components/MapPublique.tsx` (bouton "Trier par distance" dans les popups de cluster)
appelle explicitement `navigator.geolocation.getCurrentPosition()` (jamais auto-déclenché,
jamais piggybacké sur la géolocalisation d'ouverture de carte) puis POST `/api/distance`
avec les coordonnées + une liste d'`host_profile_id` (max 20). `lib/geo/distance.ts:haversineKm()`
calcule côté serveur et **arrondit à l'entier km** — mitigation volontaire contre un
oracle de triangulation (interroger la distance à répétition depuis plusieurs points ne
permettrait de reconstruire qu'une position à ±500m, pas les coordonnées précises).
`proxy.ts` rate-limite la route à 8 req/min/IP. Les coordonnées du visiteur ne sont
jamais persistées — la géolocalisation est éphémère, calculée à la demande.

**`lat_precise` / `lng_precise` (ambassadeur)** — distinct de `quartier` : `quartier`
est un texte libre public (ex: "Paris 15e"), affiché sur la carte pour donner un signal
de proximité. `lat_precise`/`lng_precise` viennent de l'adresse complète saisie via
`AddressInput` (Nominatim `mode=address`), **jamais publics**, utilisés uniquement par
`/api/distance` pour le calcul de proximité.

### Jitter décoratif carte publique — `lib/geo/jitter.ts`

Ajouté 2026-09-27 (retour David, discussion `/office-hours`). Problème observé : le
geocodage se fait au niveau **ville**, pas adresse — plusieurs ambassadeurs d'une même
ville obtiennent des `lat`/`lng` strictement identiques (le seed en donne un exemple
volontaire : 6 ambassadeurs Paris à `48.8698, 2.3315` pile). Résultat, ils s'empilaient
au même pixel sur la carte publique, à n'importe quel niveau de zoom — un artefact de
base de données visible en démo, pas juste un cas limite théorique.

`GET /api/host-activations` applique désormais `jitterCoordinates(lat, lng, host_id)` à
chaque pin avant de le renvoyer : décalage pseudo-aléatoire mais **déterministe** (haché
sur `host_id`, jamais recalculé à la volée), rayon 250m par défaut, échantillonné en
`r = R·√u` pour une répartition visuellement uniforme dans le disque plutôt que
concentrée près du centre. Stable entre deux refresh de la carte (`MapPublique.tsx`
poll toutes les 5s) — un jitter qui bougerait à chaque appel ferait "sauter" les pins,
pire que le problème d'origine.

**Décision explicitement écartée : dériver le jitter de `lat_precise`/`lng_precise`
(façon Airbnb — flouter l'adresse réelle plutôt que la ville).** Ça résoudrait le même
problème visuel de façon "plus vraie", mais un second avis obtenu pendant la session
`/office-hours` a identifié une faille concrète pour cette app spécifiquement : publier
un point public ancré (même flouté à 500m-1km) sur la vraie adresse transformerait
`/api/distance` — déjà un oracle de triangulation contre les vraies coordonnées,
mitigé par le rate-limit (8 req/min/IP) et l'arrondi au km — en oracle de **raffinement
local** : au lieu de chercher à l'aveugle sur toute une ville, un attaquant reçoit
gratuitement (sans consommer le rate-limit) une zone de recherche réduite à 500m-1km,
ce qui réduit le nombre de requêtes nécessaires d'un ou deux ordres de grandeur et rend
l'attaque moins détectable. Aggravé par le fait que le public de l'app inclut des hôtes
en zone rurale/périurbaine (Réunion, Afrique francophone, petites villes) où un rayon de
flou de 500m peut ne laisser que 5-20 bâtiments candidats — bien en-deçà de la densité
qui protège ce type de technique dans une grande ville dense.

Le jitter décoratif (`lib/geo/jitter.ts`) évite ce risque par construction : il ne
dérive **jamais** de `lat_precise`/`lng_precise`, donc ne peut ancrer aucune attaque
contre `/api/distance`. Contrepartie assumée : le pin jitteré ne correspond à rien de
réel, c'est un habillage visuel pur — `quartier` (label texte) et "Trier par distance"
(popup de cluster, calcul serveur) restent les seuls signaux de proximité réels sur la
carte publique.

---

## Routes API — carte des domaines

| Préfixe | Domaine | Auth requise |
|---------|---------|-------------|
| `/api/host-activations` | Pins carte publique | Non (lecture publique) |
| `/api/visit-requests` | Visiteur → hôte — route unique de création (l'ancienne `/api/contact-requests` a été supprimée, code mort). Exige une session visiteur authentifiée depuis Phase 3 PR3 (401 sinon) | Session visiteur |
| `/api/distance` | Distance visiteur ↔ ambassadeurs (Haversine, arrondi au km) | Non (rate-limité 8 req/min/IP) |
| `/api/visitor/account` | Création de compte visiteur (`/mon-espace/creer`) — la session s'ouvre au clic sur le lien e-mail | Non (rate-limité 3 req/min/IP) |
| `/api/visitor/check-email` | Classification email au blur (`new`/`visitor_existing`/`collision`) | Non (rate-limité 10 req/min/IP) |
| `/api/visitor/profile` | Lecture/édition du profil visiteur réutilisable (`visitor_profiles`) — GET retourne aussi `photo_signed_url` (signée côté serveur) | Session visiteur |
| `/api/upload/visitor-photo` | Upload/suppression de la photo de profil visiteur (bucket `visitor-photos`), depuis `/mon-espace` | Session visiteur |
| `/api/dashboard/contact-photos` | Photo de profil visiteur visible par l'hôte (signed URL, ownership vérifié) | Session hôte |
| `/api/temoignages` | Soumission témoignage public | Non |
| `/api/testimonials` | Lecture/modération témoignages | Admin |
| `/api/live-signals` | Signaux live depuis dashboard hôte | Session hôte |
| `/api/inscriptions` | Création profil ambassadeur — exige une preuve d'e-mail (`email_proof`) | Non (preuve e-mail) |
| `/api/inscriptions/verify-email` | Envoi du lien de confirmation d'adresse (POST, 3/min/IP) et validation du jeton (GET) — avant tout compte | Non |
| `/api/onboarding/complete` | Self-service : pending_review → pre_approved (CGU acceptées) | Session candidat |
| `/api/onboarding/config` | Config vidéo + PDF onboarding | Public (lecture) / Admin (écriture) |
| `/api/ambassadeur/enrichissement` | Enrichissement profil (questionnaire) | Session hôte |
| `/api/ambassadeur/profile` | Édition profil (ville, adresse précise, consignes, téléphone) | Session hôte |
| `/api/feedbacks` | Feedback bidirectionnel post-live (visiteur↔hôte) + blocage visiteur | Token (visiteur) / Session hôte |
| `/api/admin/*` | Toutes les actions admin | Admin uniquement |
| `/api/campaign-activations` | Activation hôte via lien email | Token signé |
| `/api/cron/*` | Jobs planifiés Vercel Cron | `CRON_SECRET` header |
| `/api/auth/magic-link` | Génération lien de connexion | Admin (rate-limité 3 req/min/IP) |
| `/api/geocode` | Proxy Nominatim (autocomplétion ville + `mode=address` pour adresse précise) | Non |
| `/api/unsubscribe/[token]` | Désabonnement email campagne | Token |
| `/api/dev/*` | Simulation états DB | Dev uniquement (`NODE_ENV=development`) |

---

## Transparence des données (RGPD)

Ajouté le 2026-08-07 (TODO-23). Deux niveaux, volontairement séparés : la
transparence **au moment de la saisie** (qui ne dépend de personne) et la
politique formelle (qui attend des informations que seul David détient).

### Règle : tout champ collecté dit sa finalité, à côté du champ

`/mon-espace/creer` porte une légende `text-xs text-slate-400 mt-2` sous chaque
champ : à quoi il sert, et qui le voit. Le motif de référence est celui de la
photo — *« Aide l'ambassadeur à savoir qui il accueille — jamais publiée, visible
uniquement par lui »* — qui énonce finalité + destinataire + non-publication.

Un audit du 2026-08-07 a montré l'inverse de ce qu'on attendrait : la photo (champ
le plus sensible, facultatif) était bien expliquée, tandis que le **téléphone —
seul champ obligatoire** — n'avait aucune légende. Ne pas réintroduire un champ
sans sa finalité, en particulier s'il est requis.

### Règle : consentement jamais pré-coché

`visitor_notifications_optin` est initialisé à `false` dans
`app/ambassade/[id]/ContactForm.tsx` **et**
`app/live/[event_id]/ambassade/[host_id]/VisitRequestForm.tsx` (les deux
formulaires portaient le défaut). Ce n'est pas un arbitrage produit : la CJUE a
jugé le 1er octobre 2019 qu'une case cochée par défaut ne vaut pas consentement —
le RGPD exige un « acte positif clair », ce qui exclut le silence, les cases
pré-cochées et l'inaction. **Ne jamais repasser ce défaut à `true`** pour gonfler
le volume d'inscrits.

Le libellé mentionne la sortie (« Désinscription possible à tout moment »), ce que
`GET /api/unsubscribe/[token]` honore réellement depuis le correctif du même jour.

### Durées de conservation

Valeurs par défaut alignées sur le référentiel CNIL (3 ans à compter du dernier
contact actif pour un contact/prospect), déclarées en constantes en tête de
`app/confidentialite/page.tsx` :

| Donnée | Durée annoncée |
|--------|----------------|
| Demandes de visite | 12 mois après le live |
| Compte visiteur | 3 ans sans activité |
| Témoignages publiés | tant que publiés, suppression sur demande |
| Profil ambassadeur | 12 mois après retrait de l'ambassade |

⚠️ **Ces durées sont annoncées, pas appliquées** — aucune purge automatique
n'existe. Écart à combler avant un lancement public : soit un cron de purge, soit
une révision du texte.

### Règle : le téléphone du visiteur n'est montré à l'hôte qu'après acceptation

Corrigé 2026-10-01. Avant, le numéro partait à l'hôte dès l'envoi de la demande
(e-mail `contact-received-host` + dashboard, même pour une demande refusée), alors
que la légende de `/mon-espace/creer` disait « s'il accepte votre demande » — un
écart entre finalité annoncée et traitement réel.

Désormais : l'e-mail de notification ne contient plus le numéro, et
`app/dashboard/page.tsx` n'affiche « Tél : » que si `status === 'accepted'`.
`/feedback/host/[token]` lit `visitor_phone` mais filtre déjà sur `status = 'accepted'`
(le numéro sert à bloquer un visiteur, voir ci-dessous).

**Pourquoi le numéro reste obligatoire.** Il ne sert pas à discuter avant
l'acceptation, mais à deux choses : joindre le visiteur le jour du live (l'hôte
a l'e-mail/WhatsApp du visiteur dans l'autre sens seulement après acceptation), et
**faire respecter la blacklist** (`POST /api/visit-requests` compare e-mail *ou*
téléphone — une adresse e-mail se recrée en secondes, un numéro beaucoup moins
facilement). Sans lui, un visiteur bloqué reviendrait avec une autre adresse.
Légendes et `/confidentialite` disent ces deux usages en français simple.

⚠️ **Masquage côté affichage seulement.** Le dashboard lit `contact_requests` avec la
clé anon (RLS) : `visitor_phone` reste dans la réponse réseau pour les demandes en
attente. Un vrai blocage demanderait une route serveur qui ne renvoie le numéro
qu'aux demandes acceptées.

### Lien vers /confidentialite depuis la homepage

Corrigé 2026-08-08 : le lien n'existait auparavant que sur `/mon-espace/creer`,
inatteignable pour un visiteur qui consulte la carte publique sans jamais créer
de compte — la page la plus visitée du site. La correction précédente de cette
doc affirmait que l'app "n'a pas de footer" et qu'en ajouter un "casserait la
carte plein écran" ; c'était inexact. `app/page.tsx` a **déjà** un footer
(`shrink-0`, sous la carte `flex-1`, layout `h-screen flex-col`) — le lien y a
été ajouté directement, sans nouveau composant ni décision de layout. Ne pas
réintroduire l'idée que la home n'a pas de footer sans revérifier le fichier.

### Points ouverts

- **Suppression de compte visiteur** — aucun chemin dans l'app. La politique
  renvoie vers l'e-mail de contact (acceptable en v1, un bouton dans
  `/mon-espace` serait plus propre).
- **Registre des traitements** — obligatoire pour une association même sans
  déclaration CNIL. Document interne, hors code.

---

## Sécurité — points critiques

**RLS (Row Level Security)** — PostgreSQL garantit qu'un hôte ne peut pas lire les
données d'un autre hôte, sans une ligne de code côté applicatif.
Les policies RLS sont définies directement dans Supabase.

**`service_role` côté serveur uniquement.** Toute route API qui contourne RLS
(admin, cron, inscriptions) utilise `createServiceClient()`.
Toute action initiée par un utilisateur connecté (dashboard, formulaires) utilise
`createBrowserClient()` avec la clé anon — la RLS fait le filtrage.

**Routes admin protégées** via `lib/auth/require-admin.ts` : vérifie
`user_metadata.role === 'admin'` dans la session Supabase.

**Routes cron protégées** via le header `Authorization: Bearer CRON_SECRET`.

**DevOverlay — gated par flag + secret.** `components/DevOverlay.tsx` se rend si
`NODE_ENV !== 'production'` OU `NEXT_PUBLIC_DEV_OVERLAY === 'true'`. En production,
les routes `/api/dev/state` et `/api/dev/magic-link` exigent en plus un header
`x-dev-secret` valide (comparé à `DEV_OVERLAY_SECRET`). Helper centralisé :
`lib/dev-overlay-auth.ts:isDevOverlayAuthorized()`. La route magic-link est
sensible (génère un lien admin pour n'importe quel email) — sans secret, 403.

**`/dev/emails` — `EMAIL_PREVIEW=true` uniquement.** La route retourne 404 si la
variable d'environnement n'est pas exactement `"true"` (la chaîne `"false"` est truthy
en JS — le guard utilise `=== 'true'`).

**Photos hôtes — bucket privé.** Le bucket Supabase `ambassador-photos` est `public: false`. Les colonnes `profile_photo_url` et `room_photo_urls` dans `host_profiles` stockent un *chemin* Supabase Storage, pas une URL publique. Lire via `lib/storage/photo-url.ts` : `getOwnerPhotoUrl(path)` pour l'ambassadeur lui-même (signed URL courte), `getAdminPhotoUrl(path)` pour la fiche admin. Les **photos du lieu** ne sont jamais exposées (carte publique, `/ambassade/[id]`). La **photo de profil** est, elle, assumée publique une fois l'ambassade active (petit avatar dans les popups de la carte, via `getPublicMapPhotoUrls`) — le texte du questionnaire, du dashboard et de `/confidentialite` le dit explicitement (corrigé 2026-09-30 : il affirmait « vue uniquement par David », ce qui était faux). Photo dans le popup carte : `getPublicMapPhotoUrls()` (signed URLs 24h, cache en mémoire) — uniquement pour les hôtes actifs, jamais l'adresse.

**`/api/auth/magic-link` rate-limité** (3 req/min/IP, `proxy.ts`) — génère un lien de connexion admin pour n'importe quel email ; sans rate-limit, un attaquant pourrait épuiser la quota Resend ou sonder l'existence de comptes.

**`/api/distance` — jamais de coordonnées en retour, jamais de stockage.** Voir « Profil visiteur réutilisable + distance éphémère » ci-dessus. Rate-limité 8 req/min/IP, arrondi au km (anti-triangulation), max 20 `host_profile_id` par requête. `e2e/rls-isolation.spec.ts` vérifie que `lat_precise`/`lng_precise` ne fuient jamais dans `/api/host-activations` ni dans la réponse de `/api/distance`.

---

## Rendu — Server vs Client

| Composant | Type | Pourquoi |
|-----------|------|---------|
| `app/page.tsx` | Server Component | Fetch Supabase direct, pas d'état client |
| `MapWrapper` | Client Component | Leaflet nécessite `window` |
| `MapPublique` | Client Component (`dynamic`, `ssr:false`) | Leaflet + fetch `/api/host-activations` |
| `EventBanner` | Client Component | Countdown en temps réel (`setInterval`) |
| `DevOverlay` | Client Component | État local + mutations via `fetch` |
| `ToastProvider` / `useToast` | Client Component | Notifications de confirmation, montées dans `app/layout.tsx` (survivent à `router.refresh()`). Les routes qui envoient un e-mail l'attendent et remontent `candidateEmail` / `emailSent` — voir CLAUDE.md § Notifications |
| `app/admin/*` | Server Components + Client Components mixtes | Données init en SSR, interactions en client |
| `TemoignageCard` | Client Component | "Lire la suite" (expand/collapse état local) |
| `MissionDuMoment` | Client Component | Carte contextuelle prioritaire — 5 états selon live/demandes/agenda ; `null` si calme |
| `StatusTimeline` | Client Component | Stepper 4-étapes — **uniquement pour non-validés** (`pending_review`, `pre_approved`, `enrichment_pending`). Revérifie `profilePhotoUrl`/`roomPhotoUrls` avant d'afficher l'étape "Profil enrichi" comme atteinte — un `status='enrichment_pending'` sans dossier complet (possible seulement via donnée créée hors du flux API, ex. script/test) retombe visuellement sur l'étape précédente plutôt que d'afficher un faux "en cours d'examen" (trouvé 2026-08-07, cf `app/dashboard/page.tsx` où l'encart "Ton dossier est en cours d'examen" applique la même garde). |
| `TabNav` | Client Component | Barre d'onglets générique (`components/ui/TabNav.tsx`) : bottom tabs mobile + tabs sticky desktop, `role="tablist"`/`tab`, flèches/Début/Fin au clavier, badge compteur ambre. Utilisée par `DashboardTabs` et `/mon-espace`. Les panneaux portent `role="tabpanel"` avec `tabPanelId`/`tabButtonId`. |
| `DashboardTabs` | Client Component | Enveloppe de `TabNav` pour `/dashboard` (Accueil/Demandes/Profil/Formation) — **uniquement pour validés**. Badge compteur sur "Demandes". Onboarding reste linéaire (pas d'onglets). L'onglet actif reste un état local (pas dans l'URL, contrairement à `/mon-espace`). |
| `DecouvrirContent` | Server-compatible | Contenu de « Votre première visite » (réassurance, étapes, FAQ, témoignage, CTA), partagé par `/decouvrir` et l'onglet « Guide » de `/mon-espace`. Le témoignage vient de `lib/decouvrir/featured-testimonial.ts`. |
| `MesInfosSection` | Client Component | Formulaire édition profil (ville + adresse précise + consignes + tel) |
| `AddressInput` | Client Component | Autocomplétion Nominatim `mode=address` — calqué sur `CityInput` |
| `FaqAccordion` | Client Component | Accordéon accessible (`<button aria-expanded>`), état local d'ouverture, ids via `useId()` (présent sur `/decouvrir` et dans `/mon-espace`) |

**Polling** : `MapPublique` et `AdminFeed` refetchent toutes les 5 secondes.
Pas de WebSocket — Supabase Realtime ajouterait de la complexité pour un usage
qui ne dépasse pas quelques dizaines de connexions simultanées.

---

## Cache des pages publiques — `revalidate` vs `force-dynamic`

Les pages publiques dont les données changent rarement (témoignages, contenu
éditorial) utilisent `export const revalidate = 60` plutôt que `force-dynamic`
— sans ça, chaque chargement repaie la latence réseau vers Supabase (~200-400ms
par requête) sans aucun cache. `force-dynamic` doit rester réservé aux pages qui
reflètent un état quasi temps-réel (ex: `/ambassade/[id]`, capacité/activation
d'un hôte qui peut changer en quelques minutes pendant un live).

**Piège non-évident : `searchParams` désactive tout cache statique, même avec
`revalidate` fixé.** `/temoignages` (filtres `?live=`, `?page=`) reste marqué
`ƒ Dynamic` au build quel que soit `revalidate` — Next.js désactive l'ISR dès
qu'une route lit `searchParams`. Pour ces routes, `revalidate` seul est un
no-op silencieux : il faut envelopper les requêtes Supabase elles-mêmes dans
`unstable_cache()` (clé incluant les paramètres qui varient, ex. `[eventId, page]`),
indépendamment du cache de la route. Voir `app/temoignages/page.tsx`.

**`revalidate`/`unstable_cache` sont no-op en `next dev`** — Next.js désactive
ce cache en développement pour toujours refléter le code à jour. Le gain de
perf n'est mesurable qu'en build de production (`npm run build && npm start`)
ou sur Vercel, jamais en dev local.

---

## Limites de pagination silencieuses

Deux API Supabase tronquent leurs résultats **sans erreur ni indicateur** : le
tableau retourné est incomplet mais indiscernable d'un tableau complet. Les deux
ont déjà produit un bug réel (audit admin du 2026-08-07).

| API | Limite par défaut | Helper à utiliser |
|-----|-------------------|-------------------|
| `supabase.auth.admin.listUsers()` | **50 comptes** | `lib/auth/list-all-users.ts` |
| `SELECT` via PostgREST (`.from().select()`) | **1000 lignes** (configurable dans les API Settings Supabase) | `lib/supabase/fetch-all.ts` |

**`listUsers()` — bug constaté.** Avec 78 comptes en base, `/admin/team`
affichait « Inconnu » à la place des deux super admins, créés en premier donc
au-delà de la première page. Le même défaut touchait des chemins moins visibles :
`classify-email` classait `new` une adresse déjà prise (collision non détectée à
la création de compte visiteur), et `/api/inscriptions` ne retrouvait pas le
compte après une erreur « already registered », créant un profil ambassadeur
orphelin sans compte auth rattaché. Ne jamais appeler `listUsers()` directement —
utiliser `listAllAuthUsers()`, `getAuthUsersByEmail()` ou `getAuthEmailsById()`.

**`fetchAllRows()` — où l'appliquer.** Uniquement là où l'exhaustivité a une
conséquence irréversible : envois de masse, snapshots, exports. Appliqué à
`POST /api/admin/campaigns` (snapshot des destinataires — au-delà de 1000
ambassadeurs validés, les suivants n'auraient jamais reçu leur lien d'activation,
donc aucune présence sur la carte) et à `/api/cron/send-feedback-emails` (les
visiteurs au-delà du 1000e n'auraient jamais été invités à témoigner, et
`feedback_sent` aurait quand même été posé, rendant l'oubli définitif).

La requête passée à `fetchAllRows()` **doit porter un `.order()` sur une colonne
stable** : sans ordre explicite, PostgreSQL ne garantit pas que deux pages
successives voient les lignes dans le même ordre — des lignes pourraient être
vues deux fois et d'autres jamais.

**Ce qui n'a délibérément pas été paginé.** L'audit a recensé 23 lectures non
bornées ; 20 sont restées telles quelles, pour trois raisons :

- **Cardinalité structurellement faible** — `admin_users` (une poignée),
  `events` (quelques lives par an), `scheduled_campaigns`, `blacklist` filtrée
  par email/téléphone.
- **Déjà bornée en amont** — `/admin/ambassadeurs` pagine par `range()`,
  `/api/cron/dispatch-campaigns` avance par curseur sur `id`,
  `getRecentFruits()` utilise `.limit(3)`.
- **Troncature sans conséquence** — un affichage de liste tronqué à 1000 entrées
  (témoignages admin, feed des signaux) dégrade l'affichage sans rien casser ni
  rien perdre. Y ajouter de la pagination avant d'avoir le volume qui la
  justifie ajouterait de la complexité pour rien.

Le seuil de vigilance concerne `contact_requests`, `testimonials` et
`live_feedbacks` : ce sont les seules tables dont le volume croît avec chaque
live. À surveiller quand elles approcheront le millier de lignes.

---

## Élision devant un prénom — `lib/elision.ts`

Les prénoms d'ambassadeurs viennent d'une saisie libre : on ne peut pas figer
« Ambassade de … » dans le texte. Sans traitement, l'app affichait « Ambassade de
Alpha », « de Antoine », « de Étienne » (trouvé en QA le 2026-08-07, sur 6
surfaces : fiche publique `/ambassade/[id]`, fiche live, page de feedback, page
de confirmation visiteur et modération admin).

Utiliser `de(firstName)` — retourne `"d'Alpha"` ou `"de Marie"` selon l'initiale,
et `"de"` seul si le nom est vide (jamais de `d'` orphelin). Le `h` est traité
comme une voyelle : « d'Hugo » est la forme usuelle, et se tromper dans ce sens
reste plus discret que « de Hugo ».

**Ne jamais réintroduire `de {first_name}` en dur dans du JSX.**

---

## Formatage des dates et fuseaux horaires

Vercel déploie en région IAD1 (Washington DC, UTC-4/UTC-5 selon DST). Si un Server
Component ou une API route formate une date sans `timeZone` explicite, l'heure affichée
est celle de Washington — ce qui produit des emails avec une heure fausse pour les
ambassadeurs réunionnais ou parisiens.

### Règle : deux utilitaires, deux contextes

| Contexte | Utilitaire | Comportement |
|----------|-----------|-------------|
| Server Component / API route (emails, pages serveur) | `lib/format-event-date.ts` → `formatEventDateDual()` | Hardcode `Indian/Reunion` + `Europe/Paris` — produit `"dimanche 15 novembre à 19:00 (La Réunion) · 16:00 (Paris)"` |
| Client Component (EventBanner, Dashboard, MapPublique) | `lib/hooks/use-browser-timezone.ts` → `useBrowserTimezone()` | Lit `Intl.DateTimeFormat().resolvedOptions().timeZone` dans `useEffect` (SSR-safe, init `"heure locale"`) — produit `"heure de Paris"` / `"heure d'Abidjan"` |

### `formatEventDateDual(isoDate)` — surfaces serveur

Utilisé dans :
- `app/api/cron/dispatch-campaigns/route.ts` — corps des emails de campagne ambassadeurs
- `app/api/visit-requests/[token]/accept/route.ts` — email confirmation visite (adresse dévoilée)
- `app/api/cron/check-activations/route.ts` — email alerte admin (La Réunion uniquement, `toLocaleString`)
- `app/live/[event_id]/ambassade/[host_id]/page.tsx` — fiche live visiteur (Server Component)
- `app/visitor/[token]/page.tsx` — page confirmation visiteur (Server Component)
- `app/accueillir/[token]/page.tsx` — page acceptation hôte (Server Component)

### `useBrowserTimezone()` — surfaces client

Retourne un label comme `"heure de Paris"` ou `"heure d'Abidjan"`.
Garde-fous : rejet des identifiants sans `/` (`UTC`, `GMT`), rejet des offsets (`GMT+5` → contient `+`), cache `localStorage['tz-city']` pour retour instantané sur les visites suivantes, `try/catch` complet (Safari mode privé).

Utilisé dans :
- `components/EventBanner.tsx` — état ≥ 7 jours : `"Prochain live le dimanche 17 mai à 09:55 · heure de Paris"`
- `app/dashboard/page.tsx` — section "Mes lives" : `"dimanche 10 mai à 09:55 · heure de Paris"`
- `components/MapPublique.tsx` — overlays "soon" et "upcoming" : `"à 09:55 · heure de Paris · dans 3 jours"`

> **Note** : le countdown `"Prochain live dans 2j 23h 59min"` est un délai relatif (ms UTC)
> — il est indépendant du fuseau et ne requiert aucun label.

---

## Variables d'environnement clés

| Variable | Côté | Rôle |
|----------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Clé publique (RLS active) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server uniquement | Clé admin (bypass RLS) — jamais exposée |
| `RESEND_API_KEY` | Server uniquement | Envoi d'emails |
| `RESEND_FROM_EMAIL` | Server uniquement | Expéditeur (`onboarding@resend.dev` en sandbox) |
| `NEXT_PUBLIC_APP_URL` | Client + Server | URL de base pour les liens dans les emails |
| `NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS` | Client + Server | Fenêtre "live en cours" (défaut : 4h) |
| `NEXT_PUBLIC_ADMIN_TZ_OFFSET` | Client | Offset UTC pour l'admin planning (La Réunion = +4) |
| `CRON_SECRET` | Server uniquement | Authentification des jobs Vercel Cron |
| `RESEND_REPLY_TO` | Server uniquement | Adresse des réponses aux e-mails (en-tête Reply-To posé dans `lib/email/send.ts`) ; facultative |
| `RESEND_ADMIN_EMAIL` | Server uniquement | Destinataire des alertes admin (candidature, questionnaire, 0 hôte actif) |
| `EMAIL_PROOF_SECRET` | Server uniquement | Signature de la preuve d'e-mail (inscription) et des billets d'envoi vidéo ; repli sur `SUPABASE_SERVICE_ROLE_KEY` |
| `NEXT_PUBLIC_YOUTUBE_CHANNEL_URL` | Client | Lien du bandeau « live en cours » (facultatif) |
| `LIVE_WINDOW_PAST_HOURS` / `LIVE_WINDOW_FUTURE_HOURS` | Server uniquement | Fenêtre du feed admin (voir plus bas) |
| `DEV_OVERLAY_SECRET` | Server uniquement | Secret exigé par `/api/dev/*` quand le DevOverlay est actif en production |

Liste complète, valeurs et ordre de mise en place : [`mise-en-service.md`](./mise-en-service.md).
| `EMAIL_PREVIEW` | Server uniquement | Active `/dev/emails` (doit valoir exactement `"true"`) |
| `USE_MAILHOG` | Server uniquement | `"true"` route tous les envois (`lib/email/send.ts`) vers Mailhog (SMTP local) au lieu de Resend — test des vrais flux applicatifs sans dépendre d'adresses e-mail réelles |
| `MAILHOG_SMTP_HOST` / `MAILHOG_SMTP_PORT` | Server uniquement | Hôte/port du conteneur Mailhog (défaut : `localhost:1025`) |
| `PCLOUD_CLIENT_ID` / `PCLOUD_CLIENT_SECRET` | Local uniquement | App key / App secret pCloud — servent seulement à obtenir le jeton (`scripts/pcloud-token.js`) |
| `PCLOUD_ACCESS_TOKEN` | Server uniquement | Jeton pCloud (secret, n'expire pas) — active le stockage des vidéos sur pCloud ; absent = repli sur le bucket Supabase |
| `PCLOUD_API_HOST` | Server uniquement | `eapi.pcloud.com` (Europe) ou `api.pcloud.com` (États-Unis) — celui du compte |
| `NODE_ENV` | Server + Build | `development` active le DevOverlay et `/api/dev/*` |

---

## Inventaire des features — statut opérationnel

Ce tableau est la source de vérité sur ce qui fonctionne réellement en production.
Mis à jour manuellement à chaque PR significative.

> **Légende :**
> ✅ Opérationnel — code + schéma + intégration complets
> ⚠️ Partiel — code existe, lacune bloquante connue
> ❌ Absent — fonctionnalité décidée, pas encore codée
> 💀 Mort — code existe, jamais appelé (aucun déclencheur)

### Features produit

| Feature | Statut | Routes principales | Gap / Note |
|---------|--------|-------------------|------------|
| Carte publique (pins) | ✅ | `GET /api/host-activations` | Cluster auto par proximité en pixels à l'écran (`leaflet.markercluster`, recalculé à chaque zoom — remplace juillet 2026 l'ancien groupement par coordonnées exactes qui masquait silencieusement les pins proches mais non identiques). Champ `quartier` + message de présentation (`presentation_message`, 240 car. max) + photo de profil (avatar 28px, signed URL 24h) affichés dans les popups (cluster + pin individuel) si renseignés. Bouton "Trier par distance" dans les clusters (géolocalisation éphémère, voir section dédiée). **Jitter décoratif** (`lib/geo/jitter.ts`, 2026-09-27) appliqué à chaque pin avant renvoi — sépare visuellement les ambassadeurs d'une même ville géocodés au même point exact ; ne dérive jamais de `lat_precise`/`lng_precise`, voir § Jitter décoratif carte publique. |
| Politique de confidentialité (`/confidentialite`) | ⚠️ | `app/confidentialite/page.tsx` | Page statique 8 sections (responsable, données collectées, ce qu'on ne fait pas, bases légales, durées, droits, sous-traitants, mineurs). **3 placeholders `[À COMPLÉTER]` bloquent la publication publique** : entité juridique, adresse du siège, e-mail de contact RGPD — mentions obligatoires (art. 13 RGPD), volontairement laissées visibles plutôt que remplies d'une valeur plausible qui passerait la relecture. Voir § Transparence des données. |
| Page de préparation visiteur (`/decouvrir`) | ✅ | `app/decouvrir/page.tsx` | Contenu dans `DecouvrirContent`, repris par l'onglet « Guide » de `/mon-espace`. Réassurance + 3 étapes + FAQ accessible (`FaqAccordion`) + témoignage vedette (fallback global si aucun pour le prochain live) + CTA retour carte. CTA discret "C'est votre première fois ?" sur `MapPublique` (coin bas-droit, masquable, mémorisé `localStorage`). |
| Géolocalisation auto au premier chargement | ✅ | `MapPublique` → `map.locate()` | Zoom métropole si permission acceptée, vue monde sinon (silencieux). Sautée si une position de carte est déjà mémorisée (`localStorage['map-view-state']`) — voir ligne dédiée ci-dessous. |
| Mémorisation de la position carte (centre + zoom) | ✅ | `components/MapPublique.tsx` → `readSavedMapView()`/`saveMapView()` | `localStorage['map-view-state']` (`{lat, lng, zoom}`), mis à jour sur `moveend`/`zoomend`. Au montage suivant, la carte s'initialise directement sur cette position — pas de `setView([20,10],3)` ni de géolocalisation auto/`flyTo` — pour éviter de réanimer un zoom à chaque refresh alors que le visiteur avait déjà positionné la carte. Le bouton "Me localiser" (manuel) garde son `flyTo` animé. |
| EventBanner (5 états) | ✅ | `lib/homepage-data.ts` → `app/page.tsx` | |
| Overlay carte vide contextuel (7 états) | ✅ | `components/MapPublique.tsx` → `EmptyMapContent` | |
| Inscription ambassadeur | ✅ | `POST /api/inscriptions`, `/api/inscriptions/verify-email` | Adresse confirmée par e-mail avant d'ouvrir le formulaire (jeton signé sans état, 24 h, `lib/auth/email-proof.ts`) — rien n'est créé avant. Double validation lat/lng : frontend (`form.lat == null`) + API 400. `host-activations` filtre silencieusement `hp.lat && hp.lng`. |
| Champ quartier (profil ambassadeur) | ✅ | `host_profiles.quartier`, `PATCH /api/ambassadeur/profile` | Texte libre optionnel (ex : "Paris 15e"). **Plus de saisie manuelle à l'inscription** (retiré 2026-09-27, retour David) — auto-déduit du geocodage de l'adresse (`AddressInput` → `extractQuartier`, `lib`/`api/geocode`), modifiable après coup dans `MesInfosSection`. Sert notamment à désambiguïser visuellement les ambassadeurs d'un même cluster carte (plusieurs hôtes d'une même ville partagent le même `lat`/`lng` de géocodage ville — voir § Distance visiteur ↔ ambassadeur pour le mécanisme complémentaire de tri par distance). Affiché dans les popups carte + fiche publique `/ambassade/[id]` + fiche live `/live/[event_id]/ambassade/[host_id]` sous la ligne ville/pays. |
| Onboarding self-service | ✅ | `PATCH /api/onboarding/complete` | Gate inline dans `/dashboard` pour `pending_review` : vidéo + PDF + CGU + bouton. Idempotent. Aucune action admin requise. |
| Validation finale ambassadeur (admin) | ✅ | `PATCH /api/admin/ambassadeurs/[id]/status` | Actions : `validated` (depuis enrichment_pending), `validated_bypass` (escape hatch API — plus de bouton UI), `rejected` (email `sendRefusCandidature` au candidat), `suspended`, `reactiver` (→ `validated` + email uniquement si dossier complet, sinon → `enrichment_pending` sans email). L'action `pre_approved` a été retirée — transition self-service. |
| Activation via lien email campagne | ✅ | `POST /api/campaign-activations` | |
| Self-activation toggle (dashboard hôte) | ✅ | `PATCH /api/host-activations/[id]` | CTA "J'ouvre ma maison / mon église pour ce live" / badge "Votre maison est ouverte…" / lien "Finalement, je ne peux pas accueillir" dans `/dashboard` (libellés selon `host_type`, `lib/dashboard/participation-labels.ts`) |
| Édition profil ambassadeur | ✅ | `PATCH /api/ambassadeur/profile` | Ville (+ re-géocodage), adresse précise (`lat_precise`/`lng_precise` via `AddressInput`/Nominatim), consignes, téléphone. Email admin si ville change. |
| Photo compressée (upload ambassadeur) | ✅ | `POST /api/upload/ambassador-photo` | `lib/image/compress-photo.ts` (Sharp) : profil → 512×512 WebP cover-fit ; lieu → max 1200px WebP contain-fit sans upscale. Toutes les photos converties en `.webp`. |
| Demandes de visite (visiteur → hôte) | ✅ | `POST /api/visit-requests` | Insère dans `contact_requests` (table correcte). Téléphone visiteur **obligatoire** (contrainte `NOT NULL` + validation `isValidPhoneNumber`). Exige une session visiteur authentifiée (Phase 3 PR3) — infos lues depuis `visitor_profiles`, jamais du body. |
| Profil visiteur réutilisable | ✅ | `POST /api/visitor/account`, `GET/PATCH /api/visitor/profile`, `POST/DELETE /api/upload/visitor-photo`, `/mon-espace`, `/mon-espace/creer` | Compte créé explicitement via `/mon-espace/creer` (prénom, email, téléphone, photo optionnelle) au moment du premier "Contacter", pas en best-effort silencieux. Adresse vérifiée par le lien e-mail avant toute session. Photo modifiable après création depuis `/mon-espace`. Voir section dédiée. |
| Distance visiteur ↔ ambassadeur | ✅ | `POST /api/distance` | Géolocalisation navigateur éphémère (jamais persistée) + Haversine arrondi au km. Rate-limité 8 req/min/IP. Ne retourne jamais de coordonnées. |
| Témoignages — soumission publique | ✅ | `POST /api/temoignages` | |
| Témoignages — modération admin | ✅ | `/admin/temoignages` | |
| Campagnes email (programmées) | ⚠️ | `POST /api/cron/dispatch-campaigns` | Code opérationnel — **cron désactivé dans `vercel.json` (hors production)**. Deux correctifs 2026-08-07 (test bout-en-bout Mailhog) : (1) le **désabonnement est désormais honoré** — `lib/campaigns/unsubscribed.ts:getUnsubscribedEmails()` filtre le snapshot *et* le dispatch ; (2) une campagne dont il reste des destinataires en échec **retourne à `pending`** au lieu de passer à `sent`, pour être retentée au passage suivant. |
| Feedback post-live visiteurs | ⚠️ | `POST /api/cron/send-feedback-emails` | **Bug SQL join corrigé** (juillet 2026, cf commit `cb02f84`) — requête en deux temps via `host_activation_id IN (...)` au lieu du `.eq()` no-op sur relation non jointe. Cron reste désactivé (hors production). |
| Feedback bidirectionnel ambassadeur → visiteur | ✅ | `/feedback/host/[token]` + `POST /api/feedbacks` | Token = `host_activations.id` (réutilisé, pas de nouvelle colonne). Formulaire V1 : "seriez-vous à l'aise que cette personne revienne" (Oui/Non) + texte libre optionnel. `would_host_again=false` propose une case "Bloquer ce visiteur" → insère dans `blacklist` avec `host_profile_id` (blocage scopé à cet hôte, pas global). |
| Blacklist par-ambassadeur | ✅ | `blacklist.host_profile_id` (nullable) | `NULL` = blocage global (`/admin/blacklist`), renseigné = blocage scopé à un hôte (déclenché depuis le formulaire de feedback). Le check dans `/api/visit-requests` matche les deux. |
| Notation admin filtrable | ✅ | `/admin/feedback` (`FeedbackModerationClient`) | 2 onglets : "Signalements" (modération) et "Toutes les notations" (filtres event/direction/tri). |
| Feed live — signaux mains levées | ✅ | `GET /api/live-signals`, `/admin/live` | Helper `getCurrentEvent()` factorisé dans `lib/admin/event-window.ts` (réutilisé par `/admin/stats`). |
| Clôture live | ✅ | `POST /api/admin/live/close` + `LiveCloseButton` | Bouton dans `/admin/live`. Confirmation utilisateur avant clôture. Désactive `host_activations.is_active` (carte publique) **et** renseigne `events.closed_at` (corrigé août 2026 — l'ancienne version ne touchait que `host_activations`, donc `getCurrentEvent()` continuait de désigner le même live comme "en cours" par fenêtre horaire après refresh, et le bouton se réaffichait comme si de rien n'était). `getCurrentEvent()` exclut désormais tout event avec `closed_at` non nul de la sélection "en cours" — bascule immédiate sur le fallback "dernier live passé". `router.refresh()` après clôture pour refléter le changement sans reload manuel. |
| Vue générale admin (Briefing factuel) | ✅ | `/admin/stats` | Refonte 2026-05-07 (v0.1.7.0) : 4 sections sobres (action queue Camille / témoignages récents / max 5 ambassades à vérifier / snapshot footer). Helpers : `lib/admin/event-window.ts`, `lib/admin/stats-helpers.ts`, `lib/admin/context-label.ts`. Tracking : `lib/admin/page-view-log.ts` (stdout JSON, Vercel logs). Pivot post-CEO/Codex : pas de narrative pastoral templaté en V1 — mesurer l'usage avant d'enrichir (cf TODO-22). |
| Multi-admin (gestion équipe) | ✅ | `POST/DELETE /api/admin/team` | Requiert `super_admin`. UI dans `/admin/team` |
| Onboarding questionnaire | ✅ | `/dashboard/questionnaire` + `PATCH /api/ambassadeur/enrichissement`, `/api/ambassadeur/video` | v2 (2026-10-01) : sections repliables, brouillon automatique, liste formations/livres, vidéo VideoAsk (stockage pCloud, envoi par morceaux via nos routes ; repli Supabase sans jeton). Champs obligatoires validés côté formulaire **et** côté serveur (`lib/questionnaire/completeness.ts`). Voir CLAUDE.md § Questionnaire enrichi v2. |
| Formulaire feedback visiteur | ✅ | `/feedback/[token]` | Route existante, jamais déclenchée automatiquement (cron non actif). QA UX 2026-08-07 : la page vérifie désormais `live_feedbacks` **avant** d'afficher le formulaire — un visiteur qui reclique son lien voit « Vous avez déjà donné votre avis » au lieu de tout ressaisir pour finir sur un « Feedback déjà soumis » rouge (la contrainte `live_feedbacks_unique` rejetait l'insert, la saisie était perdue). Étoiles : pattern `radiogroup` complet (un seul arrêt de tabulation par critère, navigation aux flèches, 44px) — il en fallait 20 pour traverser le formulaire. |
| Désabonnement email | ✅ | `GET /api/unsubscribe/[token]` | Écrit deux traces (`campaign_recipients.status='unsubscribed'` + `contact_requests.visitor_notifications_optin=false`), **toutes deux relues** par `getUnsubscribedEmails()` avant chaque envoi. Jusqu'au 2026-08-07 aucune n'était consultée : le lien de désabonnement était décoratif, le visiteur recevait la campagne suivante. |
| Upload photo ambassadeur | ✅ | `POST /api/upload/ambassador-photo` (`type=profile\|room`) | Bucket `ambassador-photos` **privé** — stocke un chemin, signed URL via `lib/storage/photo-url.ts`. Profile = 1 photo (requise). Room = max 5, append, au moins 1 requise (garde côté API `PATCH /api/ambassadeur/enrichissement`, 2026-08-07). Le questionnaire de validation expose les deux. |
| Signalement photo visiteur (côté hôte) | ⚠️ | `POST /api/dashboard/report-visitor-photo` | **Bouton masqué dans `/dashboard`** (2026-08-05, TODO-25) — la route met `visitor_profiles.photo_reported = true` mais aucun flux ne l'exploite (pas de page admin, pas de blocage auto). Réactiver le bouton une fois qu'un flux admin (page dédiée ou intégration à `/admin/blacklist`) consomme ce flag. |
| Suppression photo ambassadeur | ✅ | `DELETE /api/upload/ambassador-photo` | Ownership check (path doit commencer par `<profile.id>/`). Retire l'entrée DB + supprime le fichier du bucket. |
| Blacklist | ✅ | `/admin/blacklist` + filtre dans `/api/visit-requests` et `/api/visitor-help-request` | Choix éthique : refus honnête (403) avec message neutre + voie de recours, pas de shadow-ban (faux 201 silencieux). Voir « Modération anti-abus visiteur » dans CLAUDE.md. |
| Configuration timing | ✅ | `GET /api/onboarding/config`, `/admin/settings/timing` | |
| Configuration onboarding (vidéo, PDF) | ✅ | `GET/PATCH /api/admin/settings/onboarding` | |
| Geocoding (autocomplétion ville) | ✅ | `GET /api/geocode` | Proxy Nominatim, limite 1 req/s |
| Preview emails (dev) | ✅ | `/dev/emails` | Requiert `EMAIL_PREVIEW=true` |
| Badge OG (preview partage) | ✅ | `GET /ambassade/[id]/badge` | Image PNG 1200x630 générée via `next/og` ImageResponse pour previews WhatsApp/réseaux quand l'ambassadeur partage `/ambassade/[id]`, et bouton "Voir mon badge" dans `/dashboard`. Contenu : sous-titre "Live de guérison avec David Théry", emoji conditionnel (🏠 individual / ⛪ church), prénom de l'hôte, ville (+ quartier en sous-ligne si non redondant), pays, pill type ("Lieu de prière à domicile" / "Lieu de prière en église"), badge "Groupe femmes uniquement" si applicable, CTA "Rejoignez {first_name} pour la prière", trust line "Adresse dévoilée après acceptation". Cache CDN 24h via header `Cache-Control: public, max-age=86400`. **Contraintes satori strictes** — voir règles dans CLAUDE.md "Routes `next/og` ImageResponse". |

---

### Gaps schéma confirmés

Aucun à ce jour. Les colonnes précédemment manquantes ont été ajoutées :

| Table | Colonne | Statut |
|-------|---------|--------|
| `events` | `feedback_sent BOOLEAN DEFAULT FALSE` | ✅ Présente dans `reset-db.sql` |
| `event_timing_config` | `soon_threshold_days INTEGER DEFAULT 2` | ✅ Présente, consommée par `MapPublique.tsx` (prop `soonThresholdDays`) |

---

### Crons — état en production

| Cron | Route | Schedule | Statut prod |
|------|-------|----------|-------------|
| Dispatch campagnes | `/api/cron/dispatch-campaigns` | `0 8 * * *` | ⏸ Désactivé (hors production) |
| Feedback post-live | `/api/cron/send-feedback-emails` | `0 10 * * *` | ⏸ Désactivé (hors production) — bug SQL join corrigé juillet 2026 |
| Alerte 0 hôtes actifs | `/api/cron/check-activations` | `0 9 * * *` | ⏸ Désactivé (hors production) |
| Auto-decline visiteurs | `/api/cron/auto-decline` | — | 💀 **Supprimé** (David ne l'a pas demandé) |

---

### Timing config — champs sans cron correspondant (💀 Mort)

| Champ `event_timing_config` | Cron correspondant | État |
|-----------------------------|-------------------|------|
| `campaign_ambassadors_days_before` | `/api/cron/dispatch-campaigns` | ✅ Actif (mais non schedulé) |
| `campaign_visitors_days_before` | `/api/cron/dispatch-campaigns` | ✅ Actif (mais non schedulé) |
| `feedback_days_after` | `/api/cron/send-feedback-emails` | ✅ Actif (bug SQL corrigé), non schedulé |
| `host_reminder_days_before` | — | 💀 Aucun cron correspondant |
| `visitor_auto_decline_days_before` | `/api/cron/auto-decline` | 💀 Cron supprimé |
| `queue_aging_days` | — | 💀 Aucun cron correspondant |

---

### Variables live window — deux familles (incohérence documentée)

Le calcul "est-ce qu'un live est en cours ?" n'utilise pas la même variable selon le contexte :

| Variable | Défaut | Utilisée dans | Rôle |
|----------|--------|--------------|------|
| `NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS` | 4h | `lib/homepage-data.ts`, `api/host-activations`, `dashboard/page.tsx`, `lib/dev/state.ts` | Fenêtre affichage pins sur carte publique |
| `LIVE_WINDOW_PAST_HOURS` | **6h** | `lib/admin/event-window.ts` (consommé par `/admin/live` + `/admin/stats`) | Fenêtre rétroactive pour le feed admin |
| `LIVE_WINDOW_FUTURE_HOURS` | 4h | `lib/admin/event-window.ts` (consommé par `/admin/live` + `/admin/stats`) | Fenêtre anticipée pour le feed admin |

**Conséquence intentionnelle :** le feed admin (`/admin/live`) voit un live "en cours" pendant 6h après son heure de début, tandis que la carte publique arrête d'afficher les pins après 4h. David peut continuer à surveiller les signaux même après la fermeture de la carte.

**Point d'attention :** si David configure `NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS` à 6h (Q7 de `docs/SCENARIOS_DEMO.md`), les deux familles seront alignées. Si la durée dépasse 6h, il faudra aussi ajuster `LIVE_WINDOW_PAST_HOURS` manuellement dans Vercel.

---

### Bug résolu — send-feedback-emails (corrigé juillet 2026, commit `cb02f84`)

```typescript
// AVANT (bug) : .eq('host_activations.event_id', event.id) sans join Supabase
// → filtre ignoré, retournait TOUS les contact_requests acceptés toutes events confondues
const { data: contacts } = await supabase
  .from('contact_requests')
  .select('id, visitor_email, visitor_first_name, action_token')
  .eq('status', 'accepted')
  .eq('host_activations.event_id', event.id); // ← ne faisait rien sans .select('...host_activations(*)')
```

**Fix appliqué** : requête en deux temps — d'abord récupérer les `host_activations` de l'event,
puis filtrer `contact_requests` via `.in('host_activation_id', activationIds)`. Le cron envoie
désormais aussi un email hôte (`sendFeedbackPostLiveHost`, une fois par activation ayant ≥ 1
visiteur accepté) en plus du feedback visiteur existant. Cron toujours désactivé dans
`vercel.json` (hors production) — le bug ne bloque plus l'activation, seule la phase de
conception le fait.

---

### Routes API — carte complète

| Préfixe | Domaine | Auth | Statut |
|---------|---------|------|--------|
| `GET /api/host-activations` | Pins carte publique | Non | ✅ |
| `PATCH /api/host-activations/[id]` | Toggle self-activation hôte | Session hôte (RLS) | ✅ |
| `POST /api/visit-requests` | Visiteur → demande contact hôte (téléphone obligatoire) | Session visiteur | ✅ |
| ~~`POST /api/contact-requests`~~ | **Supprimée** (juillet 2026) — référençait une colonne inexistante (`visitor_whatsapp`), jamais appelée par le frontend | — | 💀 Supprimée |
| `POST /api/distance` | Distance visiteur ↔ ambassadeurs (Haversine, km arrondi) | Non (rate-limité) | ✅ |
| `POST /api/visitor/account` | Création de compte visiteur + e-mail de vérification (`/mon-espace/creer`) | Non (rate-limité 3/min/IP) | ✅ |
| `POST /api/visitor/check-email` | Classification email au blur (new/visitor_existing/collision) | Non (rate-limité 10/min/IP) | ✅ |
| `GET/PATCH /api/visitor/profile` | Profil visiteur réutilisable (email, téléphone, `photo_signed_url` signée côté serveur) | Session visiteur | ✅ |
| `POST/DELETE /api/upload/visitor-photo` | Upload/suppression photo de profil visiteur (`/mon-espace`, bucket `visitor-photos`) | Session visiteur | ✅ |
| `POST /api/dashboard/contact-photos` | Photo visiteur visible par l'hôte (signed URL 15min, ownership vérifié) | Session hôte | ✅ |
| `POST /api/feedbacks` | Feedback bidirectionnel post-live + blocage visiteur | Token / Session hôte | ✅ |
| `POST /api/campaign-activations` | Activation hôte via lien email | Token signé | ✅ |
| `POST /api/temoignages` | Soumission témoignage public | Non | ✅ |
| `GET /api/testimonials` | Lecture témoignages (admin) | Admin | ✅ |
| `POST /api/live-signals` | Signal live depuis dashboard hôte | Session hôte | ✅ |
| `GET /api/live-signals` | Feed signaux (admin/live) | Admin | ✅ |
| `POST /api/inscriptions` | Création profil ambassadeur (preuve d'e-mail obligatoire, 403 sinon) | Non | ✅ |
| `POST/GET /api/inscriptions/verify-email` | Lien de confirmation d'adresse avant l'inscription (POST) / validation du jeton (GET) | Non (rate-limité 3/min/IP) | ✅ |
| `PATCH /api/onboarding/complete` | Self-service : pending_review → pre_approved | Session candidat | ✅ |
| `GET /api/onboarding/config` | Config vidéo + PDF onboarding (lecture publique) | Public | ✅ |
| `PATCH /api/ambassadeur/enrichissement` | Enrichissement profil (questionnaire, photos) | Session hôte | ✅ |
| `PATCH /api/ambassadeur/profile` | Édition profil (ville, adresse, consignes, tél.) | Session hôte | ✅ |
| `PATCH /api/admin/ambassadeurs/[id]/status` | Validation finale + suspension/réintégration | Admin | ✅ |
| `POST/DELETE /api/admin/team` | Gestion équipe admin | Super admin | ✅ |
| `POST /api/admin/campaigns` | Créer campagne planifiée | Admin | ✅ |
| `GET/PATCH /api/admin/settings/onboarding` | Config vidéo/PDF onboarding | Admin | ✅ |
| `GET /api/admin/settings/timing` | Config timing (lecture) | Admin | ✅ |
| `POST /api/cron/dispatch-campaigns` | Envoi campagnes dues | `CRON_SECRET` | ⏸ Désactivé (hors prod) |
| `POST /api/cron/send-feedback-emails` | Feedback post-live | `CRON_SECRET` | ⏸ Désactivé — bug SQL join |
| `POST /api/cron/check-activations` | Alerte 0 hôtes actifs | `CRON_SECRET` | ⏸ Désactivé (hors prod) |
| `POST /api/cron/auto-decline` | Auto-déclin visiteurs | `CRON_SECRET` | 💀 Supprimé |
| `POST /api/admin/live/close` | Clôturer le live | Admin | ✅ |
| `GET /api/geocode` | Proxy Nominatim | Non | ✅ |
| `GET /api/unsubscribe/[token]` | Désabonnement email | Token | ✅ |
| `POST /api/upload/ambassador-photo` | Upload photo (`type=profile` ou `room`, max 5) | Session hôte | ✅ |
| `DELETE /api/upload/ambassador-photo` | Suppression photo (ownership check path) | Session hôte | ✅ |
| `POST /api/visitor-help-request` | Email aide visiteur | Non | ✅ |
| `GET /ambassade/[id]/badge` | OG image PNG 1200x630 (preview WhatsApp/réseaux) | Non | ✅ |
| `GET /dev/emails` | Preview emails (dev) | `EMAIL_PREVIEW=true` | ✅ |
| `POST /api/dev/state` | Simulation états DB | `NODE_ENV=development` | ✅ |
| `POST /api/auth/magic-link` | Génération magic link | Admin | ✅ |
