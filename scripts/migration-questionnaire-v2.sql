-- Migration : questionnaire enrichi v2 (2026-09-30)
-- Usage : supabase db query --linked --file scripts/migration-questionnaire-v2.sql
-- Idempotent. Forward-looking : en phase de conception, reset-db.sql suffit
-- (il porte déjà ces colonnes) ; utile le jour où de vrais profils existent en base.

ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS books_read          TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS trainings_done      TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS has_seen_healings   BOOLEAN;
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS has_leadership_role BOOLEAN;
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS leadership_role     TEXT;
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS intro_video_path    TEXT;
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS intro_video_mime    TEXT;

-- Reprend l'existant : un « Défi Guérison » déjà coché devient la formation correspondante.
UPDATE host_profiles
SET trainings_done = ARRAY['defi_guerison']
WHERE healing_challenge_done = TRUE AND NOT ('defi_guerison' = ANY (trainings_done));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ambassador-videos',
  'ambassador-videos',
  false,
  52428800,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;
