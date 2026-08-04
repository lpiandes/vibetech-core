-- Durable plain-text body for Knowledge View (and ops AI) when blob storage is ephemeral (/tmp on Vercel).
ALTER TABLE business_knowledge_documents
  ADD COLUMN IF NOT EXISTS content_text TEXT;
