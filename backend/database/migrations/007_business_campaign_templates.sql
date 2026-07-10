CREATE TABLE IF NOT EXISTS business_campaign_templates (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  subject_line TEXT NOT NULL DEFAULT '',
  preview_text TEXT,
  cta TEXT,
  guardrails JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_template_id TEXT,
  approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deleted')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_campaign_templates_business_active
  ON business_campaign_templates (business_id, updated_at DESC)
  WHERE status = 'active' AND deleted_at IS NULL;
