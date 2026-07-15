/**
 * Import Google Drive (or S3-compatible document storage) into Knowledge.
 * External storage is a bridge — Knowledge remains SoT after owner confirm.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { normalizeKnowledgeCategoryIds } from "../../platform/knowledge/universalKnowledgeCategories.js";

export function proposeDriveImportCandidates({
  files = [],
  defaultCategoryIds = ["SOP"],
} = {}) {
  const cats = normalizeKnowledgeCategoryIds(defaultCategoryIds);
  return deepFreeze(
    (Array.isArray(files) ? files : [])
      .map((file, index) => {
        const id = String(file.id ?? file.fileId ?? `drive_${index}`);
        const title = String(file.name ?? file.title ?? "Untitled").trim() || "Untitled";
        const mimeType = String(file.mimeType ?? "application/octet-stream");
        return deepFreeze({
          id,
          title,
          mimeType,
          externalUrl: file.webViewLink ?? file.url ?? null,
          proposedCategoryIds: cats,
          status: "proposed",
          note: "Import into Knowledge (owner confirm). Drive is not the live source of truth.",
        });
      })
      .filter((entry) => entry.id),
  );
}

export async function importDriveCandidatesToKnowledge({
  businessId,
  userId,
  candidates = [],
  categoryIds = [],
  knowledgeService,
  fetchFileBytes,
} = {}) {
  if (!knowledgeService?.uploadDocument) {
    throw new Error("Knowledge service required for Drive import.");
  }
  if (typeof fetchFileBytes !== "function") {
    throw new Error("fetchFileBytes required for Drive import.");
  }

  const imported = [];
  const failed = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    try {
      const buffer = await fetchFileBytes(candidate);
      if (!Buffer.isBuffer(buffer) || !buffer.length) {
        failed.push({ id: candidate.id, reason: "empty_file" });
        continue;
      }
      const document = await knowledgeService.uploadDocument({
        businessId,
        userId,
        buffer,
        filename: `${candidate.title || candidate.id}.pdf`,
        mimeType: candidate.mimeType || "application/pdf",
        title: candidate.title,
        categoryIds: candidate.proposedCategoryIds?.length
          ? candidate.proposedCategoryIds
          : categoryIds,
      });
      imported.push({
        driveFileId: candidate.id,
        knowledgeDocumentId: document.id,
        categoryIds: document.categoryIds ?? [],
      });
    } catch (err) {
      failed.push({
        id: candidate.id,
        reason: err instanceof Error ? err.message : "import_failed",
      });
    }
  }

  return deepFreeze({
    contract: "DriveToKnowledgeImport/v1",
    imported,
    failed,
    winClaim: "Connect document storage → import into Knowledge. VIBETech remains SoT.",
  });
}
