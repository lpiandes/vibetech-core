ALTER TABLE import_run_row_results
  ADD COLUMN IF NOT EXISTS commit_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS commit_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS committed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commit_error JSONB,
  ADD COLUMN IF NOT EXISTS commit_result JSONB;

CREATE INDEX IF NOT EXISTS idx_import_run_rows_commit_status
  ON import_run_row_results (import_run_id, commit_status, row_number);
