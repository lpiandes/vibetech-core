-- Business OS Builder durable configuration (tenant-scoped, not BusinessSubject).

CREATE TABLE IF NOT EXISTS business_os_specifications (
  id TEXT PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  specification_id TEXT NOT NULL,
  specification_version INTEGER NOT NULL DEFAULT 1,
  schema_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL
    CHECK (status IN (
      'discovery', 'proposed', 'validated', 'dry_run_ready',
      'approved', 'installed', 'superseded', 'rejected'
    )),
  content_hash TEXT NOT NULL,
  specification JSONB NOT NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, specification_id, specification_version)
);

CREATE INDEX IF NOT EXISTS idx_business_os_specifications_business
  ON business_os_specifications (business_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS business_os_installations (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  specification_row_id TEXT REFERENCES business_os_specifications(id) ON DELETE SET NULL,
  specification_id TEXT NOT NULL,
  specification_version INTEGER NOT NULL,
  specification_content_hash TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'installed'
    CHECK (status IN ('dry_run', 'approved', 'installing', 'installed', 'failed', 'superseded')),
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_checkpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  installed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_os_installations_business
  ON business_os_installations (business_id);

CREATE TABLE IF NOT EXISTS business_builder_sessions (
  id TEXT PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'discovery'
    CHECK (status IN (
      'discovery', 'proposed', 'review', 'dry_run', 'approved', 'installed', 'abandoned'
    )),
  mode TEXT NOT NULL DEFAULT 'operator'
    CHECK (mode IN ('operator', 'client')),
  discovery JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  specification_row_id TEXT REFERENCES business_os_specifications(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_builder_sessions_business
  ON business_builder_sessions (business_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS business_capability_proposals (
  id TEXT PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL,
  requested_outcome TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  affected_businesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_universal_capability JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_package_extension JSONB NOT NULL DEFAULT '{}'::jsonb,
  why_insufficient TEXT,
  safety_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'deferred', 'rejected', 'implemented')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_business_capability_proposals_business
  ON business_capability_proposals (business_id, updated_at DESC);
