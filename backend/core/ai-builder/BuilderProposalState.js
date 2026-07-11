import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Authoritative Builder proposal package persisted on the Builder session.
 * Visual preview is rebuildable and must not be required for durability.
 */
export function createBuilderProposalState({
  specification = null,
  assemblyPlan = null,
  plan = null,
  dryRunResult = null,
  approval = null,
  installation = null,
  change = null,
  updatedAt = new Date().toISOString(),
} = {}) {
  return deepFreeze({
    specification: specification ?? null,
    assemblyPlan: assemblyPlan ?? null,
    plan: plan ?? null,
    dryRunResult: dryRunResult ?? null,
    approval: approval ?? null,
    installation: installation ?? null,
    change: change ?? null,
    updatedAt: String(updatedAt),
  });
}

export function readProposalStateFromSession(session) {
  const raw = session?.metadata?.proposalState;
  if (!raw || typeof raw !== "object") return null;
  return createBuilderProposalState(raw);
}

export function withProposalStateMetadata(session, proposalState, extraMetadata = {}) {
  return {
    ...session.metadata,
    ...extraMetadata,
    proposalState: createBuilderProposalState(proposalState),
  };
}
