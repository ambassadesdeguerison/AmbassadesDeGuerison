# Estimation des coûts d'exploitation

> Analyse du 2026-10-08. Elle répond à une question de David : combien coûtera l'application selon le
> nombre d'ambassades et l'affluence aux lives ? Les tarifs ont été relevés sur les pages officielles
> le 2026-10-08 ; ils changent, à re-vérifier avant toute décision (liens en § 9).

## 1. L'outil

Page HTML autonome, **hors du dépôt** : `C:\Users\tagne\Documents\estimation-couts-ambassades.html`
(à ouvrir dans un navigateur, rien n'est envoyé nulle part).

- **Vue simple** (pour David) : 4 situations, 3 curseurs, coût mensuel, répartition en 4 postes, lancement,
  « à retenir » calculés.
- **Vue détaillée** : tous les réglages, comparaisons (scénarios, cache, VPS, stockage, gratuit), tarifs
  modifiables, sources.
- Le modèle est dans la fonction `compute()` ; tous les tarifs sont des champs modifiables.

## 2. Ce que le code fait réellement (constats, 2026-10-08)

| Constat | Où | Conséquence |
|---|---|---|
| La carte redemande `/api/host-activations` **toutes les 30 s** par visiteur. `ARCHITECTURE.md` dit 5 s : c'est faux. | `components/MapPublique.tsx:567` | Premier poste de coût qui monte avec l'affluence. |
| La route est en `revalidate = 0`, **sans en-tête de cache**. | `app/api/host-activations/route.ts:8` | Chaque rafraîchissement réveille le serveur et la base. |
| La route renvoie **toutes** les ambassades de l'événement (ouvertes ou non), pas seulement les ouvertes. | même fichier | Le poids de la réponse croît avec le nombre total d'ambassades. |
| Fond de carte : `tile.openstreetmap.fr` (gratuit). Adresses : Nominatim (gratuit). | `MapPublique.tsx:593`, `app/api/geocode/route.ts` | Pas de coût, mais un risque (§ 7). |
| 20 fonctions `send…` dans `lib/email/templates.ts` ; **aucun e-mail de confirmation n'est envoyé au visiteur** quand il envoie sa demande. | `app/api/visit-requests/route.ts` | Seule l'ambassade est prévenue. |
| Aucun cron actif (`vercel.json` : `crons: []`). | `vercel.json` | Campagnes et invitations « avis après live » ne partent pas aujourd'hui. |
| Les envois d'e-mails en échec sont journalisés, sans nouvelle tentative (inscription, validation). | `app/api/inscriptions/route.ts:187-192` | Voir § 7. |

## 3. Hypothèses principales (toutes modifiables dans la page)

Ce sont des **hypothèses**, pas des mesures : à remplacer par des chiffres réels après le lancement.

- 40 % des ambassades ouvertes par live ; 4 à 6 min de présence sur la carte ; 4 à 6 % des visiteurs font une demande ; 60 % acceptées ; 85 % des demandes reçoivent une réponse.
- Photos : profil 40 Ko, lieu 150 Ko × 3 ; vidéo 35 Mo pour 40 % des ambassades (stockage pCloud prévu).
- Une ambassade ≈ 6 Ko en base, une demande 1,5 Ko, un compte visiteur 2 Ko, 60 Mo de base vide.
- 25 % des visiteurs présents simultanément au pic du live.
- Seuils de puissance Supabase (40 / 120 / 300 requêtes par seconde → Small / Medium / Large) et taille de VPS selon la charge : règles de l'auteur, **pas des mesures**.

## 4. Résultats (USD par mois, plan Pro, vidéos sur pCloud, fond de carte OpenStreetMap)

| Situation | Ambassades | Visiteurs / live | Lives / mois | Cloud sans cache | Cloud avec cache | Tout sur VPS |
|---|---|---|---|---|---|---|
| Démarrage | 60 | 800 | 1 | 50 | 50 | 25 |
| Croissance | 300 | 5 000 | 1 | 75 | 70 | 45 |
| Forte affluence | 2 000 | 50 000 | 2 | 235 | 70 | 56–68 |
| Affluence extrême | 3 000 | 100 000 | 4 | 1 070 | 366 | 146 |

Lecture :
- Le **trafic sortant de Supabase** explique la montée rapide sans cache : chaque rafraîchissement relit la liste dans la base (≈ 7 To / mois en affluence extrême, dont 99 % venant de la carte). Le cache de la carte le ramène à quelques dizaines de Go.
- Le **palier de serveur Supabase** (+5 / +50 / +100 $) est une règle approximative ; avec le cache, la base reçoit peu de requêtes.
- Le **VPS** devient intéressant seulement en affluence extrême, et à condition d'avoir un mainteneur (§ 6).

## 5. E-mails

Types relevés dans le code et volumes (scénario Croissance, par mois) : confirmation d'adresse avant inscription, candidature reçue, notification équipe ×3 (candidature, questionnaire, validation), bienvenue, refus, campagne ambassades (1 par ambassade et par live), campagne visiteurs (visiteurs **acceptés pour ce live**, une fois par adresse, pas une liste cumulée), demande reçue (ambassade), réponse acceptation/refus (visiteur), invitations « avis » (visiteurs et ambassades), invitation à témoigner, confirmation de compte visiteur, liens de connexion, aide visiteur, changement de ville.

| Situation | E-mails / mois | Moyenne / jour | Pic en un jour | Resend |
|---|---|---|---|---|
| Démarrage | 410 | 14 | 80 | Gratuit |
| Croissance | 2 000 | 67 | 416 | Pro 20 $ |
| Forte affluence | 29 000 | 976 | 3 330 | Pro 20 $ |
| Affluence extrême | 109 000 | 3 600 | 6 660 | Scale 90 $ + supplément |

**Lancement : 300 inscriptions en 7 jours** ≈ 7,4 e-mails par candidate, soit ≈ 2 200 e-mails, **≈ 555 le jour le plus chargé** (la moitié des inscriptions dans les 2 premiers jours). Le plafond gratuit de Resend est de **100 par jour** : il faut le plan Pro (20 $) pour le mois du lancement, plus un deuxième pic au premier live (≈ 240 liens d'activation d'un coup).

## 6. Recommandations

**Niveau de service, par étape** (payer le jour où des vraies données ou de vrais utilisateurs arrivent) :
1. **Maintenant (conception)** : tout en gratuit. Supabase gratuit se met en pause après 1 semaine ; le workflow keepalive couvre cela.
2. **Avant que Camille valide de vrais profils** : Supabase Pro (25 $). Seul le Pro fait des sauvegardes (7 jours) ; le gratuit n'en fait aucune, limite les fichiers à 50 Mo et le trafic à 5 Go.
3. **Avant l'annonce publique** : Resend Pro (20 $), Vercel Pro (20 $), cache de la carte, domaine d'envoi vérifié.
4. **Dès le passage en payant** : régler un plafond de dépenses chez Vercel (suspend la production, avec quelques minutes de retard) et chez Supabase (couvre trafic et fichiers, **pas** le serveur).

**Vercel gratuit et usage commercial** : le texte officiel réserve le plan gratuit à un « usage personnel non commercial » ; il précise que **demander des dons n'est pas un usage commercial**, mais que l'est un site dont quelqu'un est **payé pour le créer, le mettre à jour ou l'héberger**. Le doute (dont « personal » pour un projet d'organisation) est à lever auprès du support Vercel (demande envoyée, réponse en attente au 2026-10-08). Par ailleurs, au-delà des limites gratuites, Vercel **bloque** au lieu de facturer.

**Leviers d'économie**
- **Cache de la carte** (le plus important). Option B recommandée dans `route.ts` : en-tête `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` sur la seule réponse réussie (pas de `max-age`, pas sur les erreurs). Durée en variable d'environnement (0 pendant la conception : le DevOverlay changerait sinon la carte avec 30 à 60 s de retard). À contrôler après déploiement avec `curl -I` (`x-vercel-cache: HIT`). Désactiver en tests de bout en bout.
- **Regrouper les notifications à l'équipe** en un récapitulatif quotidien (≈ 2,7 e-mails par candidate sur 7,4).
- **Étaler les inscriptions** ne vaut que pour rester sous 100 e-mails par jour (≈ 24 jours pour 300) : l'effet lancement serait perdu.
- Éventuel accusé de réception au visiteur : +1 e-mail par demande (≈ +19 % en Croissance).

**VPS** (Hetzner ou équivalent)
- « Site seul sur VPS » peut coûter **plus** que le cloud ; « tout sur VPS » (Supabase auto-hébergé, outil libre) est moins cher en très forte affluence : trafic sortant quasi gratuit (20 To inclus), coût plat.
- Prérequis : une personne qui maintient le serveur (≈ 4 h / mois) et une deuxième avec les accès.
  - Toutes les 2 semaines : mises à jour de sécurité (système, conteneurs), disque / mémoire / charge, vérifier que les envois planifiés ont tourné, certificat HTTPS.
  - Tous les mois : copie chiffrée de la sauvegarde **hors du serveur**, mises à jour Next.js et dépendances, alertes de disponibilité, e-mail de test.
  - Tous les 3 mois : **restaurer une sauvegarde sur un autre serveur**, renouveler clés et secrets, revue de capacité.
  - Avant un gros live : test de charge, serveur plus gros pour la journée, être joignable.
- Les prix Hetzner sont instables en 2026 (hausse en juin, gamme CX signalée indisponible) : prix à confirmer dans la console.

**Écarté : Google Workspace.** Il ne contient ni hébergement, ni base, ni authentification ; remplacer Vercel et Supabase demanderait Google Cloud / Firebase (facturé à l'usage) et une réécriture complète (Postgres + règles de sécurité par ligne → autre modèle). Gain possible ≈ 4 $ (pCloud). Gmail est limité à 2 000 messages par jour et par utilisateur, d'où Resend.

## 7. Risques et points de conformité à traiter avant le lancement

1. **Nominatim et l'autocomplétion.** La politique d'usage indique un maximum absolu de 1 requête par seconde, des résultats à mettre en cache, et que l'autocomplétion n'est pas prise en charge. `/api/geocode` propose une autocomplétion de ville : à faire vérifier ; prévoir un géocodeur payant ou auto-hébergé si l'usage grandit.
2. **Fond de carte OSM France** : aucune garantie, tout usage abusif peut être limité ou bloqué. Un fournisseur payant (MapTiler Flex : 30 $ pour 500 000 requêtes) est une précaution, pas une obligation.
3. **Domaine d'envoi Resend** : l'adresse d'essai `onboarding@resend.dev` ne livre qu'au propriétaire du compte. Sans domaine vérifié, aucune candidate ne reçoit rien.
4. **Plafond de 100 e-mails par jour du plan gratuit** : un envoi refusé n'est pas réessayé et l'inscription commence par un e-mail de confirmation d'adresse ; une candidate qui ne le reçoit pas ne peut pas continuer (comportement exact de la route de vérification non testé).
5. **`ARCHITECTURE.md`** annonce un polling de 5 s : à corriger (30 s).

## 8. Questions ouvertes

- Réponse du support Vercel sur l'usage gratuit pour ce projet.
- Quelqu'un sera-t-il rémunéré pour développer ou héberger le site ? (change le statut « commercial » chez Vercel.)
- Volume réel de visiteurs au premier live (toutes les hypothèses de § 3 en dépendent).
- Limite de téléchargement mensuel de pCloud pour les vidéos.

## 9. Sources (consultées le 2026-10-08)

| Sujet | Lien | Fiabilité |
|---|---|---|
| Vercel : tarifs | https://vercel.com/pricing | officiel |
| Vercel : plan Pro (crédit 20 $, 1 To, alerte 200 $) | https://vercel.com/docs/plans/pro-plan | officiel |
| Vercel : limites gratuites, définition d'usage commercial, dons | https://vercel.com/docs/limits/fair-use-guidelines | officiel |
| Vercel : plafond de dépenses | https://vercel.com/docs/spend-management | officiel |
| Supabase : tarifs Free / Pro | https://supabase.com/pricing | officiel |
| Supabase : tailles de serveur | https://supabase.com/docs/guides/platform/compute-and-disk | officiel |
| Supabase : sauvegardes | https://supabase.com/docs/guides/platform/backups | officiel |
| Supabase : plafond de dépenses | https://supabase.com/docs/guides/platform/cost-control | officiel |
| Resend : tarifs | https://resend.com/pricing | officiel |
| pCloud : achat à vie | https://www.pcloud.com/cloud-storage-pricing-plans.html | officiel |
| pCloud : abonnement annuel | https://www.cloudwards.net/pcloud-pricing/ | tiers |
| Hetzner : gamme CX (sans prix) | https://www.hetzner.com/cloud/cost-optimized | officiel |
| Hetzner : hausse de juin 2026 | https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do | tiers |
| Hetzner : gamme CX indisponible | https://findstack.com/resources/hetzner-price-increase-2026 | tiers |
| OSM France : tuiles | https://www.openstreetmap.fr/fonds-de-carte/ | officiel |
| OSM : politique des tuiles | https://operations.osmfoundation.org/policies/tiles/ | officiel |
| Nominatim : politique d'usage | https://operations.osmfoundation.org/policies/nominatim/ | officiel |
| MapTiler : tarifs | https://www.maptiler.com/cloud/pricing/ | officiel |
| Gmail : limites d'envoi | https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace | officiel |

**Non vérifié** : limite de téléchargement pCloud et forfait gratuit 10 Go ; prix du nom de domaine (15 $ / an, estimation) ; prix Hetzner CX33 / CX43 (interpolés) ; seuils de puissance Supabase et de VPS ; tout le comportement des utilisateurs.
