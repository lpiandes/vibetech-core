import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createBuilderEvidence({
  evidenceId,
  kind,
  label,
  source,
  confidence = 0.5,
  payload = {},
  retrievedAt = new Date().toISOString(),
  rejected = false,
  mutatesCanonicalData = false,
} = {}) {
  if (!evidenceId) throw new Error("BuilderEvidence: evidenceId required.");
  return deepFreeze({
    evidenceId: String(evidenceId),
    kind: String(kind),
    label: String(label ?? kind),
    source: String(source ?? "unknown"),
    confidence: Number(confidence),
    payload: deepFreeze(payload && typeof payload === "object" ? { ...payload } : {}),
    retrievedAt: String(retrievedAt),
    rejected: Boolean(rejected),
    mutatesCanonicalData: Boolean(mutatesCanonicalData),
  });
}
