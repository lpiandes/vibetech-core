CREATE TABLE IF NOT EXISTS import_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_artifacts_business
  ON import_artifacts (business_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_artifacts_storage_key
  ON import_artifacts (business_id, storage_key);

CREATE TABLE IF NOT EXISTS import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES import_artifacts(id),
  source_system TEXT NOT NULL,
  profile_id TEXT,
  status TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  column_mapping JSONB,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan_summary JSONB,
  committed_at TIMESTAMPTZ,
  committed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_committed_row INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_runs_business
  ON import_runs (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS import_run_row_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  row_number INT NOT NULL,
  external_id TEXT,
  resolved_party_id TEXT,
  match_tier TEXT,
  planned_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome_status TEXT NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_normalized JSONB,
  raw_unmapped JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_run_rows_run
  ON import_run_row_results (import_run_id, row_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_run_rows_unique
  ON import_run_row_results (import_run_id, row_number);
