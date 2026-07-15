-- Owner-facing Knowledge tags (universal categories + industry overlays).
ALTER TABLE business_knowledge_documents
  ADD COLUMN IF NOT EXISTS category_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_category_ids
  ON business_knowledge_documents USING GIN (category_ids);
