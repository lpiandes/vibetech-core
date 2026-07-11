-- Tenant-scoped analytics definition persistence (definitions/targets/reports/selections/preferences).
-- Calculated metric values remain rederived projections — not stored here.

CREATE TABLE IF NOT EXISTS business_analytics_definitions (
  id TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_analytics_definitions_business
  ON business_analytics_definitions (business_id);
