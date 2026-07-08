CREATE TABLE IF NOT EXISTS workspace_runtime_snapshots (
  workspace_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  runtime_kind TEXT NOT NULL,
  schema_version INT NOT NULL DEFAULT 1,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, runtime_kind)
);

CREATE INDEX IF NOT EXISTS idx_workspace_runtime_snapshots_workspace
  ON workspace_runtime_snapshots (workspace_id);
