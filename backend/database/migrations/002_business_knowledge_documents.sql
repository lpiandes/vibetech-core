CREATE TABLE IF NOT EXISTS business_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('PDF', 'DOCX', 'TXT', 'MARKDOWN')),
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'failed', 'deleted')),
  text_extraction_status TEXT NOT NULL DEFAULT 'skipped'
    CHECK (text_extraction_status IN ('pending', 'succeeded', 'failed', 'skipped')),
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_docs_storage_key
  ON business_knowledge_documents (business_id, storage_key);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_business_active
  ON business_knowledge_documents (business_id, created_at DESC)
  WHERE status = 'ready' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_uploader
  ON business_knowledge_documents (uploaded_by_user_id);
