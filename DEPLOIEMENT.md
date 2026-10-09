# Déploiement Vercel — Ambassades de Guérison

> **Changement de comptes (octobre 2026).** L'application passe des comptes de Théophile à ceux de David (Vercel Pro, Supabase Pro, Resend). La marche à suivre complète — Resend, Supabase, variables, premier déploiement, contrôles — est dans [`docs/mise-en-service.md`](docs/mise-en-service.md). Les identifiants ci-dessous sont ceux de l'**ancien** compte ; les remplacer (scope, Project ID, Team ID, URL, dépôt) une fois le nouveau projet créé.

## Identifiants du projet

| Clé | Valeur |
|-----|--------|
| Projet | `ambassades-guerison` (renommé depuis `davidthery-app` le 2026-05-05) |
| Scope / org | `yoan-theophiles-projects` |
| Project ID | `prj_gIbYS0DNecmCMG741VvEaTrKFyXj` |
| Team ID | `team_jakT7s3dTPZG0fiZm2K4bQ8M` |
| URL production | https://ambassades-guerison.vercel.app |
| Dashboard | https://vercel.com/yoan-theophiles-projects/ambassades-guerison |
| GitHub repo | `yoan-theophile/AmbassadesDeGuerison` |

`.vercel/project.json` (ignoré par git) contient `projectId` et `orgId` — ne pas supprimer.

---

## Déployer

### Commande principale — depuis un SHA git précis

```bash
git archive --format=tgz <SHA> | vercel deploy --archive=tgz --yes --scope yoan-theophiles-projects --prod
```

- Remplacer `<SHA>` par n'importe quel commit ou `HEAD`.
- **Retirer `--prod`** pour un déploiement preview (URL unique, sans aliasing).
- Cette approche ignore totalement les fichiers locaux non committés — c'est intentionnel.

### Exemples

```bash
# Déployer le dernier commit de develop
git archive --format=tgz HEAD | vercel deploy --archive=tgz --yes --scope yoan-theophiles-projects --prod

# Déployer un commit précis
git archive --format=tgz 5109a973c84f997b6c03bded791e6022744ebd67 | vercel deploy --archive=tgz --yes --scope yoan-theophiles-projects --prod

# Preview deploy (sans --prod)
git archive --format=tgz HEAD | vercel deploy --archive=tgz --yes --scope yoan-theophiles-projects
```

---

## Variables d'environnement

### Portées configurées

Toutes les variables sont présentes sur **Production** et **Preview**.  
Seule différence :

| Variable | Production | Preview |
|----------|-----------|---------|
| `EMAIL_PREVIEW` | `false` — `/dev/emails` → 404 | `true` — route active |

### Ajouter/modifier une variable en Production

```bash
printf '%s' "valeur" | vercel env add NOM_VARIABLE production --yes
```

**Ne pas utiliser `--value`** ni `echo` (ajoute un saut de ligne). Le pipe `printf '%s'` est la méthode fiable.

### Ajouter/modifier une variable en Preview

Le CLI Vercel v53 bloque le scope `preview` sans branche git explicite, même avec `--yes`.  
Utiliser l'API REST directement :

```bash
TOKEN=$(node -e "console.log(require(process.env.APPDATA+'/com.vercel.cli/Data/auth.json').token)")
PROJECT_ID="prj_gIbYS0DNecmCMG741VvEaTrKFyXj"
TEAM_ID="team_jakT7s3dTPZG0fiZm2K4bQ8M"

curl -s -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/env?teamId=$TEAM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"NOM_VARIABLE","value":"valeur","type":"encrypted","target":["preview"]}'
```

Le token est stocké dans `%APPDATA%\com.vercel.cli\Data\auth.json` sur Windows.

### Lister les variables configurées

```bash
vercel env ls
```

---

## Pièges connus (CLI Vercel v53)

| Symptôme | Cause | Fix |
|----------|-------|-----|
| `"reason":"missing_scope"` | Scope manquant en mode non-interactif | Ajouter `--scope yoan-theophiles-projects` |
| `"Project names… must be lowercase"` | Nom de projet auto-détecté depuis le dossier (`DavidTheryApp`) | Ajouter `--name ambassades-guerison` (flag déprécié mais fonctionnel) |
| `"reason":"git_branch_required"` sur scope `preview` | CLI v53 exige une branche git pour les vars preview | Utiliser l'API REST (voir ci-dessus) |
| Output `}` sur `tail -1` | CLI v53 retourne du JSON d'erreur sur stderr, `tail -1` coupe à `}` | Ne pas filtrer avec `tail` — lire la sortie complète |
| `declare -A` silencieux | Le shell utilisé par Claude Code ne supporte pas les tableaux associatifs bash | Utiliser des variables séparées ou un script node |
| Build échoue : `@supabase/ssr: URL and API key are required` | Variables manquantes sur le scope du déploiement | Vérifier `vercel env ls` et s'assurer que les vars sont sur le bon scope |

---

## Premier déploiement (historique — 2026-05-02)

Le projet n'existait pas sur Vercel. La commande suivante l'a créé et lié :

```bash
git archive --format=tgz 5109a97 | vercel deploy --archive=tgz --yes --scope yoan-theophiles-projects --name davidthery-app --prod
# (Note : le projet a été renommé en 2026-05-05 — utiliser `--name ambassades-guerison` pour les nouvelles créations)
```

Ensuite les 13 variables (liste à jour : `docs/mise-en-service.md` § 3) ont été ajoutées en Production via `printf | vercel env add`,  
puis en Preview via l'API REST (le CLI bloquait).
