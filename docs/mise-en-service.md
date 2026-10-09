# Mise en service sur les comptes de David (lancement propre)

> Tout se fait **dans le navigateur** : Resend, Supabase (SQL Editor), Vercel (tableau de bord). Aucune ligne de commande.
> Domaine : **guerison.live**. Adresse du site : `https://guerison.live`. Domaine d'envoi des e-mails : `guerison.live` (le même).
> Rédigé le 2026-10-09. Coûts : [`estimation-couts.md`](./estimation-couts.md).

Ordre : **1. Resend → 2. Supabase → 3. Vercel (projet + variables) → 4. Domaine → 5. Contrôles.**
Gardez un fichier texte ouvert pour noter chaque valeur au fur et à mesure : elles servent toutes à l'étape 3.

---

## 1. Resend (e-mails) — https://resend.com

Compte au nom de David.

1. **Domains → Add Domain** : nom `guerison.live`, région **Europe**.
2. Resend affiche des enregistrements DNS (SPF, DKIM, MX). Les créer là où `guerison.live` est géré (le registrar ou son DNS). Ajouter aussi, pour limiter les spams : TXT `_dmarc.guerison.live` = `v=DMARC1; p=none`. Cliquer **Verify** (de quelques minutes à quelques heures).
3. **API Keys → Create API Key** : permission *Sending access*, domaine `guerison.live`. **Copier la clé tout de suite** (`re_…`, affichée une seule fois).
4. **Settings → Billing** : plan **Pro** avant l'ouverture (le gratuit s'arrête à 100 e-mails par jour).

Notez :
- `RESEND_API_KEY` = la clé `re_…`
- `RESEND_FROM_EMAIL` = `Ambassades de Guérison <ne-pas-repondre@guerison.live>`
- `RESEND_ADMIN_EMAIL` = l'adresse de David (reçoit les alertes admin)
- `RESEND_REPLY_TO` = `david@davidthery.com` (facultative : quand un candidat ou un visiteur répond à un e-mail, la réponse arrive à cette adresse)

---

## 2. Supabase — https://supabase.com/dashboard

Organisation au nom de David (plan Pro). Inviter Théophile : *Organization → Team*.

### 2.1 Créer le projet
*New project* : nom `ambassades-guerison`, région **Europe (Paris)**, mot de passe de base généré (à ranger dans le gestionnaire de mots de passe de David). Laisser **« Automatically expose new tables » décoché**.

### 2.2 Créer le schéma (copier-coller)
1. Dans le dépôt GitHub, ouvrir [`scripts/reset-db.sql`](../scripts/reset-db.sql) → bouton **Raw** → tout sélectionner → copier.
2. Supabase → **SQL Editor → New query** → coller → **Run**. Message de succès attendu, sans erreur en rouge.

Ce fichier contient déjà **toutes** les migrations : ne pas en lancer d'autre. Il crée les 15 tables, les règles de sécurité, les 3 buckets privés de fichiers et les droits d'accès à l'API.

Vérifier : **Table Editor** → 15 tables ; **Storage** → `ambassador-photos`, `visitor-photos`, `ambassador-videos`, aucun marqué *Public*.

> ⚠️ Ce fichier **efface tout**. À ne plus jamais relancer une fois de vrais profils en base.

### 2.3 Créer le compte admin de David
1. **Authentication → Users → Add user → Create new user** : e-mail de David, un mot de passe aléatoire (jamais utilisé : la connexion se fait par lien), **Auto Confirm User coché**.
2. **SQL Editor → New query** : coller le contenu de [`scripts/create-admin.sql`](../scripts/create-admin.sql) après avoir remplacé `ADRESSE_DE_DAVID@exemple.fr` (2 fois) → **Run**. Le résultat doit afficher la ligne `david… | super_admin`.

Ne **pas** lancer `seed.js` : il crée de faux ambassadeurs et des comptes de démonstration. Camille ou d'autres membres s'ajouteront ensuite depuis `/admin/team`.

### 2.4 Récupérer les clés
- **Project Settings → Data API** : *Project URL* → `NEXT_PUBLIC_SUPABASE_URL` (`https://<ref>.supabase.co`).
- **Project Settings → API Keys** :
  - clé **Publishable** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY` ;
  - clé **Secret** (`sb_secret_…`, bouton *Reveal*) → `SUPABASE_SERVICE_ROLE_KEY`. **Elle contourne toute la sécurité : jamais dans un message, un e-mail ou git.**
  - Si l'onglet *Legacy API keys* existe encore, `anon` / `service_role` (`eyJ…`) marchent aussi. Les anciennes clés disparaissent d'ici fin 2026 ([annonce](https://supabase.com/changelog/29260-upcoming-changes-to-supabase-api-keys)).

### 2.5 Adresse du site
**Authentication → URL Configuration** : *Site URL* = `https://guerison.live`. (Les liens de connexion sont envoyés par l'application via Resend ; rien d'autre à régler côté e-mail Supabase.)

### 2.6 Sauvegardes et plafond
Plan Pro : sauvegarde quotidienne, 7 jours, rien à activer. Régler le plafond de dépenses dans *Organization → Billing*.

---

## 3. Vercel — https://vercel.com

Compte (ou équipe) au nom de David, plan Pro.

### 3.1 Créer le projet
**Add New… → Project → Import Git Repository** : choisir le dépôt de David (si absent : *Adjust GitHub App Permissions* pour autoriser Vercel sur ce dépôt). Nom du projet : `ambassades-guerison`. Framework : *Next.js* (détecté). **Ne rien changer au build.** *Production Branch* : `main` (*Settings → Git*).

> Ne cliquez pas sur *Deploy* avant d'avoir saisi les variables (sinon le premier build échoue : `@supabase/ssr: URL and API key are required`). Les variables se saisissent dans l'écran d'import (*Environment Variables*) ou après, dans *Settings → Environment Variables*.

### 3.2 Les variables : une par une

Cocher **Production + Preview** partout, sauf mention. Cocher **Sensitive** pour les secrets (🔒).

#### Obligatoires

| Variable | Valeur | Où l'obtenir |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase → Project Settings → **Data API** → *Project URL* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` | Supabase → Project Settings → **API Keys** → *Publishable key* |
| `SUPABASE_SERVICE_ROLE_KEY` 🔒 | `sb_secret_…` | Supabase → Project Settings → **API Keys** → *Secret keys* → *Reveal* |
| `RESEND_API_KEY` 🔒 | `re_…` | Resend → **API Keys** → *Create API Key* (étape 1.3) |
| `RESEND_FROM_EMAIL` | `Ambassades de Guérison <ne-pas-repondre@guerison.live>` | À composer : l'adresse doit être sur le domaine vérifié (Resend → Domains) |
| `RESEND_ADMIN_EMAIL` | adresse de David | À choisir : destinataire des alertes admin |
| `RESEND_REPLY_TO` | `david@davidthery.com` | Facultative mais conseillée : adresse qui reçoit les réponses aux e-mails de l'application (sans elle, une réponse à `ne-pas-repondre@` se perd) |
| `NEXT_PUBLIC_APP_URL` | `https://guerison.live` | À composer : adresse du site, `https://`, **sans « / » final** |
| `EMAIL_PROOF_SECRET` 🔒 | 64 caractères aléatoires | À générer (voir ci-dessous) |
| `CRON_SECRET` 🔒 | 64 caractères aléatoires, **différents** du précédent | À générer |

**Générer un secret sans ligne de commande** : ouvrir un onglet de navigateur, touche F12 → onglet *Console*, coller puis Entrée :
```js
Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
```
Copier le résultat (sans guillemets). Recommencer pour le second secret. Les noter : un secret perdu ne se retrouve pas, il se remplace.

#### Recommandées (valeurs par défaut sinon)

| Variable | Valeur | Rôle |
|---|---|---|
| `NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS` | `4` | Fenêtre « live en cours » sur la carte |
| `LIVE_WINDOW_PAST_HOURS` | `6` | Fenêtre du suivi admin après le début du live |
| `LIVE_WINDOW_FUTURE_HOURS` | `4` | Fenêtre du suivi admin avant le live |
| `NEXT_PUBLIC_ADMIN_TZ_OFFSET` | `+04:00` | Fuseau du planning admin (La Réunion) |
| `MAP_CACHE_SECONDS` | `30` | **Cache de la carte publique** : réduit fortement les lectures de la base et le trafic Supabase en affluence. Absente ou `0` = aucun cache. Pas de redéploiement de code, mais redéployer pour que Vercel relise la variable. |

#### Facultatives

| Variable | Rôle / où l'obtenir |
|---|---|
| `NEXT_PUBLIC_YOUTUBE_CHANNEL_URL` | Lien du bandeau « live en cours ». Défaut : `https://www.youtube.com/@DavidThery` — copier l'adresse de la chaîne depuis YouTube si elle diffère. |
| `PCLOUD_ACCESS_TOKEN` 🔒 + `PCLOUD_API_HOST` | Stockage des vidéos de présentation sur pCloud. **Sans elles, les vidéos vont dans Supabase** (rien ne casse). Demande une application pCloud et une commande locale (`node scripts/pcloud-token.js`) : procédure dans [`knowledge-transfer.md`](./knowledge-transfer.md) § Vidéos — **à faire plus tard**, pas pour le lancement. |
| `NEXT_PUBLIC_FEATURE_EMAIL_NOTIFICATIONS`, `_PHOTOS`, `_RATINGS`, `_ONBOARDING_VIDEOS` | Drapeaux. Laisser absents (voir `config/features.ts`). |

#### Lancement propre : à NE PAS créer
`NEXT_PUBLIC_DEV_OVERLAY` et `DEV_OVERLAY_SECRET` (panneau de simulation d'états), `EMAIL_PREVIEW` (absent = `/dev/emails` en 404, ce qu'on veut en production). Jamais sur Vercel : `USE_MAILHOG`, `MAILHOG_*`, `PCLOUD_CLIENT_ID`, `PCLOUD_CLIENT_SECRET`, `NODE_ENV`.

> Les variables sont lues **au build** : après toute modification, **Deployments → ⋯ → Redeploy**. Cela vaut surtout pour `NEXT_PUBLIC_*`.
>
> Les workflows GitHub Actions du dépôt sont tous désactivés (planification commentée) : ils n'ont pas besoin de secrets GitHub. Les tâches planifiées (`/api/cron/*`) ne tournent pas non plus (`vercel.json` : `crons: []`) — à activer plus tard, `CRON_SECRET` est déjà prêt.

### 3.3 Déployer
Cliquer **Deploy**. Attendre « Ready ».

---

## 4. Domaine `guerison.live`

Vercel → projet → **Settings → Domains → Add** `guerison.live` (et `www.guerison.live` avec redirection vers le premier). Vercel indique les enregistrements DNS à créer chez le gestionnaire du domaine (en général un `A` pour le domaine nu, un `CNAME` pour `www`). Attendre que les deux affichent *Valid Configuration* ; le certificat HTTPS est automatique.

Si `NEXT_PUBLIC_APP_URL` a été saisie autrement : la corriger puis **Redeploy**.

---

## 5. Contrôles (dans le navigateur)

- [ ] `https://guerison.live` affiche la carte, sans le bandeau « Carte momentanément indisponible ».
- [ ] `https://guerison.live/api/host-activations` affiche du JSON (pas `db_unreachable`).
- [ ] `https://guerison.live/dev/emails` affiche **404**.
- [ ] `/auth` : saisir l'adresse admin de David → l'e-mail arrive (vérifier les indésirables) → le lien ouvre `/admin/stats`. Si rien n'arrive : domaine non vérifié chez Resend (étape 1), ou *Resend → Logs* donne la raison.
- [ ] `/inscription` avec une adresse de test : e-mail de confirmation reçu, formulaire, puis dans le tableau de bord, envoyer une photo dans le questionnaire. Cela valide les droits d'accès et les buckets.
- [ ] Vercel → **Logs** : aucune erreur `permission denied`.
- [ ] Supprimer les comptes de test : Supabase → Authentication → Users.

## 6. Ensuite
- Remplacer les identifiants de l'ancien compte dans [`../DEPLOIEMENT.md`](../DEPLOIEMENT.md) et [`../CLAUDE.md`](../CLAUDE.md) (nom d'équipe Vercel, Project ID, URL).
- Supprimer les anciens projets Vercel et Supabase de Théophile et révoquer l'ancienne clé Resend.
