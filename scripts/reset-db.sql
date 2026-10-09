-- ============================================================
-- RESET COMPLET — DavidTheryApp (pivot live-driven v2)
-- Usage : supabase db query --linked --file scripts/reset-db.sql
--         (ou coller le fichier dans Supabase > SQL Editor)
-- ⚠️  Supprime TOUTES les données et recrée le schéma proprement
--
-- Ce fichier porte l'ÉTAT FINAL de tous les scripts/migration-*.sql : sur une base neuve ou remise à
-- zéro, il suffit seul — ne PAS rejouer les migrations après lui. Les migrations ne servent qu'à mettre
-- à jour une base qui contient déjà de vraies données (et alors, ne JAMAIS lancer ce fichier).
-- ============================================================

-- ============================================================
-- 1. Suppression dans l'ordre (FK oblige)
-- ============================================================

DROP TABLE IF EXISTS campaign_recipients   CASCADE;
DROP TABLE IF EXISTS scheduled_campaigns   CASCADE;
DROP TABLE IF EXISTS moderation_log        CASCADE;
DROP TABLE IF EXISTS live_feedbacks        CASCADE;
DROP TABLE IF EXISTS blacklist             CASCADE;
DROP TABLE IF EXISTS live_signals          CASCADE;
DROP TABLE IF EXISTS testimonials          CASCADE;
DROP TABLE IF EXISTS contact_requests      CASCADE;
DROP TABLE IF EXISTS visitor_profiles      CASCADE;
DROP TABLE IF EXISTS host_activations      CASCADE;
DROP TABLE IF EXISTS admin_users           CASCADE;
DROP TABLE IF EXISTS host_profiles         CASCADE;
DROP TABLE IF EXISTS events                CASCADE;
DROP TABLE IF EXISTS onboarding_config     CASCADE;
DROP TABLE IF EXISTS event_timing_config   CASCADE;

DROP VIEW  IF EXISTS host_profiles_public CASCADE;

DROP FUNCTION IF EXISTS is_admin(UUID)                                  CASCADE;
DROP FUNCTION IF EXISTS is_super_admin(UUID)                            CASCADE;
DROP FUNCTION IF EXISTS fn_set_event_registration_dates()               CASCADE;
DROP FUNCTION IF EXISTS fn_auto_activate_hosts_for_event()              CASCADE;
DROP FUNCTION IF EXISTS fn_auto_activate_host_for_existing_events()     CASCADE;
DROP FUNCTION IF EXISTS fn_contact_request_count_update()               CASCADE;
DROP FUNCTION IF EXISTS accept_contact_request(UUID, UUID)              CASCADE;

-- ============================================================
-- 2. TABLES
-- ============================================================

CREATE TABLE events (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT        NOT NULL,
  description            TEXT,
  youtube_url            TEXT,
  live_link              TEXT,
  event_date             TIMESTAMPTZ NOT NULL,
  registration_opens_at  TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  feedback_sent          BOOLEAN     DEFAULT FALSE,
  closed_at              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE host_profiles (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name             TEXT        NOT NULL,
  last_name              TEXT        NOT NULL,
  email                  TEXT        NOT NULL UNIQUE,
  host_type              TEXT        NOT NULL DEFAULT 'individual'
    CHECK (host_type IN ('individual', 'church')),
  church_subtype         TEXT
    CHECK (church_subtype IN ('permanent_open', 'occasional', NULL)),
  city                   TEXT        NOT NULL,
  country                TEXT        NOT NULL,
  lat                    DOUBLE PRECISION,
  lng                    DOUBLE PRECISION,
  -- Coordonnées précises (Phase 2) — PRIVÉES, jamais exposées sur une route
  -- publique. Servent uniquement au calcul de distance visiteur↔ambassadeur
  -- (calcul serveur, cf /api/distance). lat/lng ci-dessus restent la version
  -- publique grossière (ville ou arrondissement-rounded) — ne jamais les
  -- écraser directement avec la valeur du geocoding précis.
  lat_precise            DOUBLE PRECISION,
  lng_precise            DOUBLE PRECISION,
  quartier               TEXT        DEFAULT NULL,
  presentation_message   TEXT        DEFAULT NULL CHECK (char_length(presentation_message) <= 240),
  live_screen            TEXT,
  is_women_only          BOOLEAN     NOT NULL DEFAULT FALSE,
  geocoding_failed       BOOLEAN     DEFAULT FALSE,
  address_private        TEXT,
  whatsapp_group_url     TEXT        DEFAULT NULL
    CHECK (
      whatsapp_group_url IS NULL
      OR whatsapp_group_url LIKE 'https://chat.whatsapp.com/%'
      OR whatsapp_group_url LIKE 'https://wa.me/%'
    ),
  capacity               INT         NOT NULL DEFAULT 10 CHECK (capacity > 0),
  consignes              TEXT,
  -- Public sur la carte : "TV salon", "écran ordinateur", "téléphone projeté"
  viewing_setup          TEXT,
  -- Photos (profil public, pièce admin-only via RLS)
  profile_photo_url      TEXT,
  room_photo_urls        TEXT[],
  phone                  TEXT        NOT NULL,
  -- Questionnaire enrichi — admin-only (RLS strict)
  healing_challenge_done BOOLEAN,
  church_attendance      TEXT,
  denomination           TEXT,
  parcours_spirituel     TEXT,
  livres_lus             TEXT,        -- texte libre : « autres livres ou formations » (hors catalogue)
  conferences_assistees  BOOLEAN     DEFAULT FALSE,
  -- Questionnaire v2 (2026-09-30) : listes à cocher (slugs de lib/questionnaire/catalog.ts),
  -- signaux pastoraux (NULL = pas encore répondu) et vidéo de présentation facultative.
  books_read             TEXT[]      NOT NULL DEFAULT '{}',
  trainings_done         TEXT[]      NOT NULL DEFAULT '{}',
  has_seen_healings      BOOLEAN,
  has_leadership_role    BOOLEAN,
  leadership_role        TEXT,
  intro_video_path       TEXT,        -- chemin Storage (bucket privé ambassador-videos), jamais une URL
  intro_video_mime       TEXT,
  admin_notes            TEXT,
  -- Nouveau cycle de statut (remplace pending_onboarding/active)
  status                 TEXT        NOT NULL DEFAULT 'pending_review'
    CHECK (status IN (
      'pending_review', 'pre_approved', 'enrichment_pending',
      'validated', 'suspended', 'rejected'
    )),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Table multi-admins (source de vérité pour is_admin / is_super_admin)
CREATE TABLE admin_users (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role     TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activation par live (opt-in explicite — is_active=FALSE par défaut)
CREATE TABLE host_activations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_profile_id UUID        NOT NULL REFERENCES host_profiles(id) ON DELETE CASCADE,
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  capacity        INT         NOT NULL DEFAULT 10 CHECK (capacity > 0),
  accepted_count  INT         NOT NULL DEFAULT 0  CHECK (accepted_count >= 0),
  is_active       BOOLEAN     DEFAULT FALSE,
  is_full         BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (host_profile_id, event_id)
);

-- Profil visiteur réutilisable (compte Supabase Auth, magic link — même
-- mécanisme que host_profiles/admin_users, cf learning
-- management-token-lost-link-problem : éviter les tokens UUID pour des
-- profils permanents). Depuis Phase 3 PR3 : création via un écran de compte
-- explicite (/mon-espace/creer), plus de création silencieuse à la première
-- demande — corrige une faille où n'importe quel email non authentifié
-- pouvait écraser le téléphone d'un profil existant (cf /plan-eng-review,
-- Codex). Photo optionnelle, jamais un blocage de création de compte.
CREATE TABLE visitor_profiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name     TEXT        NOT NULL,
  email          TEXT        NOT NULL UNIQUE,
  phone          TEXT,
  photo_url      TEXT,
  -- Signalement manuel depuis le dashboard ambassadeur (pas de modération IA,
  -- hors scope) — modèle d'abus minimal pour la photo de profil visiteur.
  photo_reported BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_requests (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_activation_id          UUID        NOT NULL REFERENCES host_activations(id) ON DELETE CASCADE,
  visitor_first_name          TEXT        NOT NULL,
  visitor_email               TEXT        NOT NULL,
  -- Obligatoire (Phase 3 PR1, validé David : "l'ambassadeur ouvre sa porte,
  -- le visiteur donne juste sa présence — pas symétrique en risque. Un
  -- téléphone permet à l'hôte d'appeler en cas d'imprévu, pas de checkpoint.")
  visitor_phone               TEXT        NOT NULL,
  -- Phase 3 PR3 (photo visiteur + écran de compte) : la demande est désormais
  -- toujours créée depuis un compte visiteur authentifié — permet de retrouver
  -- la photo de profil sans la stocker par-demande. Nullable : les demandes
  -- créées avant ce chantier n'ont pas de compte associé.
  visitor_profile_id          UUID        REFERENCES visitor_profiles(id) ON DELETE SET NULL,
  nb_personnes                INT         NOT NULL DEFAULT 1 CHECK (nb_personnes > 0),
  visitor_message             TEXT,
  status                      TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled_no_response')),
  -- TRUE seulement si l'ambassadeur a choisi « ne plus accueillir cette personne » :
  -- plus aucune demande chez cette ambassade, pour aucun live. Un refus simple
  -- (« pas disponible cette fois ») laisse FALSE.
  declined_permanently        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Jeton de l'HÔTE uniquement (liens /accueillir et /refuser, dashboard). Ne jamais
  -- le renvoyer au visiteur ni le mettre dans un e-mail visiteur : /accept n'a pas
  -- d'authentification, qui le détient peut accepter la demande.
  action_token                UUID        NOT NULL DEFAULT gen_random_uuid(),
  -- Jeton du VISITEUR (suivi /visitor, feedback, aide). Ne donne aucun pouvoir
  -- d'acceptation ni de refus.
  visitor_token               UUID        NOT NULL DEFAULT gen_random_uuid(),
  visitor_notifications_optin BOOLEAN     DEFAULT TRUE,
  UNIQUE (host_activation_id, visitor_email),
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE testimonials (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_profile_id    UUID        REFERENCES host_profiles(id) ON DELETE CASCADE,
  contact_request_id UUID        REFERENCES contact_requests(id) ON DELETE SET NULL,
  visitor_name       TEXT,
  submitter_city     TEXT,
  event_id           UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  content            TEXT        NOT NULL,
  photo_url          TEXT,
  is_visible         BOOLEAN     DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE live_signals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_profile_id UUID        NOT NULL REFERENCES host_profiles(id) ON DELETE CASCADE,
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  description     TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'used')),
  link_shared     BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Notation post-live (4 critères × 1-5, workflow triage signalement)
CREATE TABLE live_feedbacks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID        NOT NULL REFERENCES events(id),
  host_profile_id     UUID        NOT NULL REFERENCES host_profiles(id),
  contact_request_id  UUID        REFERENCES contact_requests(id),
  visitor_email       TEXT        NOT NULL,
  rating_welcome      SMALLINT    CHECK (rating_welcome      BETWEEN 1 AND 5),
  rating_friendliness SMALLINT    CHECK (rating_friendliness BETWEEN 1 AND 5),
  rating_listening    SMALLINT    CHECK (rating_listening    BETWEEN 1 AND 5),
  rating_prayer       SMALLINT    CHECK (rating_prayer       BETWEEN 1 AND 5),
  free_text           TEXT,
  -- Direction host_to_visitor uniquement (Phase 3 PR2) : "seriez-vous à
  -- l'aise que cette personne revienne chez vous ?". Sert aussi de donnée
  -- d'entrée au blocage visiteur (Phase 3 PR3) — pas de colonne dupliquée.
  would_host_again    BOOLEAN,
  reported            BOOLEAN     DEFAULT FALSE,
  report_reason       TEXT,
  report_status       TEXT        DEFAULT 'pending'
    CHECK (report_status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  report_handled_by   UUID        REFERENCES auth.users(id),
  report_handled_at   TIMESTAMPTZ,
  report_resolution   TEXT,
  direction           TEXT        CHECK (direction IN ('visitor_to_host', 'host_to_visitor')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT live_feedbacks_unique UNIQUE (event_id, host_profile_id, visitor_email, direction)
);

-- Blacklist email / téléphone (anti-spam, anti-abus)
-- host_profile_id NULL = blocage global (admin, /admin/blacklist).
-- host_profile_id renseigné = blocage par-ambassadeur uniquement (Phase 3
-- PR3, déclenché depuis le feedback post-live). Décision /plan-eng-review :
-- même table/pattern que le blocage global plutôt qu'un système parallèle —
-- pas de dépendance sur visitor_profiles.id (email/phone bruts, comme le
-- blocage global existant).
CREATE TABLE blacklist (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_profile_id UUID        REFERENCES host_profiles(id) ON DELETE CASCADE,
  email      TEXT,
  phone      TEXT,
  reason     TEXT        NOT NULL,
  added_by   UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campagnes mail programmées (dispatched par GitHub Actions cron */5 min)
CREATE TABLE scheduled_campaigns (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES events(id),
  type           TEXT        CHECK (type IN ('ambassadeurs', 'visiteurs')),
  scheduled_at   TIMESTAMPTZ NOT NULL,
  custom_message TEXT,
  sent_at        TIMESTAMPTZ,
  status         TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts       INT         DEFAULT 0,
  last_error     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 1 ligne par destinataire par campagne (idempotence dispatch)
CREATE TABLE campaign_recipients (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID        NOT NULL REFERENCES scheduled_campaigns(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  first_name        TEXT,
  recipient_type    TEXT        CHECK (recipient_type IN ('ambassador', 'visitor')),
  activation_token  UUID        DEFAULT gen_random_uuid(),
  unsubscribe_token UUID        DEFAULT gen_random_uuid(),
  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'bounced', 'failed', 'unsubscribed', 'activated')),
  attempts          INT         DEFAULT 0,
  sent_at           TIMESTAMPTZ,
  error             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, email)
);

-- Journal de modération append-only (audit trail)
CREATE TABLE moderation_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT        NOT NULL,
  target_id   UUID,
  admin_id    UUID        REFERENCES auth.users(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_config (
  id         INTEGER     PRIMARY KEY DEFAULT 1,
  video_url  TEXT        NOT NULL DEFAULT '',
  pdf_url    TEXT        NOT NULL DEFAULT '/docs/guide-ambassade.pdf',
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Plages temporelles configurables sans déploiement
CREATE TABLE event_timing_config (
  id                               INTEGER     PRIMARY KEY DEFAULT 1,
  campaign_ambassadors_days_before INTEGER     DEFAULT 7,
  campaign_visitors_days_before    INTEGER     DEFAULT 3,
  host_reminder_days_before        INTEGER     DEFAULT 2,
  visitor_auto_decline_days_before INTEGER     DEFAULT 1,
  feedback_days_after              INTEGER     DEFAULT 1,
  queue_aging_days                 INTEGER     DEFAULT 5,
  soon_threshold_days              INTEGER     DEFAULT 2,
  -- Plafond anti-démarchage : demandes en cours (pending + accepted) par visiteur et par live
  max_requests_per_visitor_per_event INTEGER   NOT NULL DEFAULT 3 CHECK (max_requests_per_visitor_per_event >= 1),
  updated_at                       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO event_timing_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. (vue publique supprimée le 2026-10-01)
-- ============================================================
-- host_profiles_public n'était utilisée nulle part et n'avait pas de filtre sur le statut (noms, consignes
-- et lien WhatsApp des candidats lisibles par tous). Les données publiques passent par les routes serveur
-- (/api/host-activations, pages /ambassade/[id]) qui sélectionnent explicitement leurs colonnes.

-- ============================================================
-- 4. FONCTIONS ADMIN (SECURITY DEFINER — bypass RLS sur admin_users)
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = uid);
$$;

CREATE OR REPLACE FUNCTION is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = uid AND role = 'super_admin');
$$;

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

-- Trigger A : fermeture auto des inscriptions au moment du live.
-- registration_opens_at reste NULL par défaut — pas de gate d'ouverture.
-- Principe produit : on fait confiance aux visiteurs comme aux ambassadeurs.
-- Si une fiche d'ambassade est visible (host actif), l'inscription est possible.
-- David peut éventuellement fixer manuellement registration_opens_at sur un event
-- spécifique (cas exceptionnel — l'API check reste NULL-safe : NULL = no gate).
CREATE OR REPLACE FUNCTION fn_set_event_registration_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.registration_closes_at IS NULL THEN
    NEW.registration_closes_at := NEW.event_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_event_registration_dates
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION fn_set_event_registration_dates();

-- Trigger B : nouvel event → créer host_activations pour les hôtes validés
-- is_active=FALSE : l'ambassadeur doit cliquer "J'accueille" depuis le mail
CREATE OR REPLACE FUNCTION fn_auto_activate_hosts_for_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO host_activations (host_profile_id, event_id, is_active, is_full, capacity, accepted_count)
  SELECT hp.id, NEW.id, FALSE, FALSE, hp.capacity, 0
  FROM host_profiles hp
  WHERE hp.status = 'validated'
  ON CONFLICT (host_profile_id, event_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_auto_activate_hosts_for_event failed for event %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_activate_hosts
AFTER INSERT ON events
FOR EACH ROW EXECUTE FUNCTION fn_auto_activate_hosts_for_event();

-- Trigger C : hôte passe à 'validated' → créer host_activations pour events futurs
-- is_active=FALSE par défaut (opt-in explicite)
CREATE OR REPLACE FUNCTION fn_auto_activate_host_for_existing_events()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'validated' AND (OLD.status IS DISTINCT FROM 'validated') THEN
    INSERT INTO host_activations (host_profile_id, event_id, is_active, is_full, capacity, accepted_count)
    SELECT NEW.id, e.id, FALSE, FALSE, NEW.capacity, 0
    FROM events e
    WHERE e.event_date > NOW()
    ON CONFLICT (host_profile_id, event_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_auto_activate_host_for_existing_events failed for host %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_activate_host_on_validated
AFTER UPDATE OF status ON host_profiles
FOR EACH ROW EXECUTE FUNCTION fn_auto_activate_host_for_existing_events();

-- Trigger D : suivi capacité sur contact_requests
-- Passage à accepted → +1, passage depuis accepted vers declined/cancelled_no_response → -1
CREATE OR REPLACE FUNCTION fn_contact_request_count_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM 'accepted'
        AND NEW.status = 'accepted' THEN
    UPDATE host_activations
    SET
      accepted_count = accepted_count + 1,
      is_full = CASE WHEN (accepted_count + 1) >= capacity THEN TRUE ELSE is_full END
    WHERE id = NEW.host_activation_id;

  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'accepted'
        AND NEW.status IN ('declined', 'cancelled_no_response') THEN
    UPDATE host_activations
    SET
      accepted_count = GREATEST(accepted_count - 1, 0),
      is_full = CASE WHEN GREATEST(accepted_count - 1, 0) >= capacity THEN is_full ELSE FALSE END
    WHERE id = NEW.host_activation_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_contact_request_count_update failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_request_count
AFTER UPDATE OF status ON contact_requests
FOR EACH ROW EXECUTE FUNCTION fn_contact_request_count_update();

-- ============================================================
-- 6. SUPABASE REALTIME
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_feedbacks;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_activations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials        ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_signals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_feedbacks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_timing_config ENABLE ROW LEVEL SECURITY;
-- onboarding_config et event_timing_config : service_role uniquement (pas de policy publique)

-- events : lecture publique, écriture admin
CREATE POLICY "events_public_read" ON events
  FOR SELECT USING (true);
CREATE POLICY "events_admin_write" ON events
  FOR ALL USING (is_admin(auth.uid()));

-- host_profiles : AUCUNE lecture publique (corrigé le 2026-10-01 : la lecture publique des profils validés
-- exposait téléphone, adresse privée et réponses du questionnaire à n'importe qui avec la clé publique).
-- Le propriétaire lit sa ligne mais ne l'écrit pas directement (une écriture libre lui permettait de changer
-- son propre `status`) : toutes les écritures passent par les routes serveur (clé service). Admin : tout.
CREATE POLICY "host_profiles_owner_read" ON host_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "host_profiles_admin_full" ON host_profiles
  FOR ALL USING (is_admin(auth.uid()));

-- visitor_profiles : le visiteur ne voit et ne modifie que son propre profil
-- (aucune lecture publique, aucun accès admin — pas de valeur pastorale à ce
-- que David/Camille consultent le téléphone d'un visiteur hors contexte)
CREATE POLICY "visitor_profiles_owner_full" ON visitor_profiles
  FOR ALL USING (auth.uid() = user_id);

-- admin_users : super_admin uniquement
CREATE POLICY "admin_users_super_admin" ON admin_users
  FOR ALL USING (is_super_admin(auth.uid()));

-- host_activations : lecture publique, hôte peut update le sien, admin full
CREATE POLICY "host_activations_public_read" ON host_activations
  FOR SELECT USING (true);
CREATE POLICY "host_activations_host_update" ON host_activations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM host_profiles hp
      WHERE hp.id = host_profile_id AND hp.user_id = auth.uid()
    )
  );
CREATE POLICY "host_activations_admin_full" ON host_activations
  FOR ALL USING (is_admin(auth.uid()));

-- contact_requests : insert public (visiteurs), hôte lit/modifie les siennes, admin full
CREATE POLICY "contact_requests_public_insert" ON contact_requests
  FOR INSERT WITH CHECK (true);
CREATE POLICY "contact_requests_host_full" ON contact_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM host_activations ha
      JOIN host_profiles hp ON ha.host_profile_id = hp.id
      WHERE ha.id = host_activation_id AND hp.user_id = auth.uid()
    )
  );
CREATE POLICY "contact_requests_admin_full" ON contact_requests
  FOR ALL USING (is_admin(auth.uid()));

-- testimonials : publics visibles, hôte/visitor insère, admin full
CREATE POLICY "testimonials_public_read" ON testimonials
  FOR SELECT USING (is_visible = true);
CREATE POLICY "testimonials_host_full" ON testimonials
  FOR ALL USING (
    host_profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM host_profiles hp
      WHERE hp.id = host_profile_id AND hp.user_id = auth.uid()
    )
  );
CREATE POLICY "testimonials_visitor_insert" ON testimonials
  FOR INSERT WITH CHECK (
    contact_request_id IS NOT NULL AND host_profile_id IS NULL
  );
CREATE POLICY "testimonials_anon_insert" ON testimonials
  FOR INSERT WITH CHECK (
    host_profile_id IS NULL AND contact_request_id IS NULL
  );
CREATE POLICY "testimonials_admin_full" ON testimonials
  FOR ALL USING (is_admin(auth.uid()));

-- live_signals : hôte full, admin full
CREATE POLICY "live_signals_host_full" ON live_signals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM host_profiles hp
      WHERE hp.id = host_profile_id AND hp.user_id = auth.uid()
    )
  );
CREATE POLICY "live_signals_admin_full" ON live_signals
  FOR ALL USING (is_admin(auth.uid()));

-- live_feedbacks : insert public (lien tokenisé, pas de session), admin full
CREATE POLICY "live_feedbacks_public_insert" ON live_feedbacks
  FOR INSERT WITH CHECK (true);
CREATE POLICY "live_feedbacks_admin_full" ON live_feedbacks
  FOR ALL USING (is_admin(auth.uid()));

-- Tables admin-only
CREATE POLICY "blacklist_admin_full"            ON blacklist            FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "scheduled_campaigns_admin_full"  ON scheduled_campaigns  FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "campaign_recipients_admin_full"  ON campaign_recipients  FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "moderation_log_admin_full"       ON moderation_log       FOR ALL USING (is_admin(auth.uid()));

-- ============================================================
-- 8. INDEX
-- ============================================================

CREATE INDEX idx_host_profiles_status          ON host_profiles(status);
CREATE INDEX idx_host_profiles_lat_lng         ON host_profiles(lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX idx_host_activations_event        ON host_activations(event_id);
CREATE INDEX idx_host_activations_active       ON host_activations(event_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_live_signals_event            ON live_signals(event_id, status);
CREATE INDEX idx_contact_requests_token        ON contact_requests(action_token);
CREATE UNIQUE INDEX idx_contact_requests_visitor_token ON contact_requests(visitor_token);
CREATE INDEX idx_contact_requests_visitor_profile ON contact_requests(visitor_profile_id) WHERE visitor_profile_id IS NOT NULL;
CREATE INDEX idx_live_feedbacks_reported       ON live_feedbacks(reported, created_at DESC) WHERE reported = TRUE;
CREATE INDEX idx_scheduled_campaigns_dispatch  ON scheduled_campaigns(scheduled_at, status) WHERE status = 'pending';
CREATE INDEX idx_campaign_recipients_activation ON campaign_recipients(activation_token) WHERE activation_token IS NOT NULL;
CREATE INDEX idx_campaign_recipients_unsub       ON campaign_recipients(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;
CREATE INDEX idx_blacklist_email               ON blacklist(email);
CREATE INDEX idx_blacklist_phone               ON blacklist(phone);
-- Indexes pour /admin/stats (Briefing factuel) — getHostsToCheck performance à 1000+ ambassadeurs
CREATE INDEX idx_host_activations_lookup       ON host_activations(host_profile_id, event_id, is_active);
CREATE INDEX idx_contact_requests_activation_status ON contact_requests(host_activation_id, status);
CREATE INDEX idx_testimonials_event_visible    ON testimonials(event_id, is_visible, created_at DESC) WHERE is_visible = TRUE;

-- ============================================================
-- 9. STORAGE BUCKETS
-- ============================================================

-- Bucket privé (public = false) — corrigé le 2026-07-27 (/plan-eng-review a détecté que
-- reset-db.sql n'avait jamais été aligné sur le pivot vie-privée de migration-photos-private.sql ;
-- un `supabase start` local frais recréait un bucket réellement public). Photos accessibles
-- uniquement via signed URL générée côté serveur (lib/storage/photo-url.ts).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ambassador-photos',
  'ambassador-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Vidéos de présentation (questionnaire v2) — bucket privé, admin seulement, via signed URL.
-- Limite 50 Mo = plafond de fichier du plan gratuit Supabase. Stockage provisoire :
-- prévu pour être remplacé par pCloud (structure année/mois lisible sans API).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ambassador-videos',
  'ambassador-videos',
  false,
  52428800,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ambassador_photos_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "ambassador_photos_service_insert" ON storage.objects;
DROP POLICY IF EXISTS "ambassador_photos_owner_select"   ON storage.objects;
DROP POLICY IF EXISTS "ambassador_photos_owner_insert"   ON storage.objects;
DROP POLICY IF EXISTS "ambassador_photos_owner_update"   ON storage.objects;
DROP POLICY IF EXISTS "ambassador_photos_owner_delete"   ON storage.objects;

-- L'ambassadeur peut lire ses propres fichiers (pour createSignedUrl côté client)
CREATE POLICY "ambassador_photos_owner_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ambassador-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.host_profiles WHERE user_id = auth.uid()
  )
);

-- L'ambassadeur peut uploader (le contrôle d'ownership est dans la route API)
CREATE POLICY "ambassador_photos_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ambassador-photos'
  AND auth.role() = 'authenticated'
);

-- L'ambassadeur peut écraser ses propres fichiers (upsert)
CREATE POLICY "ambassador_photos_owner_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'ambassador-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.host_profiles WHERE user_id = auth.uid()
  )
);

-- L'ambassadeur peut supprimer ses propres fichiers
CREATE POLICY "ambassador_photos_owner_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ambassador-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.host_profiles WHERE user_id = auth.uid()
  )
);

-- Bucket dédié visiteur (Phase 3 PR3, /plan-eng-review) — isolation RLS entre
-- deux populations d'utilisateurs différentes (hôte vs visiteur), pas de
-- sous-préfixe du bucket ambassadeur. Path : {user_id}/profile-{ts}.webp —
-- préfixe = auth.uid() directement (pas de host_profiles.id à résoudre côté
-- policy). Lecture par l'hôte concerné : jamais via ce bucket directement,
-- via une route API service_role qui vérifie l'ownership de la demande
-- (cf app/api/dashboard/contact-photos) — évite d'élargir la policy RLS de
-- visitor_profiles aux hôtes (fuiterait email/téléphone du visiteur).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'visitor-photos',
  'visitor-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "visitor_photos_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "visitor_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "visitor_photos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "visitor_photos_owner_delete" ON storage.objects;

CREATE POLICY "visitor_photos_owner_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'visitor-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "visitor_photos_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'visitor-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "visitor_photos_owner_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'visitor-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "visitor_photos_owner_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'visitor-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================
-- 11. DROITS D'ACCÈS À L'API DATA (GRANT)
-- ============================================================
-- Depuis mai 2026, un projet Supabase neuf n'ouvre plus automatiquement les nouvelles tables de `public`
-- à l'API (case « Automatically expose new tables » décochée à la création). Sans ce bloc, sur un projet
-- neuf, TOUTES les requêtes échouent en « permission denied » — alors que sur l'ancien projet, créé avant
-- le changement, les droits étaient accordés d'office.
--
-- Ces droits reproduisent l'ancien comportement. Ils n'ouvrent rien à eux seuls : la sécurité reste portée
-- par la RLS (activée sur les 15 tables, section 6) et par `node scripts/probe-access.js`.
-- Idempotent. Toute NOUVELLE table ajoutée plus tard doit recevoir ses propres GRANT (et sa RLS).

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
