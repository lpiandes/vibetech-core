-- Design-partner readiness: worker heartbeat, CLIENT portal role, proof updates.

CREATE TABLE IF NOT EXISTS platform_worker_heartbeat (
  worker_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ok',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE capability_proof_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Expand membership roles for client/portal users (guardians, patients, etc.)
ALTER TABLE business_memberships DROP CONSTRAINT IF EXISTS business_memberships_role_check;
ALTER TABLE business_memberships
  ADD CONSTRAINT business_memberships_role_check
  CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER', 'CLIENT'));

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE invitations
  ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER', 'CLIENT'));
