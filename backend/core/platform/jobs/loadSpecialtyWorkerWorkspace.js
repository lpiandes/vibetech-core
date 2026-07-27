/**
 * Load a workspace for specialty schedule jobs (Node worker, no Next.js).
 */
import { activateWorkspace } from "../../workspace/activation/activateWorkspace.js";
import { getWorkspacePersistence } from "../../persistence/createWorkspacePersistence.js";
import { loadRuntimeSnapshotsMap } from "../../persistence/createWorkspacePersistence.js";
import { persistAffectedRuntimes } from "../../persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { BusinessKnowledgeService } from "../knowledge/BusinessKnowledgeService.js";

export async function loadSpecialtyWorkerWorkspace({
  businessId,
  platformStore,
  nowISO = () => new Date().toISOString(),
  employeeId = null,
} = {}) {
  if (!platformStore || !businessId) {
    return deepFreeze({ ok: false, reason: "platform_store_and_business_required" });
  }

  const persistence = getWorkspacePersistence();
  let runtimeSnapshots = {};
  try {
    runtimeSnapshots = await loadRuntimeSnapshotsMap(businessId, persistence);
  } catch {
    runtimeSnapshots = {};
  }

  const connected = activateWorkspace({
    workspaceId: String(businessId),
    nowISO: typeof nowISO === "function" ? nowISO() : nowISO,
    runtimeSnapshots,
  });

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const employees = Array.isArray(installation?.configuration?.employees)
    ? installation.configuration.employees
    : [];
  const employee = employeeId
    ? (employees.find((e) => String(e.employeeId ?? e.id) === String(employeeId))
      ?? { employeeId, label: employeeId })
    : null;

  let knowledgeDocuments = [];
  try {
    const knowledge = new BusinessKnowledgeService({ store: platformStore });
    knowledgeDocuments = await knowledge.listOperationalDocuments(businessId);
  } catch {
    knowledgeDocuments = [];
  }

  return {
    ok: true,
    connected,
    workRuntime: connected.ctx.workRuntime,
    automationRuntime: connected.ctx.automationRuntime,
    approvalRuntime: connected.ctx.approvalRuntime ?? null,
    integrationHub: connected.integrationPlatform?.hub ?? null,
    employee,
    employees,
    installation,
    knowledgeDocuments,
    async persistWork() {
      await persistAffectedRuntimes({
        workspaceId: String(businessId),
        stack: connected.operatingStack ?? connected.ctx,
        integrationPlatform: connected.integrationPlatform,
        kinds: [RUNTIME_SNAPSHOT_KINDS.WORK, RUNTIME_SNAPSHOT_KINDS.AUTOMATION],
      });
    },
  };
}
