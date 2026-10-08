# QA Scenarios — Ambassades de Guérison

> **Comment utiliser ce fichier**
> Cocher chaque case au fur et à mesure des tests. Mettre `~` pour "partiel / à surveiller", `x` pour OK.
> Relancer `node scripts/demo-state.js <état>` pour changer l'état avant chaque section.

---

## Préparation

```bash
# 1. Base propre
node scripts/seed.js

# 2. Lancer l'app
npm run dev

# 3. Connexion admin
node scripts/magic-link.js david.thery@demo.fr
# → ouvrir l'URL dans le navigateur
```

**États disponibles via le DevOverlay (bouton `DEV 🔧` coin bas-droit, dev uniquement) :**

| Bouton DevOverlay | Ce que ça produit |
|---|---|
| `🔴 Live` | Live en cours — EventBanner rouge, 7 pins actifs |
| `🔴 Live (0 confirm.)` | Live en cours mais 0 pins (campagne pas encore envoyée) |
| `⏱ Soon 3j` | Prochain dans 3j — countdown indigo |
| `📅 Upcoming` | Prochain dans 10j — état par défaut du seed |
| `⏪ Past` | Entre deux lives — aucun futur, overlay "Dernier live" |
| `🔚 Closed` | Live vient de finir — juste hors fenêtre live, overlay "Dernier live" |
| `🫙 Blank 0 confirm.` | Futur live annoncé, 0 ambassadeurs confirmés (avant campagne) |

> Alternative CLI (si le DevOverlay n'est pas disponible) : `node scripts/demo-state.js <état>` avec les états `live`, `live-zero`, `soon`, `upcoming`, `past`, `closed`, `blank`.

---

## Module 1 — Page d'accueil publique `/`

> Tester les 7 états via le **DevOverlay** (bouton `DEV 🔧` coin bas-droit, visible uniquement en `NODE_ENV=development`).
> Cliquer l'état voulu → rafraîchir si nécessaire (le router.refresh() est appelé automatiquement).
> **Règle clé post-fix** : hors état `live`, `is_active = false` pour tous les hôtes → la carte est vide → l'overlay contextuel s'affiche.

### État : `upcoming` (prochain dans 10j — défaut seed)

- [ ] La carte Leaflet s'affiche plein écran sans erreur
- [ ] L'EventBanner affiche la date du prochain live (ex : "Prochain live le lundi 11 mai")
- [ ] L'EventBanner est sur fond blanc/clair (pas rouge)
- [ ] **Aucun pin** sur la carte (is_active=false après le fix DevOverlay)
- [ ] L'overlay contextuel s'affiche au centre : label "PROCHAIN LIVE", date formatée, "dans X jours"
- [ ] L'overlay affiche "Les ambassades s'afficheront dès qu'elles confirmeront leur participation."
- [ ] L'overlay affiche les stats "N ambassadeurs · X pays"
- [ ] L'overlay contient un lien "Voir les témoignages →" pointant vers `/temoignages`
- [ ] La barre de recherche par ville est visible (haut-gauche)
- [ ] Saisir "Lyon" dans la recherche → dropdown Nominatim → cliquer → la carte recentre sur Lyon
- [ ] Le footer affiche "Ambassades de Guérison — rejoignez un groupe de prière..."
- [ ] Le header affiche le sous-titre "Groupes de prière — lives de guérison" (desktop)

### État : `soon` (prochain dans 3j)

- [ ] L'EventBanner affiche un countdown (ex : "Prochain live dans 2j 23h 59min")
- [ ] Le fond de l'EventBanner est indigo
- [ ] Le countdown se met à jour si on attend quelques secondes
- [ ] **Aucun pin** sur la carte (is_active=false)
- [ ] L'overlay contextuel affiche : label "PROCHAIN LIVE", date, "dans X jour(s)" (≤ 2j)
- [ ] L'overlay affiche "Les ambassades confirment leur participation..."
- [ ] Stats et lien témoignages présents

### État : `live` (live en cours — ambassades confirmées)

- [ ] L'EventBanner affiche "Live en cours — rejoignez-nous" sur fond rouge/indigo intense
- [ ] L'icône Radio clignote (pulsing)
- [ ] **Les 7 pins sont activés** (is_active=TRUE) — tous visibles sur la carte
- [ ] Cliquer sur un pin → popup avec CTA "Rejoindre cette ambassade" (ou équivalent live)
- [ ] Aucun overlay de carte vide affiché (pins présents)

### État : `live-zero` 🔴 (live en cours — 0 ambassades confirmées)

> État simulant un live en cours mais dont la campagne email ambassadeurs n'a pas encore été envoyée.
> `is_active = false` sur tous les hôtes → carte vide pendant le live.

- [ ] L'EventBanner affiche "Live en cours — rejoignez-nous" (identique à `live`)
- [ ] **Aucun pin** sur la carte (is_active=false)
- [ ] L'overlay contextuel affiche "Live en cours" avec message "Les ambassades confirment leur participation..."
- [ ] Si `live_link` est renseigné sur le dernier event : lien "Regarder le live →" visible et cliquable
- [ ] Si `live_link` est null : le lien n'apparaît pas (guard conditionnel)

### État : `blank` 🫙 (futur live annoncé, 0 confirmations)

> Simule l'état entre l'annonce d'un live et l'envoi de la campagne ambassadeurs.
> evtRecent (passé) is_active=false. evtFutur (J+10) is_active=false, inscriptions ouvertes.

- [ ] L'EventBanner affiche "Prochain live le [date]" (blanc, pas de countdown car > 7j)
- [ ] **Aucun pin** sur la carte (is_active=false)
- [ ] L'overlay contextuel affiche label "PROCHAIN LIVE" + date + "dans X jours"
- [ ] Texte "Les ambassades s'afficheront dès qu'elles confirmeront leur participation."
- [ ] Stats ambassadeurs/pays présentes
- [ ] Lien "Voir les témoignages →" présent

### État : `closed` 🔚 (live vient de se terminer — nouveau)

> État `closed` = event_date il y a (WINDOW_H + 1h), is_active=false. liveInProgress=false. nextEvent intact.

- [ ] L'EventBanner affiche l'état "Dernier live..." ou "Prochain live le..." selon nextEvent
- [ ] **Aucun pin** sur la carte (is_active=false)
- [ ] L'overlay contextuel affiche "Dernier live" + date du live clôturé
- [ ] L'overlay affiche "Prochain live annoncé prochainement."
- [ ] L'overlay affiche les stats ambassadeurs/pays
- [ ] L'overlay contient un lien "Partager un témoignage →" pointant vers `/temoignages/nouveau`
- [ ] **Test de transition critique** : passer de `live` (pins visibles) → `closed` → pins disparaissent, overlay apparaît

### État : `past` (aucun futur — les deux events dans le passé)

- [ ] L'EventBanner affiche "Dernier live il y a 7 jours — prochainement"
- [ ] Fond blanc/neutre
- [ ] **Aucun pin** sur la carte (is_active=false — corrigé, ne plus afficher les pins après un live)
- [ ] L'overlay contextuel affiche "Dernier live" + date du dernier event
- [ ] L'overlay affiche "Prochain live annoncé prochainement."
- [ ] Lien "Partager un témoignage →" présent

### Responsive

- [ ] Sur mobile (375px) : la carte est plein écran, l'EventBanner est lisible
- [ ] La barre de recherche ne chevauche pas le header sur mobile
- [ ] L'overlay carte vide est centré et lisible sur mobile (max-w-xs avec padding)

### Géolocalisation automatique au premier chargement

> Vérifier que la carte zoome directement sur la zone du visiteur si la permission est accordée.

- [ ] Au premier chargement, le navigateur affiche la pop-up de permission de géolocalisation
- [ ] Permission acceptée → la carte zoome automatiquement sur la zone du visiteur (zoom ~9, vue métropole)
- [ ] Permission refusée → la carte reste sur la vue monde (zoom 3, centre `[20, 10]`) — pas d'erreur visible
- [ ] Le bouton GPS bas-droit reste cliquable pour relancer la localisation manuellement
- [ ] Si HTTPS non disponible (autre que localhost) → permission refusée silencieusement, vue monde conservée

### Cluster de pins co-localisés (état `live` recommandé)

> Vérifie le regroupement des pins quand plusieurs ambassadeurs partagent la même coordonnée ville. Avec les seeds : 6 ambassadeurs à Paris (Marie + 5 cluster) géocodés au point `48.8698, 2.3315` — depuis le jitter décoratif (`lib/geo/jitter.ts`, 2026-09-27), `GET /api/host-activations` renvoie 6 points distincts décalés de ~250m max autour de ce point, pas 6 fois la même coordonnée.

- [ ] En état `live`, zoom niveau ville/pays sur Paris → toujours regroupés en un seul pin (cercle indigo) avec un badge `6` (ou le nombre actif selon l'état du live) — le jitter (~250m) reste sous le seuil de clustering en pixels à ce niveau de zoom, comportement inchangé
- [ ] Zoomer fortement (niveau rue/quartier) → les 6 pins se séparent en marqueurs individuels (plus de badge `6`) — vérifie que le jitter a bien produit des coordonnées distinctes, pas juste un artefact visuel
- [ ] Aucun des 6 pins jittérés ne retombe exactement sur les coordonnées d'origine (`48.8698, 2.3315`) — sinon le jitter n'a pas été appliqué
- [ ] Le pin cluster est rond (pas teardrop) et plus large (36×36 px) que les pins individuels
- [ ] Cliquer sur le cluster → popup s'ouvre avec un titre "N ambassades · Paris"
- [ ] Le popup liste chaque ambassadeur : prénom, type (Domicile / Église), places (`accepted_count/capacity`), lien "Contacter →"
- [ ] **Quartier** : les ambassadeurs avec `quartier` renseigné (ex : Marie → "Paris 15e", Lucas → "Paris 10e") affichent leur quartier en gris clair sous le type/places dans le popup cluster
- [ ] Ambassadeur sans `quartier` (aucun ambassadeur Paris du seed n'est dans ce cas) → pas de ligne grise vide
- [ ] Si le popup dépasse 280px de hauteur → scroll vertical activé (`overflow-y:auto`)
- [ ] Cliquer sur "Contacter →" pour un ambassadeur → ouvre `/ambassade/[id]` correspondant
- [ ] Hôte avec `is_full = true` dans le cluster → badge "Complet" inline, pas de lien "Contacter →"
- [ ] Pin individuel (ex : Lyon JP Martin) → popup affiche le quartier "Lyon Presqu'île" sous la ligne ville/pays
- [ ] Hors Paris : pins individuels classiques (Lyon, Bruxelles, etc.) — comportement teardrop conservé

---

## Module 2 — Page ambassade publique `/ambassade/[id]`

> Prérequis : état `upcoming` ou `live`. Cliquer sur un pin de Marie (Paris) depuis la carte.

- [ ] La page charge avec le nom, ville, pays de l'ambassadeur
- [ ] Si l'ambassadeur a un `quartier` renseigné (ex : Marie → "Paris 15e") → ligne `text-slate-400` affichée sous "Ville, Pays"
- [ ] Si pas de `quartier` → aucune ligne grise affichée
- [ ] Le formulaire de contact est visible (prénom, email, message)
- [ ] Soumettre le formulaire avec des données valides → message de confirmation
- [ ] Soumettre sans prénom → erreur de validation
- [ ] Soumettre avec un email déjà existant → message "Demande déjà envoyée"
- [ ] Le honeypot (champ `website` caché) : si rempli → 200 silencieux (pas de vrai envoi)
- [ ] En état `live` : le formulaire est actif, la demande se crée
- [ ] En état `upcoming` : idem (le formulaire fonctionne hors-live)

---

## Module 3 — Flux de visite visiteur `/live/[event_id]/ambassade/[host_id]`

> Page de demande de visite avec `event_id` explicite.

- [ ] La page charge pour un event futur valide
- [ ] Si l'ambassadeur a un `quartier` renseigné → ligne `text-slate-400` affichée sous "Ville, Pays"
- [ ] Formulaire : prénom, email, téléphone, message, nb_personnes
- [ ] Soumettre → confirmation → la demande apparaît dans le dashboard ambassadeur
- [ ] Si l'ambassade est pleine (`is_full=TRUE`) → message d'erreur approprié
- [ ] Si l'event n'existe pas → 404

---

## Module 4 — Dashboard ambassadeur `/dashboard`

> Se connecter avec `node scripts/magic-link.js marie.dubois@demo.fr` (statut `validated`)

### Accès et guards

- [ ] Sans session → redirige vers `/auth`
- [ ] Session sans `host_profile` → redirige vers `/inscription`
- [ ] Session avec profil `pending_review` → affiche état "en attente de validation" (pas d'encart questionnaire)
- [ ] Session avec profil `pre_approved` → encart indigo "Félicitations, tu as été pré-approuvé !" + bouton "Compléter mon profil →" vers `/dashboard/questionnaire`
- [ ] Session avec profil `enrichment_pending` → encart violet "Ton dossier est en cours d'examen"
- [ ] Session avec profil `validated` → dashboard complet s'affiche (sans encart statut)

### Contenu dashboard (état `upcoming`)

- [ ] Nom, ville de l'ambassadeur affichés
- [ ] Statut "Ambassadeur actif" visible
- [ ] Section "Mes demandes de visite" avec les 3 demandes de Marie (Pierre, Nathalie, Luc)
- [ ] Luc a le statut `accepted` — boutons Accept/Refuser grisés ou absents
- [ ] Pierre et Nathalie ont le statut `pending` — boutons Accept/Refuser disponibles

### Actions sur les demandes

- [ ] Cliquer "Accepter" sur Pierre → statut passe à `accepted`, `accepted_count` augmente
- [ ] Cliquer "Refuser" sur Nathalie → statut passe à `declined`
- [ ] Double-clic sur "Accepter" ne crée pas de doublon (idempotent)

### Activation de l'ambassade (is_active)

- [ ] Section "Mon ambassade" visible avec le toggle d'activation (`is_active`)
- [ ] Toggler `is_active` → appel `PATCH /api/host-activations/[id]` → RLS vérifie que l'user est bien l'hôte (403 si autre user)
- [ ] `is_full` n'est PAS modifiable via l'UI (badge statique si l'ambassade est pleine)

### Photos (upload)

- [ ] Section "Photo profil" avec Dropzone visible
- [ ] Déposer une image JPG/PNG → aperçu inline, upload vers Supabase Storage
- [ ] Déposer un PDF → message d'erreur (format non accepté)
- [ ] Déposer un fichier > 5MB → message d'erreur (trop lourd)
- [ ] Section "Photo de la salle" disponible

### Partage du lien ambassade

- [ ] Bouton "Copier mon lien" → copie l'URL `/ambassade/[id]`
- [ ] Bouton "Partager" ouvre le mécanisme de partage natif (si supporté par le navigateur)

### État `live` — section Signaux

- [ ] En état `live` : une section "Signal live" apparaît dans le dashboard
- [ ] Zone de texte pour la description du signal
- [ ] Bouton "Envoyer un signal" → crée un signal dans `live_signals`
- [ ] Signal envoyé → confirmation, bouton désactivé ou message "Signal envoyé"
- [ ] En état `upcoming` : la section Signaux n'est PAS visible

### Témoignage post-live

- [ ] Zone de texte pour envoyer un témoignage (en bas du dashboard)
- [ ] Soumettre → témoignage visible dans `/admin/temoignages` (is_visible=false)
- [ ] Caractères minimum (20 chars) appliqués
- [ ] Double-submit bloqué (loading state)

---

## Module 5 — Page live ambassade `/visitor/[token]`

> Token = `action_token` d'une demande de contact acceptée.

- [ ] La page charge avec les infos du visiteur et de l'ambassade
- [ ] Adresse privée de l'hôte visible si la demande est acceptée
- [ ] Token invalide → 404 ou message d'erreur approprié

---

## Module 6 — Accueil invité `/accueillir/[token]`

- [ ] La page charge avec le prénom du visiteur
- [ ] Affiche le nom + ville de l'ambassadeur
- [ ] Affiche les consignes d'accueil
- [ ] Lien WhatsApp visible si `whatsapp_group_url` non vide (Jean-Pierre / Kofi)
- [ ] Token invalide → message d'erreur clair
- [ ] Formulaire de témoignage présent

---

## Module 7 — Refus hôte `/refuser/[token]`

- [ ] La page charge pour un token valide
- [ ] Confirmer le refus → statut de la demande passe à `declined`
- [ ] Token déjà utilisé → message "Déjà traité"
- [ ] Token invalide → 404

---

## Module 7b — Édition profil ambassadeur (`/dashboard` — section MesInfosSection)

> Se connecter avec `node scripts/magic-link.js marie.dubois@demo.fr` (statut `validated`).

- [ ] La section "Mes informations" est visible pour un ambassadeur `validated`
- [ ] Les champs ville, pays, adresse privée, consignes, téléphone sont pré-remplis avec les données existantes
- [ ] **Champ quartier** visible entre le sélecteur pays et l'adresse privée, pré-rempli avec "Paris 15e" (valeur seed Marie)
- [ ] Modifier le quartier → sauvegarder → rafraîchir la page → valeur conservée en DB
- [ ] Vider le quartier (champ vide) → sauvegarder → `host_profiles.quartier = null` en DB
- [ ] Modifier uniquement le quartier (sans changer la ville) → pas d'email admin envoyé
- [ ] Modifier la ville → email admin `ambassadeur-modification-admin` envoyé même si quartier inchangé

---

## Module 8 — Inscription ambassadeur `/inscription`

### Étape 1 — Informations personnelles

- [ ] Champs obligatoires : prénom, **nom**, email, **téléphone**, ville, pays — bouton "Continuer" bloqué si l'un manque
- [ ] Champ **téléphone** (obligatoire) — label "Téléphone", type tel, maxLength 20, note de confidentialité sous le champ
- [ ] `CityInput` : saisir "Paris" → dropdown Nominatim apparaît → sélectionner "Paris, Île-de-France" → coordonnées lat/lng renseignées
- [ ] Sans sélection dans le dropdown → hint ambre "Sélectionnez votre ville dans la liste pour confirmer votre position sur la carte"
- [ ] Bouton "Continuer" désactivé si `lat == null` (ville tapée sans sélection dropdown)
- [ ] Sélectionner une ville étrangère (ex: "Yaoundé") → pays bascule automatiquement sur "Cameroun"
- [ ] `CountrySelect` : pays épinglés (FR, BE, CH, CA, LU, MA, SN, CI, CM) visibles en premier
- [ ] **Pas de champ quartier saisissable à l'étape 1** (retiré 2026-09-27) — `quartier` est désormais exclusivement auto-déduit du geocodage de l'adresse à l'étape 2, jamais saisi manuellement à l'inscription
- [ ] Soumettre → `host_profiles.phone`, `host_profiles.last_name` sauvegardés en DB

### Étape 2 — Type d'ambassade

- [ ] Choisir "Individu" vs "Église" → champs adaptés (dénomination pour église)
- [ ] Champs consignes, setup vidéo
- [ ] Bouton "Créer mon profil" → soumission

### Soumission

- [ ] Succès → profil créé avec statut `pending_review` → écran inline « Votre demande est bien reçue ! » + e-mail affiché. La réponse de `POST /api/inscriptions` porte `login: { token_hash, type }` et le navigateur ouvre la session (`verifyOtp`) : CTA « Continuer mon inscription » → `/dashboard`, sans repasser par `/auth`
- [ ] Si le jeton est absent ou refusé (simuler en échouant `generateLink`) : l'inscription réussit quand même, CTA « Me connecter pour continuer » → `/auth`
- [ ] E-mail de confirmation : bouton « Continuer mon inscription » → `/dashboard` (plus de lien de connexion dans l'e-mail : le jeton unique est consommé par le navigateur). Ouvert sur un autre appareil → arrive sur `/auth`
- [ ] Email déjà existant → message d'erreur "Un compte ambassadeur existe déjà avec cet e-mail. Connecte-toi depuis la page de connexion." (humanisé depuis l'erreur Postgres `duplicate key`)
- [ ] Honeypot rempli → 200 silencieux

---

## Module 9 — Onboarding self-service inline (`/dashboard` pour `pending_review`)

> Pipeline self-service jusqu'au questionnaire : `/inscription → pending_review → pre_approved → enrichment_pending → validated`. La transition `pending_review → pre_approved` est déclenchée par le candidat lui-même depuis son dashboard (pas d'admin). La route `/onboarding` autonome a été supprimée.

- [ ] `GET /onboarding` retourne 404 (route legacy supprimée)
- [ ] Connecté en tant que Sophie (`pending_review`) → `/dashboard` affiche l'encart "Bienvenue, Sophie !" avec invite à regarder la vidéo
- [ ] Vidéo de formation YouTube visible (iframe `enablejsapi=1`)
- [ ] Bouton "Télécharger" le guide PDF visible et fonctionnel
- [ ] Checkbox "J'ai regardé la vidéo et accepté les conditions" **désactivée** par défaut
- [ ] Cliquer dans l'iframe vidéo → la checkbox devient activable (détection blur)
- [ ] Cocher la checkbox → le bouton "Activer mon onboarding" devient cliquable
- [ ] Cliquer "Activer mon onboarding" → `PATCH /api/onboarding/complete` retourne 200 → dashboard recharge → encart "Conditions acceptées" visible avec CTA "Compléter mon profil →"
- [ ] Second appel à `PATCH /api/onboarding/complete` (idempotent) → 200 noop, status reste `pre_approved`
- [ ] `PATCH /api/onboarding/complete` sans session → 401
- [ ] `PATCH /api/onboarding/complete` depuis statut `suspended` → 400

---

## Module 10 — Témoignages publics `/temoignages`

- [ ] La page charge avec l'en-tête "Ce que Dieu a fait"
- [ ] Stats visibles : "N témoignages • M villes"
- [ ] Grille 2 colonnes (desktop), 1 colonne (mobile)
- [ ] Cartes avec `line-clamp-4` — bouton "Lire la suite" si le texte est tronqué
- [ ] Cliquer "Lire la suite" → texte complet visible
- [ ] Cliquer "Réduire" → texte replié
- [ ] Filtre par live (combobox) → changer de live → la grille se filtre
- [ ] Témoignages anonymes (Grâce/Nantes, Patrick/Marseille) affichés sans ambassadeur
- [ ] Bouton "Partager" (copier lien + WhatsApp)
- [ ] CTA "Partage ton témoignage" → `/temoignages/nouveau`

---

## Module 11 — Formulaire témoignage `/temoignages/nouveau`

- [ ] La page charge sans authentification
- [ ] Dropdown live : liste les events passés avec leur titre et date
- [ ] Contenu : minimum 20 chars, maximum 2000 chars
- [ ] Prénom et ville optionnels
- [ ] Soumettre → confirmation → témoignage en attente dans `/admin/temoignages`
- [ ] Pré-sélection via `?live=<uuid>` → le dropdown live est pré-rempli

---

## Module 12 — Feedback visiteur `/feedback/[token]`

- [ ] La page charge avec un token valide
- [ ] Formulaire : 4 étoiles (accueil, chaleur, écoute, prière) + texte libre
- [ ] Checkbox "Signaler un problème" → champ de motif apparaît
- [ ] Soumettre → feedback créé → visible dans `/admin/feedback`
- [ ] Token invalide → 404

---

## Module 13 — Pages admin — protection auth

> Toutes les pages `/admin/*` doivent rediriger un visiteur non-authentifié.

- [ ] `/admin/stats` → redirige vers `/auth` si non connecté
- [ ] `/admin/ambassadeurs` → redirige vers `/auth`
- [ ] `/admin/live` → redirige vers `/auth`
- [ ] `/admin/temoignages` → redirige vers `/auth`
- [ ] `/admin/feedback` → redirige vers `/auth`
- [ ] `/admin/blacklist` → redirige vers `/auth`
- [ ] `/admin/team` → redirige vers `/auth`
- [ ] `/admin/calendrier` → redirige vers `/auth`
- [ ] `/admin/settings` → redirige vers `/auth`
- [ ] `/admin/settings/timing` → redirige vers `/auth`
- [ ] `/admin/moderation` → redirige vers `/admin/live` (pas vers `/auth`)

---

## Module 14 — Admin : Vue générale `/admin/stats` ("À noter depuis le dernier live")

> Connexion admin requise.

- [ ] La page charge sans erreur (titre "À noter depuis le dernier live" + sous-titre "Live du [date]" ou EmptyState selon état seed)
- [ ] **Section "À traiter"** : 3 pointeurs visibles si counts > 0, ou "Rien à traiter en ce moment." sinon. Click sur "N candidats" → navigate vers `/admin/ambassadeurs?status=pending_review`
- [ ] **Section "Témoignages récents"** : 0 ou 3 cartes (extrait + prénom + ville). Section masquée si aucun témoignage publié depuis le dernier live
- [ ] **Section "Ambassades à vérifier"** : max 5 lignes avec label de contexte factuel à droite (Profil incomplet / Validée mais jamais activée / Inactive depuis 2 lives / Ville sans demande visiteur ce live / Validée il y a ≥ 3 mois, 0 accueil). Section masquée si liste vide. Click "Voir le profil →" → navigate vers `/admin/ambassadeurs?id=...`
- [ ] **Snapshot footer** : `N ambassades · N pays · N témoignages · N visiteurs accueillis`. Click → `/admin/ambassadeurs`
- [ ] Tracking page_view : une ligne JSON dans Vercel logs avec `event:'admin_page_view'`, `admin_id`, `path:'/admin/stats'`, `ts`

---

## Module 15 — Admin : ambassadeurs `/admin/ambassadeurs`

- [ ] La page charge avec la datatable (15 ambassadeurs dans le seed : 12 validés + 2 enrichment_pending + 1 pending_review)
- [ ] Colonne statut : badges `Validé`, `Inscrit`, `Conditions acceptées`, `Questionnaire`, `Suspendu`, `Refusé`
- [ ] Filtre "Questionnaire" visible dans la barre de filtres (en plus des autres)
- [ ] Champ de recherche : saisir "Marie" → seule Marie apparaît
- [ ] Filtre par statut : "validated" → seuls les 12 validés
- [ ] Filtre par statut : "pending_review" → seulement Sophie
- [ ] Filtre par statut : "enrichment_pending" → Émilie + Pascal
- [ ] Pagination fonctionnelle si > 20 ambassadeurs

### Photos (avatar + galerie)

- [ ] Colonne Nom : chaque ambassadeur affiche un avatar 32px à gauche du nom
- [ ] Si `profile_photo_url` renseigné → photo s'affiche (signed URL 1h, bucket privé)
- [ ] Si pas de photo → icône fallback `User` sur fond gris
- [ ] Émilie/Pascal (seed avec chemins placeholder) → fallback icône (fichiers absents du bucket)

### Chevron expand/collapse

- [ ] Chaque ligne a un chevron (▾/▴) en première colonne
- [ ] Cliquer le chevron d'un ambassadeur `validated` → panneau s'ouvre
- [ ] Section "Photos" en haut du panneau : photo de profil (encadrée indigo) + photos du lieu (vue 1, vue 2…) si présentes
- [ ] Cliquer une vignette → ouvre la **lightbox** intégrée (pas un nouvel onglet) : image plein écran, navigation clavier (`←`/`→` entre photos, `Échap` pour fermer), flèches cliquables si plusieurs photos, légende "Vue N du lieu d'accueil — i/N", clic hors-image ferme
- [ ] Bloc "Engagement spirituel" (fond indigo clair) en tête du panneau : fréquentation d'église, dénomination, fonction de responsabilité, guérisons vues (« Non renseigné » distinct de « Non »), « Formations, livres et conférence » (« Aucune indiquée » si rien), « Vidéo de présentation » (lecteur + lien de téléchargement, ou « Non fournie »), parcours écrit étiqueté « en secours de la vidéo »
- [ ] Sous le bloc pastoral : téléphone
- [ ] Groupe réservé aux femmes → mention rose « Groupe réservé aux femmes » en haut du dossier + badge « Femmes uniquement » à côté du nom
- [ ] Si questionnaire non rempli → message "Présentation pas encore remplie"

### Signal de dossier incomplet (badge "N manquant(s)")

- [ ] Un ambassadeur `enrichment_pending` avec un dossier incomplet (photo profil manquante ou photo du lieu manquante) affiche un badge rouge "N photo(s) manquante(s)" ; ni vidéo ni parcours écrit : badge gris informatif « Sans vidéo ni parcours » à côté du badge de statut, **visible sans déplier la ligne**
- [ ] Survoler le badge (title) → liste les éléments manquants ("photo de profil manquante", "photo du lieu manquante" ; en gris : "ni vidéo de présentation ni parcours écrit")
- [ ] Un ambassadeur `enrichment_pending` avec dossier complet → pas de badge

### Vue mobile (<640px)

- [ ] Sous 640px de large, le tableau à 9 colonnes disparaît — remplacé par des **cards empilées** (avatar, nom, ville/pays, badge statut, badge gaps) sans scroll horizontal
- [ ] Cliquer une card → déplie le même panneau détail que la vue desktop (photos, engagement spirituel, actions)
- [ ] Au-dessus de 640px (`sm:` et plus) → la vue tableau classique s'affiche, cards masquées

### Actions par statut

- [ ] Sophie (`pending_review`) → bouton "Refuser" uniquement (la transition vers `pre_approved` est désormais self-service côté candidat — l'admin ne peut pas pré-approuver)
- [ ] Sophie (`pre_approved`) → bouton "Refuser" uniquement (**pas** de bouton "Valider" standard tant que le questionnaire n'est pas soumis ; le bouton "Valider (bypass)" a été retiré du UI — escape hatch API uniquement)
- [ ] Sophie (`enrichment_pending`) → **pas de boutons Valider/Refuser dans la ligne repliée** (retiré — évite de trancher sur un dossier non lu) ; les actions vivent uniquement dans le panneau déplié, en barre sticky en bas
- [ ] Déplier Sophie (`enrichment_pending`) → panneau avec boutons "Valider" + "Refuser" en bas, sticky (reste visible au scroll dans le panneau)
- [ ] Marie (`validated`) → bouton "Suspendre"
- [ ] Marie (`suspended`) → bouton "Réactiver"
- [ ] Cliquer "Valider" depuis `enrichment_pending` → statut `validated`
- [ ] Réintégrer un candidat `rejected` **avec dossier complet** (photo profil + ≥1 photo lieu) → statut passe directement à `validated`, email de bienvenue envoyé
- [ ] Réintégrer un candidat `rejected` **avec dossier incomplet** (jamais soumis de questionnaire) → statut passe à `enrichment_pending` (pas `validated`), aucun email envoyé — vérifie le garde-fou `isDossierComplet()` (`lib/host-profile.ts`)
- [ ] Refuser une candidature (n'importe quel statut de départ) avec un email associé (`profile.user_id`) → le candidat reçoit l'email "Candidature refusée" (`sendRefusCandidature`), message sobre + raison optionnelle si un champ `notes` était renseigné dans le payload admin

---

## Module 16 — Admin : live feed `/admin/live`

> Prérequis : état `live` (`node scripts/demo-state.js live`)

- [ ] La page charge avec le bandeau "Live en cours" (ou le nom de l'event actif)
- [ ] Liste des signaux : 5 signaux du seed (Jean-Pierre approved, Kofi approved, Aminata pending, Marie used, Fatou declined)
- [ ] Compteur "N signaux approuvés" visible
- [ ] Bouton "Approuver" sur le signal de Aminata (pending) → statut passe à `approved`
- [ ] Bouton "Refuser" sur un signal → statut `declined`
- [ ] Feed des témoignages visible (5 témoignages de l'event J-7)

### En état `upcoming` (hors live)

- [ ] La page charge sans erreur (pas de live en cours)
- [ ] Message "Aucun live en cours" ou affichage de l'event suivant

---

## Module 17 — Admin : calendrier section Lives `/admin/calendrier`

- [ ] La page charge avec les 4 events du seed
- [ ] Les dates sont affichées en heure La Réunion (UTC+4)
- [ ] Formulaire création d'event : titre, description, URL YouTube, date/heure
- [ ] Créer un event → apparaît dans la liste + dans EventBanner de la homepage
- [ ] Modifier un event existant → les changements sont sauvegardés
- [ ] La date/heure s'affiche correctement en timezone Réunion (field label : "Date et heure (heure La Réunion)")

---

## Module 18 — Admin : modération témoignages `/admin/temoignages`

- [ ] La page charge avec le bandeau live (titre + badge "N en attente")
- [ ] Stats bar : total / publiés / villes représentées, scopés à l'event sélectionné
- [ ] Combobox event : changer de live → les stats et onglets se réinitialisent
- [ ] Onglet "En attente" : 2 témoignages (Samuel + témoignage anon)
- [ ] Onglet "Publiés" : 12 témoignages
- [ ] Cliquer "Publier" → le témoignage passe dans "Publiés" immédiatement
- [ ] Bouton "Tout publier" → tous les "en attente" sont publiés en une fois
- [ ] Bouton "Copier le lien" → copie l'URL `/temoignages`
- [ ] Recherche multi-mots : saisir "Abidjan guérison" → filtrage
- [ ] Pagination fonctionnelle (si plus de 10 témoignages par page)

---

## Module 19 — Admin : modération feedbacks `/admin/feedback`

- [ ] La page charge avec les 3 feedbacks du seed
- [ ] 1 signalement en attente (Thomas B / Fatou)
- [ ] Cliquer "Voir le signalement" → motif affiché
- [ ] Bouton "Archiver" → le signalement passe en statut traité
- [ ] Notes de modération éditables

---

## Module 20 — Admin : blocages visiteurs `/admin/blacklist`

- [ ] La page charge sans erreur
- [ ] **Layout** : formulaire d'ajout en haut, liste des blocages en bas
- [ ] Formulaire d'ajout : champs email + téléphone (au moins un requis) + motif (obligatoire)
- [ ] Ajouter un email → il apparaît dans la liste après reload (cf. `created_at` côté DB)
- [ ] La suppression d'un email de la liste fonctionne (DELETE optimiste, sans reload)
- [ ] Tester `POST /api/visit-requests` avec un email blacklisté → réponse `403` + message neutre, pas de demande créée, pas d'email envoyé à l'hôte
- [ ] Tester `POST /api/visitor-help-request` avec un email blacklisté → même comportement (403, pas de notification admin)

---

## Module 21 — Admin : team `/admin/team`

- [ ] La page charge avec les 2 comptes admin (David + Théophile)
- [ ] Formulaire d'invitation d'un nouveau membre (email + rôle)
- [ ] Les rôles disponibles sont listés

---

## Module 22 — Admin : calendrier campagnes `/admin/calendrier`

- [ ] La page charge sans erreur
- [ ] Section "Campagnes planifiées" visible avec form de création
- [ ] Form création : champs — live (select), type (Ambassadeurs / Visiteurs), date d'envoi, message optionnel
- [ ] Créer une campagne `type=ambassadeurs` → `POST /api/admin/campaigns` → snapshot de TOUS les `host_profiles` à `status=validated` dans `campaign_recipients`
- [ ] Si l'INSERT des destinataires échoue → la campagne est rollbackée (pas de campagne orpheline)
- [ ] La campagne créée apparaît dans la liste avec son statut `pending` et le nombre de destinataires

---

## Module 23 — Admin : settings onboarding `/admin/settings`

- [ ] La page charge avec l'URL vidéo actuelle (vide → fallback `config/onboarding.ts`)
- [ ] Modifier l'URL YouTube → sauvegarder → l'encart pending_review du `/dashboard` affiche la nouvelle vidéo
- [ ] Modifier le chemin PDF → sauvegarder → lien "Télécharger" dans le `/dashboard` pointe vers le nouveau chemin

---

## Module 24 — Admin : settings timing `/admin/settings/timing`

- [ ] La page charge avec les valeurs par défaut de la `event_timing_config`
- [ ] Modifier une valeur → sauvegarder → les délais sont mis à jour

---

## Module 25 — Auth `/auth`

- [ ] La page charge sans erreur
- [ ] Saisir un email valide → bouton "Recevoir un lien magique" disponible
- [ ] Soumettre → message de confirmation "Vérifiez votre boîte mail"
- [ ] Magic link généré via terminal (`node scripts/magic-link.js <email>`) → connexion réussie
- [ ] Après connexion, redirection vers `/dashboard` (ambassadeur) ou `/admin/stats` (admin)
- [ ] Bouton "Se déconnecter" dans l'admin sidebar → déconnecte et redirige vers `/auth`

---

## Module 26 — Pages publiques diverses

### `/faq`

- [ ] La page charge sans erreur JS

### `/contact-equipe`

- [ ] La page charge sans erreur JS
- [ ] Formulaire de contact disponible
- [ ] Soumettre → confirmation

### `/temoignages/[live_id]` ou `/lives/[id]/temoignages`

- [ ] La page charge et affiche les témoignages du live correspondant

### `/not-found` (404)

- [ ] Une URL inexistante (ex: `/blabla`) → page 404 s'affiche

---

## Module 28 — APIs : sécurité

### Honeypot

- [ ] `POST /api/temoignages` avec `website` rempli → 200 silencieux (pas de vrai enregistrement)
- [ ] `POST /api/inscriptions` avec `website` rempli → 200 silencieux
- [ ] `POST /api/inscriptions` sans `lat`/`lng` → 400 `"Champs obligatoires manquants."`
- [ ] `POST /api/inscriptions` sans `last_name` → 400 `"Champs obligatoires manquants."`
- [ ] `POST /api/inscriptions` sans `phone` → 400 `"Champs obligatoires manquants."`

### Rate limiting

- [ ] `POST /api/inscriptions` en rafale (10+ requêtes rapides depuis la même IP) → 429

### Tokens invalides

- [ ] `GET /accueillir/invalid-token` → 404 ou message d'erreur clair
- [ ] `GET /refuser/invalid-token` → 404 ou message d'erreur clair
- [ ] `GET /visitor/invalid-token` → 404 ou message d'erreur clair
- [ ] `GET /unsubscribe/invalid-token` → 200 avec message générique (pas d'info leak)
- [ ] `POST /api/campaign-activations` avec token inexistant → 404 JSON

---

## Module 29 — Tests automatisés existants

```bash
# Tests unitaires (vitest) — 141 tests
npm run test

# Tests E2E (playwright — nécessite npm run dev)
npm run test:e2e
```

### Résultats attendus

- [ ] `npm run test` → 232 tests passants, 0 échec
- [ ] `npm run test:e2e` → 4 specs passantes :
  - [ ] `e2e/admin-new-pages-auth.spec.ts` — protection auth admin
  - [ ] `e2e/regression.spec.ts` — statut v2, JS errors, dashboard redirect
  - [ ] `e2e/security-headers.spec.ts` — honeypot, meta noindex
  - [ ] `e2e/new-pages-availability.spec.ts` — /faq, /contact-equipe, tokens invalides

---

## Module 30 — Cycle de statut ambassadeur

> Pipeline self-service jusqu'au questionnaire. L'admin n'intervient qu'à la fin (validation finale ou refus). Utiliser Sophie (`pending_review`) et Marie (`validated`).

| Transition | Déclencheur | Résultat attendu |
|---|---|---|
| `pending_review → pre_approved` | Sophie clique "Activer mon onboarding" sur `/dashboard` | Statut `pre_approved`, **aucun email envoyé**, dashboard recharge avec encart "Conditions acceptées" |
| `pre_approved → enrichment_pending` | Sophie soumet `/dashboard/questionnaire` | Statut `enrichment_pending`, notif admin reçue |
| `enrichment_pending → validated` | Admin clique "Valider" depuis `/admin/ambassadeurs` | Statut `validated`, email bienvenue envoyé |
| `* → validated` (bypass) | Appel API direct `PATCH /api/admin/ambassadeurs/[id]/status` avec `action: 'validated_bypass'` (escape hatch — plus de bouton UI) | Statut `validated`, log `bypass_enrichment` dans `moderation_log` |
| `validated → suspended` | Admin clique "Suspendre" | Statut `suspended`, pin disparaît de la carte |
| `suspended → validated` (dossier complet) | Admin clique "Réactiver" sur un profil avec photo profil + ≥1 photo lieu | Statut `validated`, pin réapparaît, email de bienvenue envoyé |
| `suspended → enrichment_pending` (dossier incomplet) | Admin clique "Réactiver" sur un profil sans photo profil ou sans photo du lieu | Statut `enrichment_pending`, **aucun email envoyé** (garde `isDossierComplet()`, `lib/host-profile.ts`) |
| `rejected → validated` (dossier complet) | Admin clique "Réintégrer" sur un profil avec dossier complet | Statut `validated`, email de bienvenue envoyé |
| `rejected → enrichment_pending` (dossier incomplet) | Admin clique "Réintégrer" sur un candidat refusé avant d'avoir jamais soumis le questionnaire | Statut `enrichment_pending`, **aucun email envoyé** — empêche de restaurer silencieusement un profil incomplet via un bouton UI standard (même risque que `validated_bypass`, trouvé 2026-08-07) |
| `pending_review → rejected` | Admin clique "Refuser" | Statut `rejected`, email `sendRefusCandidature` envoyé au candidat si un email est associé (`profile.user_id`) — message sobre + raison optionnelle (`notes`) |
| ~~admin action `pre_approved`~~ | POST `action: 'pre_approved'` | **400 JSON** — "Action invalide" (transition désormais self-service) |
| ~~admin valider depuis `pending_review`~~ | POST `action: 'validated'` sur `pending_review` | **400 JSON** — "Le candidat doit d'abord remplir le questionnaire. Utilisez validated_bypass si nécessaire." |

---

## Module 31 — Questionnaire ambassadeur `/dashboard/questionnaire`

> Se connecter avec un compte `pre_approved` (passer Sophie à `pre_approved` via admin).

- [ ] Un profil `pending_review` accédant à `/dashboard/questionnaire` → message "Ce questionnaire n'est accessible que pour les candidats pré-approuvés" + lien retour
- [ ] Un profil `validated` accédant → même message de blocage
- [ ] Un profil `pre_approved` → le formulaire s'affiche complet
- [ ] Quatre sections repliables (seule « Formations suivies et livres lus » est ouverte au départ) ; l'en-tête de chacune indique « N à remplir » ou « Complété »
- [ ] **Formations et livres** : liste déroulante avec recherche (formations d'abord, puis livres), cases « J'ai assisté à une conférence de David Théry » et « D'autres livres ou formations m'ont marqué » sous la liste ; cocher « autres » affiche « Quels autres livres ou formations vous ont marqué ? », le décocher efface la saisie
- [ ] **Pratique ecclésiale** : fréquentation d'église (3 options), « Dénomination ou famille d’église » (non exigée si « Je ne fréquente pas une église »), fonction de responsabilité oui/non (« Laquelle ? » si oui ; exemples : groupe de maison, diacre, pasteur, prêtre)
- [ ] **Parcours personnel** : « Avez-vous déjà vu des personnes guéries suite à votre prière ? » oui/non (sans légende), vidéo de présentation (VideoAsk) ; le champ « parcours spirituel » n'apparaît qu'en secours (problème caméra/enregistrement/envoi, ou lien « Un souci avec la vidéo ? »)
- [ ] Les réponses s'enregistrent automatiquement (« Brouillon enregistré à HH:MM ») : recharger la page les retrouve, même depuis un autre appareil
- [ ] **Section photos** : 2 blocs distincts
  - Bloc "Photo de profil" : dropzone unique, preview après upload, bouton supprimer (croix) ; légende « affichée en petit sur la carte publique »
  - Bloc "Photos du lieu d'accueil (max 5, N/5)" : compteur dynamique, grid 3 colonnes après le 1er upload, croix de suppression sur chaque vignette, dropzone disparaît à 5/5
- [ ] **Sur quoi regarder le live** : champ texte « Sur quoi allez-vous regarder le live ? » en fin de section photos, **sans légende**, obligatoire (plafond 200 caractères) ; vide → listé dans « Il manque : … » ; la valeur apparaît dans le panneau admin sous « Téléphone » (« Regardera le live sur »), et reste vide/absente pour les profils antérieurs sans les bloquer
- [ ] Bouton « Envoyer ma présentation à David » toujours cliquable : s'il manque une réponse obligatoire ou une photo, il ouvre les sections concernées et affiche « Il manque : … » ; la vidéo, la liste formations/livres et le parcours écrit ne bloquent pas
- [ ] Même contrôle côté serveur : `PATCH /api/ambassadeur/enrichissement` (hors brouillon) renvoie 400 « Il manque : … » si une réponse obligatoire manque
- [ ] Upload room → `POST /api/upload/ambassador-photo` `type=room` → vignette apparaît + compteur passe à 1/5
- [ ] Suppression room → `DELETE /api/upload/ambassador-photo` → vignette disparaît + DB `room_photo_urls` synchronisée (vérifier via SELECT)
- [ ] Tentative d'upload d'une 6e photo room → 400 "Maximum 5 photos de salle atteint"
- [ ] Soumettre sans photo de profil → erreur 400 "Une photo de profil est requise pour soumettre votre profil."
- [ ] Soumettre sans photo du lieu → erreur 400 "Au moins une photo du lieu d'accueil est requise pour soumettre votre profil."
- [ ] Soumettre avec photo de profil → `PATCH /api/ambassadeur/enrichissement` → statut passe à `enrichment_pending`
- [ ] Après soumission → écran de confirmation "Profil envoyé !" + lien retour dashboard
- [ ] Soumettre 2 fois → 403 (statut déjà `enrichment_pending`, plus `pre_approved`)
- [ ] Champs enregistrés en DB : vérifier dans `/admin/ambassadeurs` → panneau détail

---

## Module 32 — Activation campagne email `/accueillir/activer/[token]`

> Prérequis : créer une campagne `type=ambassadeurs` dans `/admin/calendrier`, puis déclencher le cron `POST /api/cron/dispatch-campaigns` manuellement (ou inspecter les `campaign_recipients` pour récupérer un `activation_token`).

- [ ] Token valide non encore activé → page affiche titre du live, date, et bouton "Je m'inscris comme ambassadeur"
- [ ] Cliquer "Je m'inscris" → `POST /api/campaign-activations` → `host_activations.is_active = true`
- [ ] Page reste sur place après le clic (pas de redirect) → confirmation visuelle inline
- [ ] Recharger la page avec le même token → état "Vous êtes déjà inscrit comme ambassadeur pour ce live"
- [ ] Token invalide → message d'erreur "Lien invalide ou expiré"
- [ ] L'activation est **sans auth** (l'ambassadeur clique depuis son email)

---

## Module 33 — Désabonnement visiteur `/unsubscribe/[token]`

> Prérequis : récupérer un `unsubscribe_token` depuis `campaign_recipients` (table DB).

- [ ] Token valide → page affiche message de confirmation sobre (désabonné avec succès)
- [ ] Lien retour vers `/` présent
- [ ] Token invalide → 200 avec message générique (pas d'info leak sur l'existence du token)
- [ ] Après désabonnement : `campaign_recipients.status = 'unsubscribed'` en DB
- [ ] Idempotent : réutiliser le même token → 200 sans erreur

---

## Module 34 — Cron dispatch campagnes `/api/cron/dispatch-campaigns`

> Tester avec `curl -X POST http://localhost:3000/api/cron/dispatch-campaigns -H "X-Cron-Secret: [secret]"` ou via GH Actions.

- [ ] Sans header `X-Cron-Secret` → 401
- [ ] Secret invalide → 401
- [ ] Aucune campagne pending → 200 JSON `{ dispatched: 0 }`
- [ ] Campagne pending avec destinataires → emails envoyés, `campaign_recipients.status = 'sent'`, `sent_at` renseigné
- [ ] Si un envoi échoue → `attempts++`, statut reste `pending` (pas `sent`). Après 3 échecs : `status = 'failed'`
- [ ] Pagination cursor (pas OFFSET) : tester avec > 100 destinataires si possible

---

## Récapitulatif — Matrice états × fonctionnalités clés

> `closed` et `live-zero` = états DevOverlay uniquement (simulation). Mécanisme prod à venir (bouton admin "Clôturer").
> `blank` = état DevOverlay uniquement (futur live annoncé, 0 ambassadeurs confirmés).

| Fonctionnalité | `past` ⏪ | `closed` 🔚 | `blank` 🫙 | `upcoming` 📅 | `soon` ⏱ | `live-zero` 🔴 | `live` 🔴 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| EventBanner — texte | "Dernier live il y a..." | "Dernier live..." | "Prochain live le..." | "Prochain live le..." | Countdown | "Live en cours" | "Live en cours" |
| EventBanner — couleur | blanc | blanc | blanc | blanc | indigo | rouge/indigo | rouge/indigo |
| Carte — pins visibles | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (7/7) |
| Overlay contextuel | "Dernier live [date]" | "Dernier live [date]" | "Prochain live [date]" | "Prochain live [date]" | "Live dans Xj" | "Live en cours" | absent |
| Overlay — lien CTA | Témoignage → | Témoignage → | Témoignages → | Témoignages → | Témoignages → | live_link (si défini) | — |
| Overlay — stats ambassadeurs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Dashboard — section Signaux | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Dashboard — formulaire témoignage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/admin/live` — feed actif | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Formulaire contact ambassade | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Module 35 — DevOverlay — états et transitions `/` (dev only)

> Le bouton `DEV 🔧` en bas à droite n'est visible qu'en `NODE_ENV=development`.
> Ces scénarios vérifient que les mutations DB du DevOverlay reflètent correctement l'état de la carte.

### 35.1 — Présence et ouverture

- [ ] Bouton `DEV 🔧` visible en bas à droite en dev, absent en prod (process.env.NODE_ENV check)
- [ ] Cliquer → panneau s'ouvre avec 7 boutons état + section Magic Link
- [ ] Cliquer `✕` → panneau se ferme

### 35.2 — Transitions depuis `live`

> Prérequis : cliquer `🔴 Live` → vérifier que 7 pins sont visibles.

- [ ] `[Live]` → `[📅 Upcoming]` : pins disparaissent, overlay "Prochain live [date]" apparaît
- [ ] `[Live]` → `[⏱ Soon 3j]` : pins disparaissent, overlay "Live dans 2 jours..." apparaît
- [ ] `[Live]` → `[🔚 Closed]` : pins disparaissent, overlay "Dernier live [date]" apparaît
- [ ] `[Live]` → `[⏪ Past]` : pins disparaissent, overlay "Dernier live [date]" apparaît
- [ ] `[Live]` → `[🔴 Live (0 confirm.)]` : pins disparaissent, overlay "Live en cours" apparaît
- [ ] `[Live]` → `[🫙 Blank]` : pins disparaissent, overlay "Prochain live [date]" apparaît

### 35.3 — État `🔚 Closed` (nouveau)

- [ ] Bouton `🔚 Closed` présent dans le panneau DevOverlay
- [ ] Après clic : `currentState === 'closed'` → bouton passe en fond indigo
- [ ] La carte reflète `liveInProgress = false` (pas de bandeau "Live en cours")
- [ ] `host_activations.is_active = false` confirmé en DB — aucun pin visible
- [ ] `events.event_date` est dans la fenêtre "juste après le live" (WINDOW_H + 1h dans le passé)
- [ ] nextEvent (futur) reste intact — non modifié par `closed`

### 35.4 — État `🔴 Live (0 confirm.)` — live-zero

> Simule un live en cours sans ambassade confirmée : campagne email non envoyée.
> `event_date = J-2h`, `is_active = false` sur tous les hôtes.

- [ ] Bouton `🔴 Live (0 confirm.)` présent dans le panneau DevOverlay
- [ ] Après clic : `currentState === 'live-zero'` → bouton actif
- [ ] L'EventBanner affiche "Live en cours — rejoignez-nous" (identique à `live`)
- [ ] `host_activations.is_active = false` — aucun pin visible sur la carte
- [ ] L'overlay affiche le message "Les ambassades confirment leur participation..."
- [ ] Si `events.live_link` est renseigné dans le seed : lien "Regarder le live →" visible
- [ ] Si `events.live_link` est null : le lien est absent (guard `lastEvent?.live_link`)

### 35.5 — État `🫙 Blank` — futur annoncé, 0 confirmations

> Simule l'état entre l'annonce du prochain live et l'envoi de la campagne ambassadeurs.
> evtRecent (passé) is_active=false. evtFutur (J+10) is_active=false.

- [ ] Bouton `🫙 Blank 0 confirm.` présent dans le panneau DevOverlay
- [ ] Après clic : `currentState === 'blank'` → bouton actif
- [ ] L'EventBanner affiche "Prochain live le [date]" (≥ 7j, donc format date complète)
- [ ] `host_activations.is_active = false` sur les deux events — aucun pin visible
- [ ] L'overlay affiche "PROCHAIN LIVE" + date + "dans 10 jours"
- [ ] Texte "Les ambassades s'afficheront dès qu'elles confirmeront leur participation."
- [ ] Stats ambassadeurs/pays affichées
- [ ] Lien "Voir les témoignages →" présent

### 35.6 — Magic Link depuis le panneau

- [ ] Bouton rapide `david.thery` → email auto-rempli
- [ ] Bouton rapide `theo.nelson.ia` → email auto-rempli
- [ ] Bouton rapide `marie.dubois` → email auto-rempli
- [ ] Cliquer `→` → lien généré affiché (tronqué 60 chars + "…")
- [ ] Bouton "Copier" → lien dans le clipboard
- [ ] Bouton "Ouvrir →" → nouvel onglet, connexion automatique

---

## Module 36 — Overlay contextuel carte vide — 5 variantes

> Ces scénarios valident le composant `EmptyMapContent` dans `MapPublique.tsx`.
> Prérequis : seed DB propre, utiliser le DevOverlay pour changer d'état.

### 36.1 — État `upcoming` (≥ 3 jours avant le live)

- [ ] Overlay centré visible (carte sans pins)
- [ ] Label "PROCHAIN LIVE" en majuscules (uppercase tracking-wider)
- [ ] Date formatée en français (ex : "mercredi 13 mai") — capitalize
- [ ] Heure formatée (ex : "à 20h00")
- [ ] Mention "dans X jours" correcte
- [ ] Texte : "Les ambassades s'afficheront dès qu'elles confirmeront leur participation."
- [ ] Ligne stats : "N ambassadeurs · X pays" (données réelles de getHomepageData)
- [ ] Lien "Voir les témoignages →" href="/temoignages"

### 36.2 — État `soon` (≤ 2 jours avant le live)

- [ ] Label "PROCHAIN LIVE" présent
- [ ] Mention "dans X jour(s)" (singulier si 1 jour)
- [ ] Texte : "Les ambassades confirment leur participation..."
- [ ] Stats et lien témoignages présents

### 36.3 — État `live-zero` (live en cours, 0 ambassades confirmées)

> Simulable via le bouton `🔴 Live (0 confirm.)` du DevOverlay.
> C'est l'état produit par `lib/dev/state.ts` état `live-zero` : `is_active=false` sur tous les hôtes.

- [ ] Overlay affiche "Live en cours" (ou label équivalent)
- [ ] Texte "Les ambassades confirment leur participation..."
- [ ] Lien "Regarder le live →" visible si `lastEvent.live_link` est renseigné
- [ ] Lien absent si `lastEvent.live_link` est null
- [ ] Stats affichées si `totalAmbassadors > 0`
- [ ] **Test live_link** : vérifier dans Supabase que `events.live_link` du seed evtRecent est bien `https://youtube.com/live/example-recent`

### 36.4 — État `closed` ou `past` (live terminé, prochain non annoncé)

- [ ] Titre "Dernier live" (texte gras, ardoise)
- [ ] Date du dernier live formatée (ex : "lundi 28 avril")
- [ ] Texte "Prochain live annoncé prochainement."
- [ ] Stats ambassadeurs/pays
- [ ] Lien "Partager un témoignage →" href="/temoignages/nouveau"

### 36.5 — Aucun event (vrai état vide)

> Simulable en supprimant tous les events de la DB (hors scope seed standard).

- [ ] Titre "Pas encore de live prévu"
- [ ] Texte "Rejoignez la communauté des groupes de prière."
- [ ] Bouton indigo "Devenir ambassadeur" href="/inscription" (le seul état avec ce CTA)
- [ ] Aucun lien témoignages (pas de live = pas de témoignages existants)

### 36.6 — Overlay viewport vide (hôtes existent mais hors champ)

> Distinct de la carte vide : des pins existent mais le viewport ne les contient pas.
> Simulable en état `live` (pins actifs) + zoomer sur une région sans ambassade.

- [ ] Le hint discret bas-centré apparaît : "Pas d'ambassade dans ta ville ? / Sois le premier ambassadeur ici →"
- [ ] L'overlay `EmptyMapContent` n'apparaît PAS (hosts.length > 0)
- [ ] Le hint disparaît dès qu'on revient sur une zone avec des pins

---

## Journal d'avancement

| Date | Module | Résultat | Observations |
|------|--------|----------|--------------|
| 2026-05-01 | M1 — Accueil / 4 états | ✅ 14/14 | live/upcoming/soon/past OK. Search Nominatim→flyTo OK. Zoom bottomleft OK. No overlap search/banner. |
| 2026-05-01 | M13 — Auth admin (spot) | ✅ | /admin/stats → /auth. /admin/moderation → /auth (middleware avant redirect page). |
| 2026-05-01 | M29 — Tests auto | ✅ 141/141 | vitest 17 fichiers, 0 échec. |
| 2026-05-01 | M4 — Dashboard ambassadeur | ✅ partiel | Guard session OK. Signal live envoyé OK. Témoignage soumis OK (après fix timing). "Mes demandes" vides (seed contact_requests lié à un event différent — non-bloquant). |
| 2026-05-01 | M2 — Page ambassade publique | ✅ | Form chargée. Soumission Thomas→confirmation + lien invite f47b4e8a. 3 bugs trouvés et corrigés (champs API, filtre event, demo-state registration_dates). |
| 2026-05-01 | M14 — Admin stats | ✅ corrigé | KPIs chargés. Bug : "0 Pays représentés" → query filtrait status='active' au lieu de 'validated'. Corrigé dans stats/page.tsx + badge/route.tsx + NouveauTemoignageForm.tsx. Après fix : 6 pays affichés. |
| 2026-05-01 | M15 — Admin ambassadeurs | ✅ corrigé | Search, filtres statut, pagination OK. Bug : recherche affichait "1 ambassadeur" en compteur mais listait encore les 8 → useState(initial) ne se réinitialise pas lors de navigation Next.js. Fix : remplacé state de liste par statusOverrides uniquement. Suspend/Réactiver OK. |
| 2026-05-01 | M16 — Admin live | ✅ | Feed signaux (Mains levées) : 2 signaux pending, Approuver retire la carte instantanément. Onglet Témoignages : "3 témoignages reçus — À modérer après le live". |
| 2026-05-01 | M17 — Admin calendrier | ✅ | 1 à venir + 3 passés affichés. Onglets À venir/Passés OK. Modifier inline (pré-rempli). Nouveau live (form vide). Campagnes planifiées section présente. |
| 2026-05-01 | M18 — Admin témoignages | ✅ | 16/12 publiés. Publication individuelle (icône œil) : 4→3 non publiés, 12→13 publiés. Tout publier (3) : 0 non publiés, 16/16 publiés. |
| 2026-05-01 | M19 — Admin paramètres | ✅ | Formulaire URL vidéo + PDF. Enregistrer : feedback dans le bouton (texte "Enregistré !" 3s). Pas d'erreur API. |
| 2026-05-01 | Admin Signalements | ✅ | 1 signalement en attente (thomas.b@mail.com → Fatou Bruxelles). Actions Prendre en charge / Résoudre / Classer présentes. |
| 2026-05-01 | Admin Blocages | ✅ | 0 entrée, form de blocage (email, téléphone, motif) fonctionnel. |
| 2026-05-01 | Admin Équipe | ✅ | Aucun membre, form ajout (email + rôle Admin). |
| 2026-05-01 | M22 — Admin calendrier | ✅ | 1 à venir + 3 passés. Section campagnes planifiées avec form (live, type Ambassadeurs/Visiteurs, date, message). |
| 2026-05-01 | M24 — Admin settings timing | ✅ | 6 champs numériques (J avant/après). API PATCH 200. Feedback "Sauvegardé" 3s dans bouton (code OK, timing difficile à capturer via JS). |
| 2026-05-01 | M25 — Auth `/auth` | ✅ | Formulaire magic link. Soumission email inconnu → "Vérifiez votre messagerie" (anti-énumération, comportement normal). |
| 2026-05-01 | M26 — Pages publiques | ✅ | /faq (12 Q&A) OK. /contact-equipe → formulaire + "Message envoyé" OK. /page-inexistante → 404 "Page introuvable" + CTA. |
| 2026-05-01 | M3 — Flux visiteur `/live/[event_id]/ambassade/[host_id]` | ✅ corrigé | Page charge avec infos ambassade + formulaire. Bug critique : VisitRequestForm envoyait `visitor_first_name/email/...` mais l'API attend `first_name/email/consent`. Fix : renommage des clés JSON. Après fix : 201 + action_token. |
| 2026-05-01 | M5 — Page visiteur `/visitor/[token]` | ✅ | État "en attente" : event, ambassade, "Marie a reçu votre demande", "Sous 24h". Token invalide → "Page introuvable". |
| 2026-05-01 | M6 — Page hôte `/accueillir/[token]` | ✅ | Note : route est `/accueillir/[token]` (pas `/accueil-invite/`). Infos visiteur (Lucas, 2 personnes, message), boutons "J'accueille" / "Je ne peux pas" visibles. |
| 2026-05-01 | M10 — Témoignages publics `/temoignages` | ✅ | 16 témoignages • 10 villes. Filtre par live (combobox custom) → 9 témoignages "Nuit de Prière". "Filtré sur", "Effacer ×", "Lire la suite", WhatsApp/Copier link OK. |
| 2026-05-01 | M11 — Formulaire témoignage | ✅ | Bouton désactivé < 20 chars. Compteur 96/2000. Soumission → "Merci pour ton témoignage" screen OK. Pré-sélection live, prénom + ville optionnels OK. |
| 2026-05-01 | M8 — Inscription `/inscription` | ✅ corrigé | 3 étapes OK. Autocomplétion Nominatim + auto-pays OK. Bouton "Continuer" bloqué sans sélection dropdown. Bug critique : API insérait `status='pending_onboarding'` → violation contrainte check. Fix : status → `'pending_review'`. Redirect post-soumission → écran "Demande envoyée" (remplace ancien `/onboarding`). Ambassadeur Lucie visible dans admin `pending_review`. |
| 2026-05-03 | M8 — Validation lat/lng inscription | ✅ fix | **Bug** : `POST /api/inscriptions` acceptait `lat`/`lng` null → profil créé sans coordonnées → ambassadeur invisible sur la carte (filtré silencieusement par `host-activations/route.ts`). **Fix double couche** : (1) API ligne 28 : `lat == null \|\| lng == null` → 400 ; (2) frontend `inscription/page.tsx` : check `form.lat == null` (remplace `!form.lat`, corrige edge case lat=0). Champs `last_name` et `phone` (obligatoires) également ajoutés au check API et au disabled du bouton. |
| 2026-05-01 | M9 — Onboarding | ⚠️ obsolète | Flux `pending_onboarding → /onboarding → active` remplacé par review admin. `/api/onboarding/complete` référence encore ces statuts (dead code). Sophie seed a déjà `pending_review`. Page `/onboarding` non reliée au nouveau flux. |
| 2026-05-01 | M7 — Flux visiteur refus | ✅ | Bénédicte refusée via `/accueillir/[token]` (bouton "Je ne peux pas"). Page `/visitor/[token]` passe en état "Demande non retenue" avec bandeau "Pas de place cette fois". |
| 2026-05-01 | M12 — Page visiteur états | ✅ | Avant refus : état "en attente". Après refus : "Demande non retenue". Token invalide → "Page introuvable" + CTA "Retour à la carte". |
| 2026-05-01 | M28 — Sécurité API | ✅ | Honeypot `website` → 200 {} sans insertion DB. Token invalide `/accueillir/xyz` → 404 page custom. Validation contenu < 20 chars → 400 + message d'erreur. |
| 2026-05-01 | Cohérence statuts | ✅ fix | 5 fichiers corrigés : `status='active'` → `'validated'` (stats/page, badge/route, NouveauTemoignageForm) ; `status='pending_onboarding'` → `'pending_review'` (api/inscriptions). Dashboard : redirect `pending_onboarding → /onboarding` supprimée (statut inexistant en DB). `onboarding/page.tsx` : vérif `'active'` → `'validated'`. `api/onboarding/complete` : `pending_onboarding/active` → `pending_review/validated`. CLAUDE.md mis à jour (table seed + section pipeline). QA_SCENARIOS : `/accueil-invite/` → `/accueillir/` corrigé. |

---

| 2026-05-01 | Flow E2E visiteur (M5+M6) | ✅ | Testé avec Pierre/token `f2febdf1`. **Avant acceptation** : `/visitor/[token]` affiche 3 étapes — ① "Demande envoyée" ② "Marie répond — sous 24h" (en attente) ③ "Adresse à venir — transmise par e-mail" (grisée). **Page ambassadeur** `/accueillir/[token]` : pas d'auth requise, affiche nom visiteur + nb personnes + message. Clic "J'accueille" → confirmation "Demande acceptée ! Pierre recevra vos coordonnées par e-mail." **Après acceptation** : `/visitor/[token]` rafraîchi → étape ② "Demande acceptée !", étape ③ "Vous recevrez les coordonnées de Marie par e-mail." Adresse jamais affichée en clair (envoyée par email via `sendAcceptationVisite`). UX note : étape ③ titre reste "Adresse à venir" même après acceptation — pourrait dire "Adresse envoyée" (faible prio). |
| 2026-05-01 | Flow E2E admin pré-validation + carte (M8+M30) | ✅ avec précision | Inscription Alice/Strasbourg : 3 étapes OK, geocoding Nominatim → lat/lng correct, confirmation inline "Demande envoyée" (plus de redirect /onboarding). DB : `status=pending_review`, lat=48.58, lng=7.75. **Carte avant validation** : pas de pin Strasbourg ✅. **Admin pipeline** (testé live via magic link) : "En examen" → "Pré-approuver" → `pre_approved` → "Valider" → `validated`. Trigger DB `trg_auto_activate_host_on_validated` auto-crée une `host_activation` avec `is_active=false`. **Carte après validation** : toujours pas de pin — attendu, car la carte (`/api/host-activations`) affiche uniquement les `host_activations.is_active=true` pour l'événement le plus récent. L'admin doit activer séparément l'ambassadeur pour un événement (step manquant dans l'UI de test). **Note architecture** : la carte ne gate PAS sur `status=validated` mais sur `host_activations.is_active=true` pour l'event courant. |
| 2026-05-01 | Bug route morte PATCH /api/admin/ambassadeurs/[id] | ⚠️ dead code | Ce route.ts accepte `status: 'active'` mais `'active'` viole la contrainte CHECK DB. La route `/status` (POST) remplace tout ce flow depuis le refactor. Route ancienne non appelée par l'UI actuelle. Pas bloquant mais risque si quelqu'un l'appelle directement. |

---

| 2026-05-02 | Bug DB — colonnes manquantes (host_profiles) | ✅ corrigé | Admin ambassadeurs affichait "0 ambassadeurs" silencieusement. Cause : colonnes `conferences_assistees`, `livres_lus`, `phone` absentes du schéma remote. SELECT Supabase avec colonnes manquantes échoue silencieusement → `data ?? []` retourne []. Fix : `ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS` pour les 3 colonnes. Après fix : 8 ambassadeurs visibles. |
| 2026-05-02 | Bug DB — user_id null (host_profiles seed) | ✅ corrigé | Dashboard Marie redirigait vers `/inscription` après magic link. Cause : `host_profiles.user_id = NULL` — le seed insère les profils sans lier l'`id` de `auth.users`. Fix : `UPDATE host_profiles SET user_id = auth.users.id WHERE email = ... AND user_id IS NULL`. Seul Marie a un compte auth.users — les autres ambassadeurs démo n'en ont pas. |
| 2026-05-02 | M4 — Dashboard ambassadeur (complet) | ✅ | "Bonjour, Marie", Paris, France, badge "Actif". Sections : Formation ambassadeur (vidéo), Votre ambassade (partage + badge), Photos de profil + salle (dropzones), MES DEMANDES (vides — aucune demande sur cet event, non-bloquant). |
| 2026-05-02 | M31 — Questionnaire `/dashboard/questionnaire` | ✅ | Guard: status `validated` → `accessDenied` affiché (redirige vers /dashboard). Testé en passant Marie à `pre_approved`. Formulaire complet : 2 cases Formation, select Fréquentation (Régulièrement sélectionné), dénomination, textarea parcours spirituel (0/500), livres, téléphone. Soumission → "Profil envoyé !". DB : status → `enrichment_pending`, `healing_challenge_done=true`, `church_attendance=regular`, `parcours_spirituel` enregistré. Marie remise à `validated` après test. |
| 2026-05-02 | M16 — Admin live `/admin/live` | ✅ | Header "David Théry — Espace admin". Alerte "Aucun live dans les 4 prochaines heures". Affiche dernier event "Nuit de Prière — Souffle nouveau". Section Mains levées : 1 signal en attente (Aminata, Dakar) avec boutons Approuver/Refuser. Section Témoignages : "2 témoignages reçus — À modérer après le live". |
| 2026-05-02 | M17 — Admin calendrier section Lives `/admin/calendrier` | ✅ | "1 à venir · 3 passés". Onglets À venir/Passés. Recherche. Event "Live Guérison — La puissance de l'Amour" (mardi 12 mai 2026 à 01h55) + lien YouTube. Bouton Modifier présent. "+ Nouveau live" opérationnel. (Testé sur l'ancienne route `/admin/planning`, supprimée le 2026-05-07 — la section Lives est désormais embarquée dans `/admin/calendrier`.) |
| 2026-05-02 | M23 — Admin settings `/admin/settings` | ✅ | URL vidéo YouTube (format embed) + hint "Remplacer VIDEO_ID". Lien PDF guide + hint. Bouton "Enregistrer". |
| 2026-05-02 | M10 — Témoignages publics `/temoignages` | ✅ (re-vérif) | "Ce que Dieu a fait" + Sparkles. 12 témoignages • 10 villes. Filtre "Tous les lives". Grille 2 colonnes. "Lire la suite" sur cartes tronquées. Auteur + ville + titre live en indigo. |
| 2026-05-02 | M11 — Formulaire témoignage `/temoignages/nouveau` | ✅ | Accès sans auth. Dropdown live pré-sélectionné (prochain event). Textarea 206/2000 rempli. Prénom + ville optionnels (placeholders Marie/Lyon). Soumission → "Merci pour ton témoignage — Il sera relu avant d'être publié." Témoignage visible en "Non publiés" dans /admin/temoignages (3 en attente, dont Bordeaux soumis). |
| 2026-05-02 | M22 — Admin calendrier `/admin/calendrier` | ✅ | Section Lives (1 à venir + 3 passés, "+Nouveau live", tabs, search). Section "Campagnes planifiées" avec form (select live, type Ambassadeurs/Visiteurs, date d'envoi). |
| 2026-05-02 | M18 — Admin témoignages `/admin/temoignages` | ✅ (re-vérif) | 15 total / 12 publiés / 3 non publiés. Onglets "Non publiés 3 / Publiés 12 / Tous 15". "Tout publier (3)" présent. Témoignage Bordeaux de ce test visible en tête. "Page publique" lien top right. |

---

---

## Module 33 — Preview emails `/dev/emails`

> **Prérequis :** `EMAIL_PREVIEW=true` dans `.env.local` (déjà présent). Sur Vercel Preview : variable ajoutée dans le dashboard Vercel → Settings → Environment Variables (scope : Preview).

```bash
npm run dev
# Ouvrir http://localhost:3000/dev/emails
```

### 33.1 — Rendu et structure

- [x] La page `/dev/emails` s'affiche sans erreur (200)
- [x] La page `/dev/emails` en production (`NODE_ENV=production`, sans `EMAIL_PREVIEW`) retourne 404 — guard `if (!process.env.EMAIL_PREVIEW) notFound()` confirmé dans le code
- [x] Le compteur de templates en sous-titre affiche **17 templates**
- [x] Les 4 sections sont présentes : "Parcours ambassadeur", "Parcours visiteur", "Live", "Admin"
- [x] Chaque section contient le bon nombre d'iframes :
  - Ambassadeur : 8 iframes
  - Visiteur : 5 iframes
  - Live : 1 iframe
  - Admin : 3 iframes

### 33.2 — Rendu visuel des emails

- [x] Chaque iframe affiche un email correctement rendu (pas de page blanche, pas d'erreur JS)
- [x] Les styles Next.js / Tailwind ne "débordent" pas dans les iframes (isolation `srcDoc`)
- [x] Les boutons CTA (indigo) s'affichent avec la bonne couleur
- [x] Les emails affichent les données mock : Marie Dubois, Lyon, France
- [x] Aucun `undefined` visible dans les textes (props mock manquantes)
- ~~Le bandeau "Guérison" / header logo est cohérent dans chaque email~~ — les emails n'ont pas de logo/bandeau image (EmailLayout minimaliste text-only). À discuter avec David si un logo est souhaité.

### 33.3 — Contenu (vérifier avec David)

> Parcourir chaque email ligne par ligne avec David. Cocher quand le contenu est validé.

| # | Template | Label dans la page | Validé |
|---|---|---|---|
| 1 | `magic-link` | Magic link (connexion standard) | [ ] |
| ~~2~~ | ~~`magic-link-bienvenue`~~ | ~~Magic link — bienvenue nouvel inscrit~~ | 🗑 Supprimé — redondant avec `registration-confirmation` |
| ~~3~~ | ~~`pre-validation-accordee`~~ | ~~Pré-validation accordée~~ | 🗑 Supprimé — la transition `pending_review → pre_approved` est désormais self-service (pas d'email intermédiaire) |
| 4 | `bienvenue-ambassadeur` | Bienvenue ambassadeur (validation finale) | [ ] |
| 5 | `validation-finale` | Validation finale — ambassade active | [ ] |
| 6 | `registration-confirmation` | Confirmation inscription | [ ] |
| 7 | `campagne-ambassadeurs` | Campagne — invitation au prochain live | [ ] |
| 8 | `feedback-post-live` | Feedback post-live | [ ] |
| 9 | `contact-received-host` | Ambassadeur — demande de visite reçue | [ ] |
| ~~10~~ | ~~`contact-accepted`~~ | ~~Demande de contact acceptée~~ | 🗑 Supprimé — étape intermédiaire retirée du flux contact |
| 11 | `contact-reserved` | Place réservée — coordonnées partielles | [ ] |
| 12 | `contact-declined` | Demande refusée | [ ] |
| 13 | `acceptation-visite` | Confirmation de visite — adresse dévoilée | [ ] |
| 14 | `refus-visite` | Visite refusée | [ ] |
| 15 | `campagne-visiteurs` | Campagne — prochain live | [ ] |
| 16 | `signal-approved` | Signal approuvé — témoignage en direct | [ ] |
| 17 | `nouvelle-activation-admin` | Nouvelle ambassade activée (admin) | [ ] |
| 18 | `enrichissement-recu` | Questionnaire d'enrichissement soumis (admin) | [ ] |
| 19 | `admin-alerte-no-activations` | Alerte — 0 hôtes actifs (admin) | [ ] |

### 33.4 — Questions de contenu pour David

> Ces questions sont à poser à David lors de la session de revue des emails. Elles concernent le ton pastoral, le vocabulaire, et les attentes des destinataires.
> 
> **Analyse préalable /qa (2026-05-02)** — réponses anticipées depuis la perspective pastorale de David. À valider avec lui en session.

| Domaine | Question | Analyse /qa |
|---|---|---|
| **Ton général** | Les emails utilisent "ambassadeur" et "ambassade de guérison" — c'est bien le vocabulaire que tu veux ? Ou "groupe de prière" est plus juste pour les emails externes ? | Garder "ambassadeur" dans les emails internes. Dans `campagne-visiteurs`, ajouter une ligne de contextualisation ("chez des particuliers ou des petites églises") pour les non-initiés. C'est déjà en partie là. |
| **Prénom seul** | On s'adresse toujours aux gens par leur prénom ("Bonjour Marie,"). C'est suffisant ou tu veux ajouter le nom de famille dans certains cas ? | Prénom seul est le bon registre pastoral. Ajouter le nom = ton administratif. Pas de changement. |
| **Magic link** | L'email de connexion est minimaliste (juste le bouton). Tu veux ajouter une phrase d'accroche spirituelle, ou le garder fonctionnel/neutre ? | Garder neutre. `magic-link-bienvenue` a été supprimé (redondant). Le magic link standard reste fonctionnel. |
| ~~Pré-validation~~ | Question retirée. Le template `pre-validation-accordee` a été supprimé : la transition `pending_review → pre_approved` est désormais déclenchée par le candidat lui-même sur le dashboard (vidéo + PDF + checkbox CGU). Pas d'email à ce stade — le candidat est connecté et voit immédiatement le questionnaire débloqué. | — |
| **Bienvenue ambassadeur** | Les emails de bienvenue mentionnent le dashboard et la carte. Est-ce que tu veux une phrase personnelle de toi (signature David Théry) dans ces emails ? | **OUI, recommandé.** `validation-finale` se termine par "Merci d'ouvrir votre maison. C'est là que tout se passe." — ajouter "— David Théry" transforme l'email système en lettre personnelle. Idem pour `bienvenue-ambassadeur`. |
| **Campagne ambassadeurs** | L'email de campagne peut contenir un `customMessage` libre. Tu l'utiliseras souvent ? Faut-il un template de message suggéré dans l'admin ? | Utilisé à chaque live. Ajouter un placeholder dans le champ admin : "Décris le live en 1-2 phrases. Ex : Ce soir, David priera pour les malades." |
| **Feedback post-live** | Email envoyé après le live pour demander un retour. Vers quoi pointe `feedbackUrl` ? Formulaire interne ou Google Form ? | Formulaire interne (`/feedback?token=...`). La page n'existe pas encore — à construire. Google Form = perte de données et coupure de marque. |
| **Contact visiteur** | L'email au visiteur quand sa place est réservée (`contact-reserved`) révèle l'email de l'hôte mais pas son adresse. C'est intentionnel — l'adresse arrive dans `acceptation-visite`. Ça te semble juste ? | Oui, intentionnel et juste. Deux étapes : contact partiel → adresse complète après confirmation. Protège la vie privée de l'hôte. |
| **Refus de visite** | Email `refus-visite` : "Votre demande auprès de [hôte] — mise à jour". Le ton est volontairement neutre pour ne pas stigmatiser. Tu veux quelque chose de plus pastoral ("nous sommes désolés...") ? | Pas de changement. "Ne vous découragez pas — les ambassades grandissent à chaque live." est déjà pastoral et encourageant. |
| **Campagne visiteurs** | Contient un lien de désinscription (`unsubscribeUrl`). Qui gère cette liste ? Il faudra une page `/unsubscribe?token=...` côté app. | **Action requise.** Page `/unsubscribe/[token]` obligatoire (RGPD). N'existe pas encore. À ajouter avant envoi de vrais emails. |
| **Signal approuvé** | Email `signal-approved` : sélection pour témoigner en direct. C'est envoyé à qui exactement — aux personnes qui ont levé la main via `/admin/live` ? | Oui — ambassadeurs ayant levé la main dans l'app, David approuve via `/admin/live`, l'email part. Suggestion : préciser "YouTube" dans le CTA ("Rejoindre le live YouTube"). |
| **Emails admin** | Les 3 emails admin (nouvelle activation, questionnaire, alerte 0 hôtes) vont à quelle adresse ? `RESEND_ADMIN_EMAIL` — c'est ton adresse perso ou une boîte partagée avec une équipe ? | Pour le MVP : adresse perso. Quand le réseau grandira : prévoir une boîte équipe. L'alerte `admin-alerte-no-activations` mentionne `fn_auto_activate_hosts_for_event` — terme trop technique si David lit ses alertes. |
| **Objet des emails** | Veux-tu relire les sujets (`subject`) de chaque email ? Ils sont visibles dans le code `lib/email/templates.ts` et c'est la première chose lue dans la boîte mail. | 2 sujets à affiner : templates 4 et 6 sont trop génériques ("Bienvenue dans les Ambassades de Guérison !"). Suggestion : personnaliser avec le prénom. Rapport complet dans `.gstack/qa-reports/qa-report-dev-emails-2026-05-02.md`. |

---

| Date | Module | Statut | Notes |
|---|---|---|---|
| 2026-05-02 | M33 — Preview emails `/dev/emails` | ✅ mis en place | Page `/dev/emails` rendue à 200 en local. 19 templates React Email v6. Guard `EMAIL_PREVIEW` pour isoler de la prod. iframes `srcDoc` pour isolation CSS. Prêt pour revue contenu avec David. |
| 2026-05-02 | M33 — QA /dev/emails | ✅ passé | 19/19 iframes chargées, 0 erreur console. ISSUE-001 fixé (`enrichment_pending` raw retiré). 13 questions Module 33 pré-analysées. Score santé 95/100. 2 actions RGPD requises avant prod : `/unsubscribe/[token]` + `/feedback?token`. |
| 2026-05-02 | M29 — Tests auto | ✅ 149/149 | vitest 18 fichiers, 0 échec. Aucune régression suite aux modifications overlay + DevOverlay état `closed`. |
| 2026-05-02 | M1 — Overlay contextuel (fix DevOverlay) | ✅ passé | Bug fix confirmé : `live → upcoming` → is_active=false, 0 pin. `live → soon` → idem. `live → closed` → overlay "Prochain live [date]" (nextEvent intact). `past` → overlay "Dernier live samedi 25 avril · Prochain live annoncé prochainement · Partager un témoignage →". Stats "7 ambassadeurs · 6 pays" affichées dans tous les états vides. Lien témoignages présent. |
| 2026-05-02 | M35 — DevOverlay état `closed` | ✅ passé | Bouton "🔚 Closed" présent. Transition live→closed : pins disparaissent, overlay contextuel apparaît. `is_active=false` en DB confirmé. nextEvent non modifié par l'état closed. |

---

*Généré le 2026-05-01 — DavidTheryApp v1 — branch `develop`*
*Mis à jour le 2026-05-02 — Session QA suite (dashboard, questionnaire, pages admin complètes)*
*Mis à jour le 2026-05-02 — Module 33 ajouté : preview emails React Email v6*
*Mis à jour le 2026-05-02 — Module 33 passé : QA /dev/emails, 13 questions pré-analysées, ISSUE-001 fixé*
*Mis à jour le 2026-05-02 — M1 corrigé + M35/M36 ajoutés : overlay contextuel carte vide + DevOverlay état `closed`*
*États gérés par le DevOverlay (bouton DEV 🔧 en dev) — remplace `scripts/demo-state.js` pour les tests UI*
