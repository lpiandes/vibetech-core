export function readContentAsString({ sourceType, content } = {}) {
  const text = String(content ?? "");
  if (!text.trim().length) {
    throw new Error("KnowledgeIngestionEngine: content must not be empty.");
  }

  // DOCX/PDF are detected but not parsed yet (parser deferred).
  if (sourceType === "DOCX") {
    throw new Error("KnowledgeIngestionEngine: DOCX parsing is not implemented in Sprint 3.");
  }
  if (sourceType === "PDF") {
    throw new Error("KnowledgeIngestionEngine: PDF parsing is not implemented in Sprint 3.");
  }

  return text;
}

