-- Durable AI Builder sessions (tenant-scoped, not process memory).

CREATE TABLE IF NOT EXISTS ai_builder_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'client_self_service'
    CHECK (mode IN (
      'new_business',
      'configure_existing_business',
      'expand_existing_business',
      'fix_business_problem',
      'internal_vibetech_build',
      'client_self_service'
    )),
  current_stage TEXT NOT NULL DEFAULT 'created'
    CHECK (current_stage IN (
      'created',
      'discovering',
      'researching',
      'interviewing',
      'assembling',
      'proposal_ready',
      'awaiting_review',
      'dry_run_ready',
      'awaiting_approval',
      'installing',
      'installed',
      'blocked',
      'failed',
      'archived'
    )),
  business_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  website_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_artifact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  unresolved_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_blueprints JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_components JSONB NOT NULL DEFAULT '[]'::jsonb,
  capability_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  conversation JSONB NOT NULL DEFAULT '[]'::jsonb,
  specification_id TEXT,
  specification_content_hash TEXT,
  installation_plan_id TEXT,
  installation_plan_hash TEXT,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_builder_sessions_business
  ON ai_builder_sessions (business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_builder_sessions_actor
  ON ai_builder_sessions (actor_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_builder_sessions_stage
  ON ai_builder_sessions (current_stage, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_builder_artifacts (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES ai_builder_sessions(session_id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  classification TEXT NOT NULL DEFAULT 'unknown',
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  mutates_canonical_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_builder_artifacts_session
  ON ai_builder_artifacts (session_id, created_at DESC);
