# Transfert de connaissance — DavidTheryApp

> Ce document permet à un développeur (ou à David) de comprendre, opérer et maintenir
> l'application sans avoir participé à sa conception.

---

## Vue d'ensemble technique

| Couche | Technologie | Rôle |
|--------|------------|------|
| Frontend | Next.js 15 (App Router, TypeScript) | Interface web + API routes |
| Base de données | Supabase (PostgreSQL) | Données, auth, RLS |
| Authentification | Supabase Auth (magic links) | Connexion sans mot de passe |
| Emails | Resend | Notifications, magic links, confirmations |
| Carte | Leaflet.js + OpenStreetMap | Carte des ambassades |
| Déploiement | Vercel | Hébergement, CI/CD automatique |
| Mobile | PWA (manifest + service worker) | Cache carte hors ligne |

---

## Structure des données (15 tables)

```
events               → Les lives (titre, date, lien YouTube, lien StreamYard)
host_profiles        → Les hôtes ambassadeurs (profil permanent)
host_activations     → Qui est actif pour quel live (créé par trigger automatique)
contact_requests     → Demandes de visiteurs vers un hôte (visitor_phone NOT NULL)
visitor_profiles     → Profil visiteur réutilisable (prénom, email, téléphone, photo optionnelle) — créé explicitement via /mon-espace/creer, login par magic link
live_signals         → Signaux "moment fort" pendant le live
testimonials         → Témoignages post-live (hôtes + soumissions publiques anonymes)
live_feedbacks       → Feedbacks structurés post-live, bidirectionnel (host_to_visitor + visitor_to_host), non publics
admin_users          → Table des comptes admin (role = 'admin' dans user_metadata Supabase)
blacklist            → Blocage visiteur — global (host_profile_id NULL) ou scopé à un hôte
scheduled_campaigns  → Campagnes email programmées (ambassadeurs ou visiteurs)
campaign_recipients  → Destinataires snapshottés au moment de la création de la campagne
moderation_log       → Journal des actions de modération admin
onboarding_config    → Singleton — URL vidéo onboarding + chemin PDF charte (id = 1)
event_timing_config  → Singleton — délais campagnes/feedback/rappels (id = 1)
```

Les données des hôtes et visiteurs sont protégées par **RLS (Row Level Security)** :
un hôte ne peut jamais voir les données d'un autre hôte.

---

## Setup local (première installation)

### Prérequis
- Node.js 20+
- Compte Supabase (gratuit)
- Compte Resend (gratuit)
- Compte Vercel (gratuit)

### 1. Cloner et installer

```bash
git clone <repo-url>
cd ambassades-guerison
npm install
```

### 2. Variables d'environnement

Copier `.env.local.example` vers `.env.local` et remplir :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # clé publique (safe côté client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # clé privée (JAMAIS exposée côté client)

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@votredomaine.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Important :** `SUPABASE_SERVICE_ROLE_KEY` bypass la sécurité RLS.
> Elle ne doit jamais apparaître dans le code frontend ni dans les logs.

### 3. Appliquer les migrations Supabase

```bash
# Installer Supabase CLI
npm install -g supabase

# Lancer Supabase en local (nécessite Docker)
supabase start

# Appliquer les migrations
supabase db push
```

### 4. Lancer en développement

```bash
npm run dev
# → http://localhost:3000
```

---

## Feature flags

Les fonctionnalités peuvent être activées/désactivées sans toucher au code.

Fichier : `config/features.ts`

| Flag | Valeur par défaut | Description |
|------|------------------|-------------|
| `EMAIL_NOTIFICATIONS` | `true` | Emails Resend (magic link, signal approuvé, etc.) |
| `PHOTOS` | `false` | Photos dans les témoignages (v2) |
| `RATINGS` | `false` | Notation des ambassades (v2) |
| `ONBOARDING_VIDEOS` | `false` | Vidéos onboarding intégrées (v2 — fallback texte en v1) |

Pour activer une feature en production, changer la valeur dans Vercel Environment Variables
(sans redéployer manuellement — Vercel relit les env vars au prochain déploiement).

---

## Déploiement

### Déploiement automatique

Chaque push sur `main` déclenche un déploiement automatique sur Vercel.

```
git push origin main
→ Vercel build automatique
→ Disponible sur https://ambassades-guerison.vercel.app
```

### Déploiement manuel (si besoin)

Voir `DEPLOIEMENT.md` (racine) pour les commandes complètes, les variables d'environnement et les pièges connus du CLI Vercel v53.

```bash
# Déployer le HEAD courant en production
git archive --format=tgz HEAD | vercel deploy --archive=tgz --yes --scope yoan-theophiles-projects --prod
```

### Variables d'environnement en production

À configurer dans Vercel Dashboard → Settings → Environment Variables.
Les mêmes variables que `.env.local` mais avec les valeurs de production.

---

## Supabase — Opérations courantes

### Accéder à la base de données

```
Supabase Dashboard → https://supabase.com/dashboard
→ Ton projet → Table Editor (interface visuelle)
→ ou SQL Editor (requêtes directes)
```

### Créer un événement (live)

Via l'interface admin de l'application, ou directement en SQL :

```sql
INSERT INTO events (title, event_date, youtube_url, live_link)
VALUES (
  'Live Guérison — Novembre 2026',
  '2026-11-15 19:00:00+01',
  'https://youtube.com/watch?v=XXXXX',
  'https://streamyard.com/XXXXX'
);
```

Le **trigger automatique** crée une entrée `host_activations` pour chaque hôte actif.

### Vérifier les hôtes actifs pour un live

```sql
SELECT hp.first_name, hp.city, hp.country, ha.is_active, ha.capacity
FROM host_activations ha
JOIN host_profiles hp ON hp.id = ha.host_profile_id
JOIN events e ON e.id = ha.event_id
WHERE e.title LIKE '%Novembre 2026%'
ORDER BY hp.country, hp.city;
```

### Suspendre un hôte

```sql
UPDATE host_profiles SET status = 'suspended' WHERE email = 'hote@example.com';
```

### Voir les signaux d'un live

```sql
SELECT ls.*, hp.first_name, hp.city
FROM live_signals ls
JOIN host_activations ha ON ha.id = ls.host_activation_id
JOIN host_profiles hp ON hp.id = ha.host_profile_id
JOIN events e ON e.id = ha.event_id
WHERE e.title LIKE '%Novembre 2026%'
ORDER BY ls.created_at DESC;
```

---

## Emails — Resend

### Templates disponibles

20 templates TSX dans `emails/*.tsx` (React Email v6). Preview visuelle sur `/dev/emails` (local ou Vercel Preview avec `EMAIL_PREVIEW=true`).

> Le template `pre-validation-accordee.tsx` a été supprimé en mai 2026 quand la transition `pending_review → pre_approved` est passée en self-service (le candidat clique "J'accepte" sur son dashboard, le questionnaire s'affiche immédiatement sans email intermédiaire).

| Template | Déclenché quand |
|----------|----------------|
| Magic link | Hôte ou visiteur se connecte |
| Compte visiteur créé | Confirmation après `/mon-espace/creer` (`sendVisitorCompteCree`), en parallèle du bootstrap de session immédiat |
| Bienvenue ambassadeur | Admin valide définitivement → ambassade active |
| Validation finale | Confirmation de l'activation finale |
| Candidature refusée | Admin refuse une candidature (`action: 'rejected'`, n'importe quel statut de départ) → message sobre + raison optionnelle (champ `notes` du payload admin) |
| Confirmation inscription | Nouvel ambassadeur inscrit |
| Campagne ambassadeurs | Cron envoie la campagne → lien activation par live |
| Feedback post-live (visiteur) | Visiteur invité à donner son retour après le live |
| Feedback post-live (hôte) | Ambassadeur invité à noter les visiteurs reçus, via `/feedback/host/[token]` |
| Demande reçue (hôte) | Visiteur soumet une demande → email à l'hôte avec lien /accueillir/[token] (accepter) + lien /refuser/[token] (refuser) |
| Demande refusée | Hôte refuse via /refuser/[token] → visiteur redirigé vers la carte |
| Confirmation visite — adresse dévoilée | Hôte accepte via /accueillir/[token] → adresse complète + e-mail + lien WhatsApp envoyés au visiteur |
| Visite refusée | Refus à l'étape /accueillir → visiteur redirigé |
| Campagne visiteurs | Cron visiteurs → lien carte + lien désinscription |
| Signal approuvé | Admin approuve un signal live → lien live envoyé à l'ambassadeur |
| Nouvelle ambassade activée (admin) | Hôte passe `validated` → notification admin |
| Questionnaire soumis (admin) | Hôte soumet questionnaire enrichissement → notification admin |
| Alerte 0 hôtes actifs (admin) | Aucun hôte actif 48h avant un live |
| Nouvelle candidature (admin) | Ambassadeur s'inscrit → notification admin (action requise : valider) |
| Demande d'aide visiteur (admin) | Visiteur soumet une demande d'aide → notification admin avec le message |
| Modification profil ambassadeur (admin) | Ambassadeur modifie sa ville via `PATCH /api/ambassadeur/profile` → email admin avec ancienne ville → nouvelle ville |

### Voir les emails envoyés

**En production** : Resend Dashboard → Logs → filtrer par email ou date.

**En local, sans dépendre de Resend ni d'adresses e-mail réelles** : Mailhog capture tous les e-mails du flux applicatif réel sur un SMTP local.

```bash
npm run mailhog          # démarre le conteneur Docker (docker-compose.yml)
# .env.local : USE_MAILHOG=true
npm run dev
```

Dashboard Mailhog : http://localhost:8025 — liste tous les e-mails envoyés par l'app (magic link, campagnes, notifications admin…) avec destinataire, sujet, HTML rendu et liens cliquables. `lib/email/send.ts` fait le routage Mailhog/Resend selon `USE_MAILHOG` ; `lib/email/templates.ts` n'a pas connaissance de la destination. Arrêter le conteneur : `npm run mailhog:stop`.

Différence avec `/dev/emails` : `/dev/emails` affiche les templates avec des données mock (`emails/__mocks__/index.ts`) sans jamais passer par `lib/email/templates.ts` — utile pour le design visuel. Mailhog capture les e-mails **réellement déclenchés par un flux applicatif** (ex : cliquer "S'inscrire" sur `/inscription`) — utile pour vérifier bout-en-bout qu'une action envoie le bon e-mail avec le bon contenu.

---

## GitHub Actions (automatisations)

### supabase-keepalive.yml

Supabase met en pause les projets gratuits après 7 jours d'inactivité.
Ce workflow ping la base de données toutes les 5 jours pour éviter la pause.

```
.github/workflows/supabase-keepalive.yml
→ Cron : toutes les 5 jours
→ Action : SELECT 1 sur la base de données
```

### host-activations-check.yml

Vérifie chaque jour qu'un live à venir a bien des hôtes actifs.
Si 0 hôte actif 48h avant un live → email d'alerte à l'admin.

```
.github/workflows/host-activations-check.yml
→ Cron : quotidien à 8h
→ Action : vérifie host_activations pour les events dans les 48h
```

### dispatch-campaigns.yml

Déclenche l'envoi des campagnes email dont la date d'envoi est atteinte.

```
.github/workflows/dispatch-campaigns.yml
→ Cron : toutes les 15 minutes
→ Action : POST /api/cron/dispatch-campaigns (header x-cron-secret)
→ Lit scheduled_campaigns WHERE status='pending' AND scheduled_at <= now
→ Envoie les emails aux campaign_recipients, marque status='sent'
```

### ~~auto-decline.yml~~ — Supprimé

Route `/api/cron/auto-decline` supprimée (David ne l'a pas demandé). Workflow GH Actions conservé dans l'historique git.

### feedback-emails.yml

Envoie les emails de retour d'expérience aux visiteurs après chaque live.

```
.github/workflows/feedback-emails.yml
→ Cron : quotidien (10:00 UTC) — schedulé dans vercel.json
→ Action : POST /api/cron/send-feedback-emails
→ ⚠️ Bug SQL join à corriger avant usage réel (voir ARCHITECTURE.md)
```

### check-activations.yml — Non activé

Alerte l'admin si 0 hôtes actifs pour le prochain live.

```
.github/workflows/check-activations.yml
→ Cron : non schedulé (workflow_dispatch uniquement)
→ Action : POST /api/cron/check-activations
→ À activer dans vercel.json quand prêt (schedule suggéré : 0 9 * * *)
```

---

## Incidents courants

### "Les hôtes n'apparaissent pas sur la carte"

1. Vérifier que l'événement existe et que `event_date` est correct
2. Vérifier que les hôtes ont `status = 'validated'` dans `host_profiles`
3. Vérifier que `host_activations.is_active = TRUE` pour cet événement
4. Vérifier que `lat` et `lng` ne sont pas NULL — depuis la validation API (`POST /api/inscriptions` retourne 400 si lat/lng absents), tout nouveau profil a obligatoirement des coordonnées. Si un profil ancien a `lat = NULL`, l'ambassadeur ne s'affichera jamais sur la carte : corriger via `UPDATE host_profiles SET lat = ..., lng = ... WHERE id = '...'`

### "Un hôte ne reçoit pas ses emails"

1. Vérifier dans Resend Dashboard → Logs que l'email a bien été envoyé
2. Vérifier que `FEATURES.EMAIL_NOTIFICATIONS = true`
3. Vérifier l'adresse email dans `host_profiles.email`
4. Vérifier les spams côté destinataire

### "En local avec Mailhog, un email n'arrive jamais (échec silencieux)"

**Symptôme** : `USE_MAILHOG=true`, le conteneur `davidthery-mailhog` tourne normalement
(`docker ps`, 0% CPU), mais un envoi échoue de façon intermittente avec `Unexpected socket
close` côté nodemailer — sans qu'aucune tentative de connexion n'apparaisse dans
`docker logs davidthery-mailhog`. L'échec peut toucher un seul email d'une paire (ex:
confirmation candidat OK, notification admin en échec) ou les deux. Repro'd sur inscription
ambassadeur (`POST /api/inscriptions`) en août 2026.

**Cause** : `MAILHOG_SMTP_HOST=localhost` dans `.env.local` — la résolution de `localhost`
peut basculer entre IPv4 (`127.0.0.1`) et IPv6 (`::1`) selon l'environnement (observé sous
Docker Desktop/WSL2 sur Windows), et une des deux routes est instable pour le port SMTP
mappé. Le mapping Docker (`docker port davidthery-mailhog`) montre pourtant les deux
adresses écoutées — le problème n'est pas le conteneur, mais la résolution côté client Node.

**Fix** : dans `.env.local`, forcer `MAILHOG_SMTP_HOST=127.0.0.1` (jamais `localhost`) —
puis **redémarrer le serveur dev** (les variables d'environnement ne sont pas rechargées à
chaud par Next.js). `lib/email/send.ts` logge désormais toute erreur d'envoi
(`console.error`) au lieu de l'avaler silencieusement — vérifier les logs serveur en premier
si un email semble manquant.

### "Le feed admin ne se rafraîchit plus"

Le feed utilise du polling (rafraîchissement toutes les 5 secondes).
Si ça semble bloqué, recharger la page. Ce n'est pas du temps réel (pas de WebSocket).

### "Supabase est en pause"

```bash
# Depuis le Supabase Dashboard → ton projet → "Restore project"
# Ou via l'API :
curl -X POST https://api.supabase.com/v1/projects/TON_PROJECT_ID/restore \
  -H "Authorization: Bearer TON_SUPABASE_TOKEN"
```

### "Les routes API retournent 404 en dev (DevOverlay, carte, etc.)"

**Symptôme** : `POST /api/dev/state` et `GET /api/host-activations` retournent une page HTML 404
(la page not-found du projet) au lieu de JSON. Les pages (`/`, `/temoignages`…) fonctionnent
normalement. Se produit après avoir modifié des fichiers source puis redémarré le serveur.

**Cause** : Next.js 16 sort les artefacts Turbopack de dev dans `.next/dev/` (répertoire séparé
de `.next/` utilisé par `next build`). Si des chunks compilés d'une session précédente sont
présents et que leurs sources ont été modifiées depuis, le runtime Turbopack de la nouvelle
session ne peut pas les exécuter → toutes les route handlers retournent 404.

**Fix** :

```bash
# Arrêter le serveur dev, puis :
rm -rf .next/dev
npm run dev
# Turbopack recompile chaque route à la première requête (~5-10 s)
```

Sur Windows PowerShell :

```powershell
Remove-Item -Recurse -Force .next\dev
npm run dev
```

### "Une photo uploadée vers Storage s'affiche cassée (0×0, icône brisée)"

**Symptôme** : `POST /api/upload/*-photo` (ou `POST /api/visitor/account` avec photo) répond 200,
la signed URL générée pointe vers un fichier réel et téléchargeable (200, bon `content-type`), mais
l'`<img>` ne s'affiche jamais — `naturalWidth`/`naturalHeight` restent à `0` même quand `complete`
vaut `true`. Repro'd sur `/mon-espace` (photo visiteur) en août 2026, cf `/qa`.

**Cause** : passer un `Buffer` Node.js brut comme deuxième argument de
`supabase.storage.from(BUCKET).upload(path, buffer, ...)` — le `fetch()` interne du SDK
`@supabase/storage-js` (et le `fetch()` global lui-même, testé en le bypassant) corrompt les octets
non-UTF-8-safe du buffer : chaque byte binaire sans séquence de continuation UTF-8 valide est
silencieusement remplacé par le caractère de remplacement Unicode `U+FFFD` (`EF BF BD` en UTF-8).
Le fichier change de taille (grossit, chaque octet corrompu passant de 1 à 3 octets) et devient
un WebP invalide, alors que `Content-Length`/`content-type` réseau restent cohérents en apparence.
Reproduit avec Next.js 16 (Turbopack) + Node 24 en dev ; confirmé absent en dehors du contexte
requête Next.js (un script Node isolé avec le même SDK et le même buffer fonctionne parfaitement).

**Fix** : envelopper le buffer dans un `Blob` avant de le passer à `.upload()` — force un chemin de
sérialisation binaire-safe :

```ts
.upload(path, new Blob([new Uint8Array(buffer)], { type: 'image/webp' }), { contentType: 'image/webp', upsert: true })
```

Appliqué dans les 3 endroits qui uploadent un buffer compressé vers Storage :
`app/api/upload/ambassador-photo/route.ts`, `app/api/upload/visitor-photo/route.ts`,
`app/api/visitor/account/route.ts`. **Ne jamais réintroduire `.upload(path, buffer, ...)` avec un
`Buffer` nu** — toujours passer par `new Blob([new Uint8Array(buffer)], { type: ... })`.

### "Le trigger host_activations ne s'est pas déclenché"

Le trigger `trg_auto_activate_host_on_validated` crée automatiquement une entrée
`host_activations` (avec `is_active = FALSE` par défaut) pour chaque event à venir
quand un hôte passe au statut `validated`. Si des activations manquent :

```sql
-- Créer manuellement les activations manquantes
INSERT INTO host_activations (host_profile_id, event_id, capacity)
SELECT hp.id, 'ID_DE_LEVENEMENT', hp.capacity_default
FROM host_profiles hp
WHERE hp.status = 'validated'
AND hp.id NOT IN (
  SELECT host_profile_id FROM host_activations WHERE event_id = 'ID_DE_LEVENEMENT'
);
```

---

## Architecture de sécurité (pour les développeurs)

### Règles d'accès (RLS)

| Table | Qui peut lire | Qui peut écrire |
|-------|--------------|----------------|
| `host_profiles` | Vue publique limitée (nom, ville) | L'hôte lui-même + admin |
| `host_activations` | Public (is_active, capacity) | L'hôte lui-même + admin |
| `contact_requests` | L'hôte concerné + le visiteur concerné | Visiteur (créer) + hôte (accepter/refuser) |
| `visitor_profiles` | Le visiteur lui-même | Le visiteur lui-même (policy `visitor_profiles_owner_full`) |
| `live_signals` | Admin + l'hôte qui a créé le signal | L'hôte lui-même |
| `events` | Public | Admin uniquement |

**Storage bucket `ambassador-photos`** : bucket Supabase **privé** (public = false). Les colonnes `profile_photo_url` / `room_photo_urls` de `host_profiles` contiennent un chemin Storage, pas une URL. Accès via signed URL (`lib/storage/photo-url.ts`). L'admin lit via `getAdminPhotoUrl()` (service_role, 1h), l'ambassadeur via `getOwnerPhotoUrl()` (anon, 15 min). Aucun composant public ne lit ces chemins.

### Ne jamais faire

- Exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
- Bypasser RLS dans une route API publique
- Stocker `action_token` (liens accept/decline) en clair dans les logs
- Exposer `room_photo_urls` (photos du lieu) dans une réponse API publique ou sur la carte — la photo de profil est la seule exception assumée (avatar carte, hôtes actifs, via `getPublicMapPhotoUrls`)

---

## Coûts et limites (Supabase gratuit)

| Ressource | Limite gratuite | Usage attendu |
|-----------|----------------|---------------|
| Base de données | 500 MB | Très largement suffisant |
| Connexions DB | 60 simultanées | Port 6543 (pooler) obligatoire |
| Auth | 50 000 MAU | Suffisant pour v1 |
| Storage | 1 GB | Non utilisé en v1 (FEATURES.PHOTOS=false) |
| Pause inactivité | 7 jours | Géré par le keepalive GitHub Actions |

Quand l'application dépasse 100 hôtes actifs réguliers → envisager Supabase Pro (€25/mois).

---

## Contacts

| Rôle | Contact |
|------|---------|
| Développeur principal | theo.nelson.ia@gmail.com |
| David Thery | À compléter |
