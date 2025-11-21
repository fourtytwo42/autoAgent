-- Models table
CREATE TABLE IF NOT EXISTS models (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  provider          TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'groq', 'ollama', 'lmstudio')),
  display_name      TEXT NOT NULL,
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  modalities        TEXT[] NOT NULL DEFAULT '{}',
  context_window    INTEGER,
  avg_latency_ms    INTEGER,
  cost_per_1k_tokens NUMERIC,
  quality_score     NUMERIC CHECK (quality_score >= 0 AND quality_score <= 1),
  reliability_score NUMERIC CHECK (reliability_score >= 0 AND reliability_score <= 1),
  last_benchmarked_at TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_enabled ON models(is_enabled);

-- Agent types table
CREATE TABLE IF NOT EXISTS agent_types (
  id            TEXT PRIMARY KEY,
  description   TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  modalities    TEXT[] NOT NULL DEFAULT '{}',
  interests     JSONB NOT NULL DEFAULT '{}'::jsonb,
  permissions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_core       BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Agent metrics table
CREATE TABLE IF NOT EXISTS agent_metrics (
  agent_id      TEXT PRIMARY KEY REFERENCES agent_types(id),
  usage_count   BIGINT NOT NULL DEFAULT 0,
  avg_score     NUMERIC,
  avg_latency_ms INTEGER,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Agent model preferences table
CREATE TABLE IF NOT EXISTS agent_model_prefs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     TEXT NOT NULL REFERENCES agent_types(id),
  model_id     UUID NOT NULL REFERENCES models(id),
  priority     INTEGER NOT NULL,
  weight       NUMERIC NOT NULL DEFAULT 1.0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, model_id)
);

CREATE INDEX idx_agent_model_prefs_agent ON agent_model_prefs(agent_id);
CREATE INDEX idx_agent_model_prefs_model ON agent_model_prefs(model_id);

-- Blackboard items table
CREATE TABLE IF NOT EXISTS blackboard_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,
  summary       TEXT NOT NULL,
  dimensions    JSONB NOT NULL DEFAULT '{}'::jsonb,
  links         JSONB NOT NULL DEFAULT '{}'::jsonb,
  detail        JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blackboard_items_type ON blackboard_items(type);
CREATE INDEX idx_blackboard_items_dimensions ON blackboard_items USING GIN (dimensions jsonb_path_ops);
CREATE INDEX idx_blackboard_items_links ON blackboard_items USING GIN (links jsonb_path_ops);
CREATE INDEX idx_blackboard_items_created ON blackboard_items(created_at);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  locked_at     TIMESTAMPTZ,
  locked_by     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jobs_status_scheduled ON jobs(status, scheduled_for);
CREATE INDEX idx_jobs_type ON jobs(type);

-- Events table for observability
CREATE TABLE IF NOT EXISTS events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,
  agent_id      TEXT,
  model_id      UUID REFERENCES models(id),
  blackboard_item_id UUID REFERENCES blackboard_items(id),
  job_id        UUID REFERENCES jobs(id),
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_events_agent ON events(agent_id);
CREATE INDEX idx_events_model ON events(model_id);

