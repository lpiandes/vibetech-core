import { RUNTIME_SNAPSHOT_KINDS } from "./RuntimeSnapshotKinds.js";

function exportKind({ kind, stack, integrationPlatform }) {
  switch (kind) {
    case RUNTIME_SNAPSHOT_KINDS.CONNECTION:
      return integrationPlatform?.connectionRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH:
      return stack?.businessGraphRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT:
      return stack?.businessSubjectRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.REQUEST:
      return stack?.requestRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.INTERACTION:
      return stack?.interactionRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.WORK:
      return stack?.workRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.COMMUNICATION:
      return stack?.communicationRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.COMMUNICATION_PREFERENCE:
      return stack?.communicationPreferenceRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.ANALYTICS:
      return stack?.analyticsRuntime?.exportState?.() ?? null;
    case RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE:
      return stack?.intelligenceCandidateRuntime?.exportState?.() ?? null;
    default:
      return null;
  }
}

export function exportRuntimeSnapshots({ stack, integrationPlatform, kinds }) {
  return (kinds ?? [])
    .map((kind) => {
      const state = exportKind({ kind, stack, integrationPlatform });
      if (state === null || state === undefined) return null;
      return { kind, state, schemaVersion: 1 };
    })
    .filter(Boolean);
}
