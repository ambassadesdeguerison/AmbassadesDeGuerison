-- Migration : champ « Sur quoi allez-vous regarder le live ? » du questionnaire (2026-10-08)
-- Usage : supabase db query --linked --file scripts/migration-live-screen.sql
-- Idempotent. Forward-looking : en phase de conception, reset-db.sql suffit (il porte déjà
-- cette colonne). Sans la migration sur une base existante, le questionnaire ne charge pas.

ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS live_screen TEXT;
