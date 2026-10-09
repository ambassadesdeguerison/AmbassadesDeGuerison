-- Sépare le jeton remis au visiteur du jeton d'acceptation de l'hôte.
-- Avant : action_token servait aux deux. Le visiteur le recevait (réponse de
-- POST /api/visit-requests, e-mails de feedback) et pouvait donc appeler
-- /api/visit-requests/<jeton>/accept, sans authentification, pour accepter sa
-- propre demande et recevoir l'adresse privée de l'hôte.
-- Maintenant : action_token = hôte uniquement ; visitor_token = visiteur (suivi, feedback, aide).
-- Appliquer sur la DB liée : supabase db query --linked --file scripts/migration-visitor-token.sql
-- Idempotente. Les demandes existantes reçoivent un visitor_token via le DEFAULT ;
-- les liens /visitor/… et /feedback/… déjà envoyés (ancien jeton) cessent de marcher.

ALTER TABLE contact_requests
  ADD COLUMN IF NOT EXISTS visitor_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_requests_visitor_token
  ON contact_requests(visitor_token);
