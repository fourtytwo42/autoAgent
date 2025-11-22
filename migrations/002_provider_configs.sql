-- Provider configurations table
-- Stores API keys, base URLs, and timeouts for each provider
CREATE TABLE IF NOT EXISTS provider_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL UNIQUE CHECK (provider IN ('openai', 'anthropic', 'groq', 'ollama', 'lmstudio')),
  api_key       TEXT, -- Encrypted or plain (we'll store as-is for now, consider encryption in production)
  base_url      TEXT, -- For local providers like Ollama and LM Studio
  timeout_ms    INTEGER DEFAULT 60000,
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_provider_configs_provider ON provider_configs(provider);
CREATE INDEX idx_provider_configs_enabled ON provider_configs(is_enabled);

-- Insert default configs (they can be updated via UI)
INSERT INTO provider_configs (provider, timeout_ms, is_enabled) 
VALUES 
  ('openai', 60000, TRUE),
  ('anthropic', 60000, TRUE),
  ('groq', 60000, TRUE),
  ('ollama', 120000, TRUE),
  ('lmstudio', 120000, TRUE)
ON CONFLICT (provider) DO NOTHING;

