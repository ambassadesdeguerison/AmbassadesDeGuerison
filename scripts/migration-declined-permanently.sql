-- Deux sortes de refus d'une demande de visite : « pas disponible cette fois »
-- (la personne peut redemander pour un autre live) et « ne plus accueillir cette
-- personne » (plus aucune demande chez cette ambassade, pour aucun live).
-- Seul le second pose declined_permanently = TRUE.
-- Appliquer sur la DB liée : supabase db query --linked --file scripts/migration-declined-permanently.sql
-- Idempotente. Les refus déjà en base restent des refus « cette fois » (FALSE).

ALTER TABLE contact_requests
  ADD COLUMN IF NOT EXISTS declined_permanently BOOLEAN NOT NULL DEFAULT FALSE;
