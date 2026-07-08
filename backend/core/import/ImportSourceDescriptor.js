import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createImportSourceDescriptor({
  workspaceId,
  sourceSystem,
  sourceType = "csv",
  artifactId,
  filename,
  contentHash,
  mimeType,
  uploadedAt,
} = {}) {
  if (!workspaceId) throw new Error("ImportSourceDescriptor: workspaceId required.");
  if (!sourceSystem) throw new Error("ImportSourceDescriptor: sourceSystem required.");
  if (!artifactId) throw new Error("ImportSourceDescriptor: artifactId required.");

  return deepFreeze({
    workspaceId: String(workspaceId),
    sourceSystem: String(sourceSystem),
    sourceType: String(sourceType ?? "csv"),
    artifactId: String(artifactId),
    filename: String(filename ?? ""),
    contentHash: String(contentHash ?? ""),
    mimeType: String(mimeType ?? "text/csv"),
    uploadedAt: String(uploadedAt ?? new Date().toISOString()),
  });
}

export function formatExternalReference(sourceSystem, externalId) {
  const system = String(sourceSystem ?? "").trim().toLowerCase();
  const id = String(externalId ?? "").trim();
  if (!system || !id) return null;
  return `${system}:${id}`;
}
