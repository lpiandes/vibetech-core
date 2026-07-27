-- Daily AI ask quotas (Ask / builder chat + per-automation NL edits).

CREATE TABLE IF NOT EXISTS ai_ask_quota_usage (
  quota_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  day_utc DATE NOT NULL,
  user_id TEXT,
  business_id TEXT,
  employee_id TEXT,
  used_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_ask_quota_day ON ai_ask_quota_usage (day_utc);
CREATE INDEX IF NOT EXISTS idx_ai_ask_quota_user_day ON ai_ask_quota_usage (user_id, day_utc);
