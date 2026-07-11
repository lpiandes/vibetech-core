-- Business OS installer durability: operation checkpoints, approvals, expanded statuses.

ALTER TABLE business_os_specifications
  DROP CONSTRAINT IF EXISTS business_os_specifications_status_check;

ALTER TABLE business_os_specifications
  ADD CONSTRAINT business_os_specifications_status_check
  CHECK (status IN (
    'draft', 'discovery', 'proposed', 'validated', 'dry_run_ready',
    'approved', 'installing', 'installed', 'superseded', 'failed', 'rejected'
  ));

CREATE TABLE IF NOT EXISTS business_os_installation_operations (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  installation_id TEXT REFERENCES business_os_installations(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  target TEXT,
  status TEXT NOT NULL
    CHECK (status IN (
      'pending', 'applied', 'noop', 'deferred', 'requires_setup',
      'recorded_gap', 'failed', 'skipped'
    )),
  reason TEXT,
  risk TEXT,
  reversible BOOLEAN NOT NULL DEFAULT TRUE,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  checkpoint_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_business_os_installation_operations_business
  ON business_os_installation_operations (business_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS business_os_installation_approvals (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  approval_id TEXT NOT NULL,
  specification_id TEXT NOT NULL,
  specification_version INTEGER NOT NULL,
  specification_content_hash TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'revoked', 'stale', 'consumed')),
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, approval_id)
);

CREATE INDEX IF NOT EXISTS idx_business_os_installation_approvals_business
  ON business_os_installation_approvals (business_id, approved_at DESC);

ALTER TABLE business_os_installations
  ADD COLUMN IF NOT EXISTS plan_hash TEXT,
  ADD COLUMN IF NOT EXISTS approval_id TEXT,
  ADD COLUMN IF NOT EXISTS dry_run JSONB NOT NULL DEFAULT '{}'::jsonb;
