import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const KNOWLEDGE_SOURCE_TYPES = {
  PDF: "PDF",
  DOCX: "DOCX",
  TXT: "TXT",
  MARKDOWN: "MARKDOWN",
};

export const KNOWLEDGE_DOCUMENT_STATUS = {
  READY: "ready",
  FAILED: "failed",
  DELETED: "deleted",
};

export function mapKnowledgeDocumentRow(row) {
  if (!row) return null;
  return deepFreeze({
    id: String(row.id),
    businessId: String(row.business_id),
    title: String(row.title),
    originalFilename: String(row.original_filename),
    storageKey: String(row.storage_key),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sourceType: String(row.source_type),
    status: String(row.status),
    textExtractionStatus: String(row.text_extraction_status ?? "skipped"),
    uploadedByUserId: row.uploaded_by_user_id ? String(row.uploaded_by_user_id) : null,
    uploadedByName: row.uploaded_by_name ? String(row.uploaded_by_name) : null,
    deletedAt: row.deleted_at?.toISOString?.() ?? row.deleted_at ?? null,
    deletedByUserId: row.deleted_by_user_id ? String(row.deleted_by_user_id) : null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  });
}

export function toPublicKnowledgeDocument(doc) {
  if (!doc) return null;
  return deepFreeze({
    id: doc.id,
    title: doc.title,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    sourceType: doc.sourceType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    textExtractionStatus: doc.textExtractionStatus,
    uploadedBy: doc.uploadedByUserId
      ? deepFreeze({
          id: doc.uploadedByUserId,
          name: doc.uploadedByName ?? "Team member",
        })
      : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}
