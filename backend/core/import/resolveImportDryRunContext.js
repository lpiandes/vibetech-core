import { activateWorkspace } from "../workspace/activation/activateWorkspace.js";
import { resolveWorkspaceRuntimeSnapshots } from "../persistence/resolveWorkspaceRuntimeSnapshots.js";

function stackFromActivation(activated) {
  return (
    activated.operatingStack ?? {
      businessGraphRuntime: activated.ctx.businessGraphRuntime,
      requestRuntime: activated.ctx.requestRuntime,
      communicationPreferenceRuntime: activated.ctx.communicationPreferenceRuntime,
      interactionRuntime: activated.ctx.interactionRuntime,
      businessSubjectRuntime: activated.ctx.businessSubjectRuntime,
    }
  );
}

/**
 * Read-only workspace composition for import dry-run analysis.
 */
export async function resolveImportDryRunContext({ workspaceId, activation } = {}) {
  const runtimeSnapshots = await resolveWorkspaceRuntimeSnapshots(String(workspaceId));
  const activated = activateWorkspace({
    workspaceId: String(workspaceId),
    activation: activation ?? {},
    runtimeSnapshots,
  });

  return {
    stack: stackFromActivation(activated),
    installationResult: activated.installationResult,
  };
}
