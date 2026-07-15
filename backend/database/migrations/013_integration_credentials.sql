CREATE TABLE IF NOT EXISTS integration_credentials (
  workspace_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  secrets_ciphertext TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_workspace
  ON integration_credentials (workspace_id);
