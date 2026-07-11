-- Durable support access sessions and access-request records.

CREATE TABLE IF NOT EXISTS support_access_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'read_only'
    CHECK (mode IN ('read_only', 'elevated')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  permanent_membership_granted BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_access_sessions_business
  ON support_access_sessions (business_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_access_sessions_admin
  ON support_access_sessions (admin_user_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS business_access_requests (
  id TEXT PRIMARY KEY,
  access_request_id TEXT NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_kind TEXT NOT NULL,
  requested_permission TEXT,
  requested_module_id TEXT,
  requested_role_id TEXT,
  record_scope TEXT,
  reason TEXT NOT NULL,
  duration_hours INTEGER,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  work_item_id TEXT,
  approval_request_id TEXT,
  current_access JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, access_request_id)
);

CREATE INDEX IF NOT EXISTS idx_business_access_requests_business
  ON business_access_requests (business_id, status, created_at DESC);
