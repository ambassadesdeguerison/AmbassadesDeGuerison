-- Migration : durcissement des accès à host_profiles et au bucket de photos (2026-10-01)
-- Usage : supabase db query --linked --file scripts/migration-rls-hardening.sql
-- Idempotent. À vérifier ensuite avec : node scripts/probe-access.js
--
-- Constat (revue des effets de bord du questionnaire v2), vérifié sur la base liée :
--  1. La politique « host_profiles_public_read » (status = 'validated') donnait à n'importe qui, avec la
--     clé publique, la lecture de la LIGNE ENTIÈRE des profils validés : téléphone, e-mail, adresse privée,
--     coordonnées précises, notes admin, et désormais les réponses du questionnaire (dénomination, fonction,
--     guérisons vues, chemin de la vidéo). Les routes de l'app lisent avec la clé service : elles n'en ont pas besoin.
--  2. La politique « host_profiles_owner_full » (FOR ALL) laissait un candidat écrire n'importe quelle colonne
--     de sa propre ligne, `status` compris : il pouvait se valider lui-même sans passer par l'admin. Toutes les
--     écritures de l'app passent par des routes serveur (clé service).
--  3. La vue host_profiles_public n'est utilisée nulle part et n'avait pas de filtre sur le statut
--     (noms, consignes, lien WhatsApp des candidats non validés lisibles par tous).
--  4. Le bucket ambassador-photos était public alors que tout le code lit via des URL signées.

-- 1 + 2. Plus de lecture publique ; le propriétaire lit sa ligne mais ne l'écrit plus directement.
DROP POLICY IF EXISTS "host_profiles_public_read" ON host_profiles;
DROP POLICY IF EXISTS "host_profiles_owner_full"  ON host_profiles;
DROP POLICY IF EXISTS "host_profiles_owner_read"  ON host_profiles;
CREATE POLICY "host_profiles_owner_read" ON host_profiles
  FOR SELECT USING (auth.uid() = user_id);
-- (host_profiles_admin_full reste : l'admin lit et écrit tout.)
-- Les politiques d'autres tables qui consultent host_profiles (host_activations, contact_requests,
-- testimonials, live_signals) filtrent sur `hp.user_id = auth.uid()` : la lecture propriétaire leur suffit.

-- 3. Vue publique inutilisée et sans filtre de statut.
DROP VIEW IF EXISTS host_profiles_public;

-- 4. Photos : bucket privé, plus de lecture publique des objets.
UPDATE storage.buckets SET public = false WHERE id = 'ambassador-photos';
DROP POLICY IF EXISTS "ambassador_photos_public_read" ON storage.objects;
