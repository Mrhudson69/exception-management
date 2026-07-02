-- Centralized Exception Management & Alerting Platform
-- PostgreSQL holds configuration/relational data.
-- Elasticsearch holds the raw exception/error documents.

-- ---------------------------------------------------------------------------
-- Application settings (key/value JSON) — e.g. SMTP configuration set via UI.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Users (authentication + role-based access control)
--   admin  -> full access incl. user management
--   editor -> manage configuration, acknowledge/resolve alerts
--   viewer -> read-only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  active        BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Notification channels (Email, Slack, Teams, Webhook, ...)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_channels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('email', 'slack', 'teams', 'webhook')),
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { "webhookUrl": "...", "to": "..." }
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Notification groups (a named bundle of channels + direct emails)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  emails      TEXT[] NOT NULL DEFAULT '{}',  -- direct email recipients
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_group_channels (
  group_id   UUID NOT NULL REFERENCES notification_groups(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, channel_id)
);

-- ---------------------------------------------------------------------------
-- Applications (the services that POST to /ingest)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,         -- stable identifier used by ingest
  ingest_key            TEXT NOT NULL UNIQUE,         -- secret token apps send in X-Api-Key
  description           TEXT,
  environment           TEXT NOT NULL DEFAULT 'production',
  status                TEXT NOT NULL DEFAULT 'healthy'
                        CHECK (status IN ('healthy', 'warning', 'degraded', 'critical', 'suspended')),
  owning_team_id        UUID REFERENCES teams(id) ON DELETE SET NULL,
  notification_group_id UUID REFERENCES notification_groups(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Thresholds / alert rules
-- An application_id of NULL means the rule is global (applies to all apps).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thresholds (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  metric         TEXT NOT NULL DEFAULT 'error_count'
                 CHECK (metric IN ('error_count', 'error_rate', 'new_error_type')),
  comparator     TEXT NOT NULL DEFAULT '>'
                 CHECK (comparator IN ('>', '>=', '<', '<=', '==')),
  threshold_value NUMERIC NOT NULL DEFAULT 10,
  window_seconds INTEGER NOT NULL DEFAULT 300,  -- evaluation window
  severity       TEXT NOT NULL DEFAULT 'warning'
                 CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  enabled        BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Escalation rules (ordered steps fired when a threshold's alert is unack'd)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escalation_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  threshold_id          UUID REFERENCES thresholds(id) ON DELETE CASCADE,
  step_order            INTEGER NOT NULL DEFAULT 1,
  after_seconds         INTEGER NOT NULL DEFAULT 0,  -- delay before this step fires
  notification_group_id UUID REFERENCES notification_groups(id) ON DELETE SET NULL,
  message               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Alerts (instances created by the alert engine when a threshold breaches)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_id    UUID REFERENCES thresholds(id) ON DELETE SET NULL,
  application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
  severity        TEXT NOT NULL DEFAULT 'warning',
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'acknowledged', 'resolved')),
  title           TEXT NOT NULL,
  message         TEXT,
  observed_value  NUMERIC,
  event_count     INTEGER NOT NULL DEFAULT 1,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_app ON alerts(application_id);
CREATE INDEX IF NOT EXISTS idx_thresholds_app ON thresholds(application_id);

-- ---------------------------------------------------------------------------
-- Escalation delivery log
-- Records which escalation step has fired for which alert, so the background
-- escalation worker never double-fires a step.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_escalations (
  alert_id           UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  escalation_rule_id UUID NOT NULL REFERENCES escalation_rules(id) ON DELETE CASCADE,
  fired_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, escalation_rule_id)
);

-- ---------------------------------------------------------------------------
-- Per-user application access (application-scoped visibility).
--   all_applications = true (or role = 'admin') -> sees every application.
--   otherwise the user only sees applications listed in user_applications.
-- Defaults to true so existing users keep full visibility on upgrade.
-- (Defined here because it references the applications table above.)
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS all_applications BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS user_applications (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, application_id)
);

CREATE INDEX IF NOT EXISTS idx_user_applications_user ON user_applications(user_id);
