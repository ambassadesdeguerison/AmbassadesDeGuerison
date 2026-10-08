@AGENTS.md
@docs/ARCHITECTURE.md
@docs/knowledge-transfer.md

## Projet

DavidTheryApp — Ambassades de Guérison. Next.js 15 + Supabase + Tailwind. Stack complète et schéma des couches : voir ARCHITECTURE.md.

## Phase actuelle — conception (pas encore en production)

**L'app n'est pas encore lancée auprès de vrais utilisateurs.** Camille (assistante de David) n'est pas encore briefée. La DB Supabase ne contient que des données seed/démo.

L'URL `https://ambassades-guerison.vercel.app` est techniquement une "production" Vercel mais sert d'**environnement de démo/preview** — pas de trafic réel, pas de vrais ambassadeurs, pas de vraies demandes de visite.

**Implications pour les changements :**

- Pas besoin de garantir zero-downtime ou backwards compat sur les changements DB — `supabase db query --linked --file scripts/reset-db.sql && node scripts/seed.js` repart toujours à zéro.
- Les scripts `scripts/migration-*.sql` sont **forward-looking** : utiles le jour où Camille sera briefée et qu'on aura de vrais profils en DB qu'on ne voudra plus écraser. Pour l'instant, modifier `reset-db.sql` directement est OK.
- Pas de canary, rolling release, ni feature flag requis pour les changements UX. Un push sur `main` actualise simplement la démo.
- Le DevOverlay est rendu sur l'URL "production" (`NEXT_PUBLIC_DEV_OVERLAY=true`) précisément parce qu'on est encore en conception — David et nous testons les états DB depuis l'URL publique.

**Ce qui change le jour où on quitte la phase de conception :**

1. Camille reçoit un magic link et commence à valider de vrais profils → la DB a de vrais ambassadeurs
2. Désactiver `NEXT_PUBLIC_DEV_OVERLAY` en prod (le DevOverlay disparaît)
3. Désactiver les routes `/dev/*` (déjà gated par secret, mais à durcir)
4. Activer les crons dans `vercel.json` (campaigns + feedback + check-activations)
5. À partir de là : zero-downtime obligatoire, migrations idempotentes obligatoires, rollback plan pour chaque release.

## Testing

```bash
npm run test            # vitest (tests unitaires)
npm run test:e2e        # playwright (E2E, nécessite npm run dev)
```

Tests DB (triggers, RLS) : nécessite `supabase start` (Docker).

## Déploiement Vercel

Projet : **`ambassades-guerison`** — compte `yoan-theophiles-projects` (renommé depuis `davidthery-app` le 2026-05-05)
- **Production** : https://ambassades-guerison.vercel.app
- **Dashboard** : https://vercel.com/yoan-theophiles-projects/ambassades-guerison
- **Lien local** : `.vercel/project.json` (ajouté au `.gitignore`)

### Déployer depuis un SHA git précis (sans les fichiers locaux non committés)

```bash
git archive --format=tgz <SHA> | vercel deploy --archive=tgz --yes --scope yoan-theophiles-projects --prod
# Omettre --prod pour un déploiement preview
```

Préférer cette approche à `vercel deploy` classique quand des modifications non committées sont en cours.

### Variables d'environnement — portées

Toutes les variables sont configurées sur les deux scopes (Production/Preview), sauf 3 qui diffèrent : `EMAIL_PREVIEW` (false en prod → `/dev/emails` 404, true en preview), `NEXT_PUBLIC_DEV_OVERLAY` (true en prod uniquement, phase de conception), `DEV_OVERLAY_SECRET` (requis en prod pour les routes `/api/dev/*`, header `x-dev-secret`). Détail complet : ARCHITECTURE.md § Variables d'environnement clés.

Ajouter/modifier les variables : `vercel env add NAME production` ou via l'API REST (token dans `%APPDATA%\com.vercel.cli\Data\auth.json`).

## Développement local

### Emails

20 templates dans `emails/*.tsx` (React Email v6). `lib/email/templates.ts` contient les fonctions `sendXxx`.

- **Preview visuelle** (données mock) : `/dev/emails`, nécessite `EMAIL_PREVIEW=true` dans `.env.local` (404 en prod sans cette variable).
- **Test du vrai chemin d'envoi** (Mailhog, capture SMTP locale) : `npm run mailhog` puis `USE_MAILHOG=true` dans `.env.local` → tous les envois `lib/email/send.ts` sont routés vers http://localhost:8025 au lieu de Resend. `npm run mailhog:stop` pour arrêter.
- **Connexion admin sans email** (le sandbox Resend `onboarding@resend.dev` ne livre qu'au propriétaire du compte, pas aux adresses `@demo.fr`) : `node scripts/magic-link.js <email>` génère un lien direct, valable 1h.
- Templates supprimés (orphelins, ne pas recréer sans vérifier un caller réel) : `magic-link-bienvenue`, `contact-accepted`, `contact-reserved`, `pre-validation-accordee`, `bienvenue-ambassadeur`. Ce dernier annonçait à tort "vous apparaissez sur la carte" dès validation admin (l'ambassadeur doit encore s'auto-activer par live) — trouvé par `/qa` le 2026-07-28.

### Reset base de données

```bash
supabase db query --linked --file scripts/reset-db.sql   # recrée le schéma
node scripts/seed.js                                      # insère les données de démo
```

Comptes de démo : voir `scripts/seed.js`. Notes non-évidentes : un cluster de 6 ambassadeurs à Paris teste le rendu Leaflet à forte densité ; Nathalie et Manon (Nantes) sont géocodées à ~600m l'une de l'autre pour reproduire le cas de clustering par proximité (voir bug clustering plus bas).

## Pipeline d'activation ambassadeur

Flux self-service jusqu'au questionnaire (voir ARCHITECTURE.md § Cycle de vie d'un ambassadeur pour le diagramme complet). Points non-évidents :

- **Transition `pending_review → pre_approved`** est exclusivement self-service (`PATCH /api/onboarding/complete`, pas d'email, idempotente). L'action admin `pre_approve` n'existe plus.
- **Video gate** : la checkbox d'engagement reste désactivée tant que le candidat n'a pas cliqué dans la vidéo YouTube (détection via `blur` + `document.activeElement instanceof HTMLIFrameElement`, helper `buildVideoUrl` dans `lib/youtube.ts`).
- **`validated_bypass`** reste accepté par l'API comme escape hatch (support/SQL) mais le bouton dédié a été retiré de `/admin/ambassadeurs` — un bypass produit un ambassadeur sans photo ni questionnaire, visible publiquement avec un profil incomplet.
- **`reactiver`** (bouton "Réintégrer"/"Réactiver", depuis `rejected`/`suspended`) route vers `validated` uniquement si le dossier est complet (photo profil + ≥1 photo lieu) — sinon vers `enrichment_pending`, sans email. Sans cette garde, réintégrer un candidat refusé avant d'avoir jamais rempli le questionnaire produisait le même profil incomplet publiquement visible que `validated_bypass`, mais accessible depuis un bouton UI standard (trouvé 2026-08-07).
- `enrichment_pending` requiert `profile_photo_url` non NULL et `room_photo_urls` non vide (garde côté API, `PATCH /api/ambassadeur/enrichissement`). Cet invariant n'est garanti que pour les profils passés par ce chemin — une donnée créée directement en base (script, test) peut avoir `enrichment_pending` sans dossier complet. `/dashboard` (encart + `StatusTimeline`) et `/admin/ambassadeurs` (`questionnaireGaps()`) revérifient tous deux les colonnes réelles plutôt que de faire confiance au seul statut (trouvé 2026-08-07 : un profil de test avec cet état affichait "en cours d'examen" côté ambassadeur et "3 manquants" côté admin simultanément). `/dashboard/questionnaire` reste volontairement strict (`status !== 'pre_approved'` → accès refusé) — pas de chemin de récupération UI pour un `enrichment_pending` incomplet, cet état ne devrait jamais survenir hors données de test.

## Questionnaire enrichi v2 (`/dashboard/questionnaire`, 2026-09-30)

Refonte demandée par David. Points non-évidents :

- **Enregistrement automatique** : `PATCH /api/ambassadeur/enrichissement` avec `draft: true` écrit les champs en base (1,2 s après la dernière frappe) **sans** changer le statut ni exiger les photos. Le candidat reprend où il s'est arrêté, même depuis un autre appareil. Tout passe par `lib/questionnaire/sanitize.ts` : seuls les champs connus et les slugs du catalogue sont acceptés.
- **Formations et livres : liste déroulante à cases à cocher avec recherche** (`CheckboxCombobox`, plus économe en place que des pastilles), catalogue dans `lib/questionnaire/catalog.ts` (source : boutique de David). Ordre : formations puis livres. La conférence de David et « autres livres ou formations » sont deux **cases visibles sous la liste**, pas des options de la liste (trop loin en bas, elles s'oubliaient ; sorties de la liste, le champ « Quels autres livres… ? » garde un libellé qui se comprend seul). Les identifiants de la liste sont préfixés (`t:` formation, `b:` livre) pour ne pas confondre un livre et une formation homonymes ; les slugs stockés en base (`books_read`, `trainings_done`) : **ne jamais les renommer**, seulement en ajouter. `healing_challenge_done` reste la colonne lue par le dashboard/l'admin ; `sanitize` la synchronise avec la formation « Défi Guérison ». « Autres » coché affiche le champ texte `livres_lus` ; le décocher l'efface. **Finalité et destinataire sont dits une seule fois, en tête de page** (« Seule l'équipe voit vos réponses »), pas répétés sous chaque section : même usage pour tous les champs du questionnaire (l'exception reste la photo de profil, publique, qui garde sa légende).
- **Tous les champs sont obligatoires** (`lib/questionnaire/completeness.ts`, 2026-10-01), **sauf** la vidéo, la liste formations/livres et le parcours écrit. La dénomination n'est pas exigée de qui ne fréquente aucune église. **L'écran ne dit jamais « facultatif »** (ni en tête de page, ni sur la section, ni sur la vidéo) : cela inciterait à ne pas remplir ; la consigne affichée est « Merci de remplir tous les champs », et seule la validation à l'envoi laisse passer ces trois champs. Le bouton d'envoi reste cliquable : s'il manque quelque chose, il ouvre les sections concernées et liste les manques. Les sections sont repliables (`CollapsibleSection`, contenu gardé monté : une vidéo ou un envoi de photo en cours ne se perd pas), l'en-tête indique « n à remplir » ou « Complété ».
- **Message d'accueil obligatoire** (`presentation_message`, 240 car., 2026-10-01) : dans la section « Photos et message d'accueil », juste sous la photo de profil, car c'est le seul texte **public** de l'ambassadeur (popup de la carte, à côté de la photo). Même colonne et même plafond que `MesInfosSection` du dashboard (`PRESENTATION_MESSAGE_MAX` dans `sanitize.ts`). Absent du questionnaire jusque-là : le candidat n'avait aucune raison d'aller le chercher dans le dashboard et la carte affichait des photos sans texte. Non bloquant côté admin (`questionnaireGaps`) : les profils antérieurs n'en ont pas.
- **« Sur quoi allez-vous regarder le live ? »** (`live_screen`, 200 car., 2026-10-08) : texte libre obligatoire en fin de la section « Photos et message d'accueil » (proche de la photo du lieu où l'on regardera le live). Sert à David pour juger si la demande est réaliste ; **volontairement sans légende** (demande explicite). Visible de l'admin seulement (panneau déplié, sous le téléphone), non bloquant côté `questionnaireGaps` : les profils antérieurs n'en ont pas. Migration : `scripts/migration-live-screen.sql` (idempotente) ; sans elle, le questionnaire ne charge pas (colonne absente).
- **Libellés choisis par David (2026-10-08)** : section « Formations suivies et livres lus » (c'est ce qu'il a lu ou suivi qui l'intéresse, pas ce qu'il possède), « Dénomination ou famille d'église », « suite à votre prière » pour les guérisons vues (on veut savoir si la personne est sur un chemin de pratique de la guérison), « prêtre » parmi les exemples de responsabilités. Aucune légende ajoutée sur ces champs.
- **Le parcours écrit n'est qu'un secours** : le champ « parcours spirituel » n'apparaît que si la vidéo pose problème (`VideoAsk.onProblem`) ou si le candidat clique « Un souci avec la vidéo ? ». L'admin ne signale « ni vidéo ni parcours » qu'en information, jamais en blocage.
- **`has_seen_healings` / `has_leadership_role` valent `NULL` tant que non répondus** : ne jamais les traiter comme `false`.
- **Vidéo de présentation** (`components/ui/VideoAsk.tsx`) : `MediaRecorder` natif, sans bibliothèque (aucune n'apporte de compatibilité en plus), MP4 en premier puis WebM ; repli `<input capture>` si l'enregistrement en page est impossible. Facultative, visible par l'admin seulement. L'admin a toujours un lien « Télécharger » (un WebM ne se lit pas sur Safari < 18.4).
- **Stockage vidéo provisoire = bucket Supabase privé `ambassador-videos`** (50 Mo max, plafond du plan gratuit), envoi direct navigateur → Supabase par URL signée (les fonctions Vercel plafonnent à 4,5 Mo). Prévu pour être remplacé par pCloud (dossiers année/mois lisibles sans API, `fileid` stocké en base, compte dédié) : seuls `lib/video/upload-client.ts` et `app/api/ambassadeur/video/` changent.
- Migration : `scripts/migration-questionnaire-v2.sql` (idempotente). Sans elle, le questionnaire ne charge pas (colonnes absentes).

## Formulaire d'inscription (`/inscription`)

**Adresse e-mail confirmée avant toute création** (2026-10-01) : `/inscription` s'ouvre sur l'étape 0 « Recevoir le lien de confirmation » (`POST /api/inscriptions/verify-email`). Le lien `/inscription?verify=<jeton>` — jeton HMAC sans état de 24 h, `lib/auth/email-proof.ts`, secret `EMAIL_PROOF_SECRET` (sinon `SUPABASE_SERVICE_ROLE_KEY`) — ouvre le formulaire avec l'adresse verrouillée, et `POST /api/inscriptions` renvoie 403 `email_not_verified` sans preuve valide **pour cette adresse**. Avant, n'importe qui pouvait inscrire l'adresse d'un tiers : profil rattaché à son compte, rôle d'un compte visiteur existant basculé en « host », notification à l'équipe. Ne jamais créer de compte ou de profil avant la preuve. Tests de bout en bout avec le vrai e-mail : `e2e/email-verification.spec.ts` (Mailhog, comptes jetables supprimés en fin de test).

**Session ouverte à la fin de l'inscription — exception assumée à « jamais de `token_hash` dans une réponse »** (2026-10-08, validée par le propriétaire du projet) : `POST /api/inscriptions` renvoie `login: { token_hash, type }` et `app/inscription/page.tsx` l'échange aussitôt contre une session (`verifyOtp`), pour que l'écran de succès propose « Continuer mon inscription » → `/dashboard` au lieu de « Me connecter ». Avant, `connected` n'était vrai que si la personne avait déjà une session avec cette adresse : jamais pour un vrai candidat. **Pourquoi c'est acceptable ici et pas ailleurs** : l'adresse est déjà prouvée (`email_proof` vérifié avant toute création), donc ce jeton ne donne pas plus de droits qu'un lien magique reçu par e-mail. Il reste interdit partout où l'adresse n'est pas prouvée (`/api/visitor/account`, `/api/auth/magic-link`). Conditions à ne pas défaire : jamais de `login` dans la réponse sans `email_proof` valide (le 403 `email_not_verified` passe avant) ; **un seul `generateLink` par inscription** (un second invaliderait le premier), donc **l'e-mail de confirmation ne porte plus de lien de connexion** : son bouton va sur `/dashboard`, et depuis un autre appareil la personne passe par `/auth`. Si la génération échoue, l'inscription réussit quand même et l'écran retombe sur « Me connecter ». Test : `tests/unit/inscription-login-link.test.ts`.

Champs obligatoires étape 1 : prénom, nom, e-mail, téléphone (E.164, `react-phone-number-input`), ville avec géocodage confirmé, pays. Pièges déjà corrigés à ne pas réintroduire :

- `countryCallingCodeEditable={false}` sur `PhoneInput` : sans ce lock, sélectionner tout le champ et retaper le numéro pouvait faire basculer silencieusement l'indicatif pays.
- `/api/geocode` déduplique les suggestions Nominatim par label (deux entités distinctes pour la même ville produisaient des doublons indiscernables).
- Le check de coordonnées utilise `form.lat == null` (jamais `!lat`) — sinon les villes à latitude 0 (équateur) seraient bloquées à tort.
- `AddressInput` (adresse précise → `lat_precise`/`lng_precise`) est distinct de `quartier` (texte libre public affiché sur la carte) — le premier n'est jamais public, voir § Règles importantes.

## Page d'accueil publique (`/`)

Carte Leaflet plein écran, voir `components/MapPublique.tsx` pour le détail d'implémentation (géolocalisation, recherche ville, états vides). Point non-évident à ne pas réintroduire :

- **Clustering par proximité en pixels** (`leaflet.markercluster`, pas par coordonnées exactes) — corrigé juillet 2026. L'ancien regroupement par clé `"${lat},${lng}"` ne fusionnait que les hôtes aux coordonnées strictement identiques : deux ambassadeurs proches mais géocodés à des points légèrement différents pouvaient se superposer silencieusement dans le DOM, l'un masquant totalement l'autre sans aucun badge. Le plugin recalcule la distance à l'écran à chaque zoom.
- **Jitter décoratif des pins** (`lib/geo/jitter.ts`, ajouté 2026-09-27) — le geocodage se fait au niveau ville, donc plusieurs ambassadeurs d'une même ville ont des `lat`/`lng` identiques. `GET /api/host-activations` décale chaque pin d'un offset pseudo-aléatoire mais déterministe (haché sur `host_id`, rayon 250m) avant de le renvoyer, pour qu'ils ne s'empilent jamais littéralement au même pixel. **Ne jamais dériver ce jitter de `lat_precise`/`lng_precise`** (adresse réelle) — publier même un point flouté ancré sur la vraie adresse transformerait `/api/distance` en oracle de triangulation amplifié (zone de recherche réduite gratuitement au lieu d'une recherche à l'aveugle sur toute la ville), un risque identifié en `/office-hours` et particulièrement grave pour les hôtes en zone rurale à faible densité de bâti. Voir ARCHITECTURE.md § Jitter décoratif carte publique pour le détail complet de la décision écartée.

## DevOverlay — simulation d'états (dev local + prod gated)

`components/DevOverlay.tsx`, gated par `NODE_ENV !== 'production'` OU `NEXT_PUBLIC_DEV_OVERLAY === 'true'` (helper `lib/dev-overlay-auth.ts`). En prod, `/api/dev/state` et `/api/dev/magic-link` exigent un header `x-dev-secret` valide (sinon 403, secret auto-effacé côté client pour reprompt). 9 états simulables, voir `lib/dev/state.ts:applyState()`.

Piège corrigé : l'état `closed` doit remettre `demoFutureEvent` à J+10 (commit 56a4d30) — sans ce fix, l'overlay restait bloqué sur "Dernier live" au lieu d'annoncer le prochain.

## Profil visiteur réutilisable (`/mon-espace`)

Compte créé explicitement via `/mon-espace/creer` (pas en best-effort silencieux, voir ARCHITECTURE.md pour le flux complet). Pièges corrigés à ne pas réintroduire :

- **L'adresse e-mail est vérifiée avant toute session** (2026-10-01) : `POST /api/visitor/account` n'ouvre plus de session, il envoie un lien (`sendVisitorCompteCree`) et le jeton n'est **jamais renvoyé au navigateur**. Avant, le compte était créé avec l'e-mail pré-confirmé et connecté aussitôt : n'importe qui pouvait saisir l'adresse d'un tiers, puis recevoir l'adresse d'une maison à cet e-mail. Ne jamais remettre un `token_hash` dans la réponse (seule exception : `POST /api/inscriptions`, adresse déjà prouvée — voir § Formulaire d'inscription). Un seul `generateLink` est actif (en générer un second invaliderait le premier, un seul OTP magiclink par utilisateur). `redirect` passe par `lib/auth/safe-redirect.ts`.
- **Plafond de demandes** : au plus `event_timing_config.max_requests_per_visitor_per_event` (3 par défaut, réglable dans `/admin/settings/timing`, minimum 1) demandes `pending`/`accepted` par visiteur et par live, sinon 429 (`lib/visitor/request-limit.ts`). Une demande refusée ou restée sans réponse libère sa place. Migration : `scripts/migration-max-requests.sql`. Sans elle, la limite retombe sur la valeur par défaut (3) mais n'est pas modifiable.
- **`photo_signed_url` est toujours signée côté serveur** (`GET /api/visitor/profile`, `createServiceClient()`) — jamais via le SDK anon côté client, dont l'état RLS/session pouvait silencieusement empêcher l'affichage de la photo sans erreur visible (bug corrigé août 2026).
- `POST /api/visit-requests` exige une session visiteur authentifiée (401 sinon) — l'ancienne création silencieuse de profil permettait d'écraser le profil d'un visiteur existant (faille trouvée par Codex, cf `/plan-eng-review`).

## Distance visiteur ↔ ambassadeur

Géolocalisation navigateur éphémère (jamais persistée) + Haversine arrondi au km côté serveur (`POST /api/distance`, rate-limité 8 req/min/IP) — mitigation anti-oracle de triangulation. Détail complet : ARCHITECTURE.md § Distance visiteur ↔ ambassadeur.

## Feedback bidirectionnel post-live

Visiteur → hôte (`/feedback/[token]`) et hôte → visiteur (`/feedback/host/[token]`, token = `host_activations.id` réutilisé). Côté hôte, cocher "Bloquer ce visiteur" insère dans `blacklist` avec `host_profile_id` renseigné (blocage scopé à cet hôte, pas global — voir § Modération anti-abus visiteur).

## Modération anti-abus visiteur

Deux mécanismes orthogonaux : **suspendre une ambassade** (`host_profiles.status = 'suspended'`, cible l'hôte, disparaît de la carte) vs **blacklist** (`INSERT blacklist`, cible le visiteur, `host_profile_id NULL` = global créé depuis `/admin/blacklist`, renseigné = scopé à un hôte créé depuis `/feedback/host/[token]`).

**Choix éthique — pas de shadow-ban.** Un visiteur blacklisté qui envoie une demande reçoit un **403** avec un message neutre : *« Votre demande ne peut pas être prise en compte. Si vous pensez qu'il s'agit d'une erreur, contactez l'équipe. »* Pas de faux 201 silencieux. Le pattern shadow-ban (Twitter/Reddit) est efficace contre l'énumération mais incompatible avec une éthique pastorale : David ne ment pas à ses utilisateurs, même problématiques.

**Deux façons de refuser une demande de visite** (2026-10-01, composant `components/DeclineChoice.tsx`, utilisé dans `/dashboard`, `/accueillir/[token]` et `/refuser/[token]`) : **« Pas disponible cette fois »** (`status = 'declined'`, la personne peut redemander pour un autre live) et **« Ne plus accueillir cette personne »** (`declined_permanently = TRUE`, avec une confirmation car irréversible). Seul le second bloque : `lib/visitor/declined-by-host.ts`, appelé par `POST /api/visit-requests`, répond 403 avec un message honnête qui renvoie vers d'autres ambassades, pour aucun live de cette ambassade. Les autres ambassades restent ouvertes — c'est ce qui le distingue de la blacklist globale. Les deux routes `decline` n'acceptent `permanent` que s'il vaut exactement `true` (sans corps de requête : refus simple, jamais définitif par défaut). Les libellés sont volontairement en français simple (public peu à l'aise avec le numérique) : ne pas les durcir. Le refus définitif n'a pas de recours dans l'app. Migration : `scripts/migration-declined-permanently.sql` (idempotente) ; sans elle, refuser une demande échoue (colonne absente).

Voir [app/api/visit-requests/route.ts](app/api/visit-requests/route.ts) et [app/api/visitor-help-request/route.ts](app/api/visitor-help-request/route.ts).

**Deux jetons par demande, jamais confondus** (2026-10-01) : `contact_requests.action_token` appartient à l'**hôte** (liens `/accueillir`, `/refuser`, dashboard) ; `visitor_token` appartient au **visiteur** (`/visitor/[token]`, `/feedback/[token]`, `/contact-equipe?token=`). `POST /api/visit-requests/[token]/accept` n'a pas d'authentification : qui détient `action_token` peut accepter la demande et déclencher l'envoi de l'adresse privée. Avant, le visiteur recevait `action_token` (réponse 201, e-mail de feedback) et pouvait donc accepter sa propre demande. **Ne jamais renvoyer `action_token` dans une réponse ni un e-mail destiné au visiteur** — `tests/unit/visitor-token-separation.test.ts` le vérifie. Migration : `scripts/migration-visitor-token.sql` (idempotente) ; sans elle, créer une demande échoue (colonne absente). La route `/api/contact-requests/[token]/acknowledge` (code mort qui renvoyait l'adresse à tout porteur du jeton, même demande `pending`) a été supprimée.

## Transparence des données visiteur (RGPD)

Page `/confidentialite` + légendes inline, ajoutées le 2026-08-07 (TODO-23). Détail complet : ARCHITECTURE.md § Transparence des données. Deux règles à ne pas défaire :

- **Tout champ collecté dit sa finalité à côté du champ** (`text-xs text-slate-400 mt-2` sous l'input). Modèle : la légende de la photo (finalité + destinataire + non-publication). Un audit a trouvé que la photo — facultative — était bien expliquée alors que le **téléphone, seul champ obligatoire**, n'avait aucune légende.
- **`visitor_notifications_optin` est initialisé à `false`**, dans `ContactForm.tsx` *et* `VisitRequestForm.tsx`. Ce n'est pas un arbitrage produit : une case pré-cochée ne vaut pas consentement (CJUE, 1er oct. 2019 — le RGPD exige un acte positif clair). Ne jamais repasser à `true` pour gonfler le volume d'inscrits.

- **Le téléphone du visiteur n'est visible par l'hôte qu'après acceptation** (2026-10-01) : absent de l'e-mail `contact-received-host`, affiché dans `/dashboard` seulement si `status === 'accepted'`. Il reste obligatoire pour deux usages réels, dits dans la légende et sur `/confidentialite` : joindre le visiteur le jour du live, et faire respecter la blacklist (e-mail *ou* téléphone). Ne pas le remettre dans l'e-mail de notification. Limite connue : masquage côté affichage uniquement, la clé anon du dashboard le reçoit encore (voir ARCHITECTURE.md § Transparence des données).

`app/confidentialite/page.tsx` porte **3 placeholders `[À COMPLÉTER]`** (entité juridique, adresse du siège, e-mail de contact) laissés volontairement visibles — une valeur plausible mais inventée passerait la relecture sans être corrigée. Ils bloquent la publication publique, pas le développement.

Les durées de conservation annoncées sur la page **ne sont appliquées par aucune purge automatique** — écart à combler avant un lancement public.

## Règles importantes

- `lib/supabase/server.ts` (service_role) : JAMAIS importé depuis un Client Component
- `lib/supabase/browser.ts` (anon key) : uniquement dans les Client Components
- Port 6543 obligatoire pour les connexions Supabase server-side (pooler)
- Feature flags dans `config/features.ts`
- `AdminLayout` contient un bouton "Se déconnecter" en bas de la sidebar (`supabase.auth.signOut()` + `router.replace('/auth')`)
- `profile_photo_url` et `room_photo_urls` stockent un **chemin** Supabase Storage (ex : `ambassador-photos/uuid/photo.jpg`), pas une URL publique. Bucket privé. Toujours lire via `lib/storage/photo-url.ts` : `getOwnerPhotoUrl(path)` (ambassadeur), `getAdminPhotoUrl(path)` (admin), ou `getPublicMapPhotoUrls(paths)` (carte publique, hôtes actifs uniquement, cache en mémoire ~1h). Ne jamais exposer l'adresse ni les photos du lieu sur la carte publique. **La photo de profil est publique** une fois l'ambassade active (avatar carte) : les textes d'interface et `/confidentialite` doivent le dire, jamais « privée » ou « vue uniquement par David ».
- `lat_precise`/`lng_precise` (`host_profiles`) ne sont **jamais** exposés dans une réponse API publique (`/api/host-activations` ne les sélectionne pas). Utilisés uniquement par `POST /api/distance` pour le calcul de proximité (arrondi au km, jamais de coordonnées en retour).
- `proxy.ts` rate-limite `/api/auth/magic-link` (3 req/min/IP) et `/api/distance` (8 req/min/IP) — la première génère un lien de connexion admin pour n'importe quel email, la seconde pourrait servir d'oracle de triangulation sans le rate-limit + l'arrondi au km.
- **`host_profiles` : aucune lecture publique, aucune écriture directe par le propriétaire** (`scripts/migration-rls-hardening.sql`, 2026-10-01). Avant : la politique `host_profiles_public_read` donnait à tout porteur de la clé publique la ligne entière des profils validés (téléphone, adresse privée, coordonnées précises, réponses du questionnaire) et `host_profiles_owner_full` laissait un candidat réécrire son propre `status`. Maintenant : le propriétaire lit sa ligne (`host_profiles_owner_read`), l'admin tout, et **toute écriture passe par une route serveur** (clé service) ; la vue `host_profiles_public` n'existe plus. Ne jamais recréer une politique `FOR ALL` pour le propriétaire ni une lecture publique de la table. Contrôle : `node scripts/probe-access.js` (lecture seule, code 1 si un accès est ouvert).
- **Liens de connexion** (`lib/auth/confirm-url.ts`, 2026-10-01) : toujours construire le lien `/auth/confirm` avec `buildConfirmUrl(data.properties)`, jamais `type=magiclink` en dur. `generateLink({type:'magiclink'})` **crée le compte** si l'adresse est inconnue et émet un jeton de type `signup` que `verifyOtp({type:'magiclink'})` refuse (« Ce lien ne fonctionne plus »). `/api/auth/magic-link` ne connecte donc que des comptes existants (404 `no_account` sinon, jamais d'e-mail) — c'est ce qui évite les comptes auth sans profil. Un compte connecté **sans** `host_profiles` ni `visitor_profiles` est un état normal à gérer (`.maybeSingle()`, jamais `.single()` ; `MonEspaceLink` → rôle `none`, `/auth` l'explique), car les profils peuvent être supprimés (reset/seed) alors que le compte auth reste.
- **Routes `next/og` ImageResponse (ex : `/ambassade/[id]/badge`)** : règles strictes pour éviter `ERR_EMPTY_RESPONSE` :
  1. **Satori multi-child** : tout `<div>` avec plus d'un node enfant doit avoir un `display: flex | contents | none` explicite, OU fusionner les enfants en template string (`<div>{a}, {b}</div>` crashe ; `<div>{`${a}, ${b}`}</div>` OK). **Cause #1 des crashs.**
  2. **Pas de `@supabase/supabase-js`** dans le route handler (side-effects au load non supportés par le contexte satori) — utiliser `fetch()` direct vers `${SUPABASE_URL}/rest/v1/...`. Pas de `export const runtime = 'edge'` (Node runtime par défaut OK, edge aggrave les crashs).
  3. **Cache-Control header** : toujours `'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600'` sur l'ImageResponse.
  4. **Si crash mystérieux après edits successifs en dev** : `rm -rf .next/dev` + restart `npm run dev` (cache Turbopack peut cacher du code corrompu, voir docs/knowledge-transfer.md).

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## Design System

Lire DESIGN.md avant toute décision visuelle ou UI.
Couleurs, fonts, spacing, règles responsive — tout est défini là.
Ne pas dévier sans accord explicite.
En mode QA, signaler tout code qui ne suit pas DESIGN.md.
