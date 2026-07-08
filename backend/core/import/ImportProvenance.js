import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { formatExternalReference } from "./ImportSourceDescriptor.js";

export function buildImportProvenanceEntry({
  sourceSystem,
  externalId,
  importRunId,
  rowNumber,
  importedAt,
} = {}) {
  const externalReference = formatExternalReference(sourceSystem, externalId);
  return deepFreeze({
    sourceSystem: String(sourceSystem ?? ""),
    externalId: String(externalId ?? ""),
    externalReference: externalReference ?? null,
    importRunId: String(importRunId ?? ""),
    rowNumber: Number(rowNumber ?? 0),
    importedAt: String(importedAt ?? new Date().toISOString()),
  });
}
