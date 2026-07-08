import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Provider-owned setup guidance contract.
 */
export function createProviderSetupGuidance({
  title,
  summary,
  estimatedTime,
  prerequisites,
  steps,
  permissionsRequested,
  verificationMethod,
  commonProblems,
  reconnectInstructions,
  documentationReference,
} = {}) {
  return deepFreeze({
    title: String(title ?? ""),
    summary: String(summary ?? ""),
    estimatedTime: String(estimatedTime ?? ""),
    prerequisites: deepFreeze(Array.isArray(prerequisites) ? prerequisites.map(String) : []),
    steps: deepFreeze(Array.isArray(steps) ? steps.map(String) : []),
    permissionsRequested: deepFreeze(Array.isArray(permissionsRequested) ? permissionsRequested.map(String) : []),
    verificationMethod: String(verificationMethod ?? ""),
    commonProblems: deepFreeze(Array.isArray(commonProblems) ? commonProblems.map(String) : []),
    reconnectInstructions: String(reconnectInstructions ?? ""),
    documentationReference: String(documentationReference ?? ""),
  });
}
