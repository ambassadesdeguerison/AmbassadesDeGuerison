-- Plafond de demandes de visite par visiteur et par live (réglable dans /admin/settings/timing).
-- Appliquer sur la DB liée : supabase db query --linked --file scripts/migration-max-requests.sql
-- Idempotente.

ALTER TABLE event_timing_config
  ADD COLUMN IF NOT EXISTS max_requests_per_visitor_per_event INTEGER NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_timing_config_max_requests_min'
  ) THEN
    ALTER TABLE event_timing_config
      ADD CONSTRAINT event_timing_config_max_requests_min
      CHECK (max_requests_per_visitor_per_event >= 1);
  END IF;
END $$;
