/**
 * End-to-end magna mare prospect loop via shared registry (mirrors running app).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { platformStore } from "../backend/core/platform/persistence/platformStore.js";
import { businessRecordToActivation } from "../backend/core/platform/persistence/platformMappers.js";
import { workspaceActivationRegistry } from "../backend/core/workspace/activation/WorkspaceActivationRegistry.js";
import { workspaceCompositionRegistry } from "../frontend/lib/workspace/WorkspaceCompositionRegistry.js";
import { ConnectedBusinessWorkspace } from "../frontend/lib/workspace/ConnectedBusinessWorkspace.ts";
import { refreshWorkspaceOperationalState } from "../backend/core/workspace/refreshWorkspaceOperationalState.js";
import { connectBusinessEmailDev } from "../backend/core/integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../backend/core/integration/ProspectInquiryOperatingLoopService.js";
import {
  getDigitalEmployeeReadinessEntry,
  isDigitalEmployeeOperationalReady,
} from "../backend/core/industries/employees/digitalEmployeeReadinessHelpers.js";

const businessId = "e58a7a52-969b-4377-a77e-98500e5bf648";
const PM = "pm_resident_prospect_coordinator";

function applyRefresh(connected, knowledgeCount) {
  const refreshed = refreshWorkspaceOperationalState({
    ctx: connected.ctx,
    installationResult: connected.installationResult,
    integrationPlatform: connected.integrationPlatform,
    activation: connected.activation,
    platformActiveKnowledgeCount: knowledgeCount,
  });
  if (Object.keys(refreshed).length > 0) Object.assign(connected, refreshed);
}

const business = await platformStore.getBusinessById(businessId);
if (!business) {
  console.error("business not found");
  process.exit(1);
}

const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
const activation = businessRecordToActivation(business);
workspaceActivationRegistry.ensure(businessId, activation);

const connected = workspaceCompositionRegistry.getOrCreate(businessId, ({ workspaceId }) => {
  return new ConnectedBusinessWorkspace({ workspaceId, activation });
});

if (connected.integrationPlatform?.connectionRuntime?.getConnectionByType("business_email")?.status !== "CONNECTED") {
  await connectBusinessEmailDev({
    integrationPlatform: connected.integrationPlatform,
    workspaceId: businessId,
    nowISO: new Date().toISOString(),
  });
}

applyRefresh(connected, knowledgeCount);

const emp = getDigitalEmployeeReadinessEntry(connected.employeeReadinessReport, PM);
const email = connected.integrationPlatform?.connectionRuntime?.getConnectionByType("business_email");

console.log("business:", business.name);
console.log("knowledgeCount:", knowledgeCount);
console.log("email:", email?.status, email?.capabilities);
console.log("platformKnowledgeCoverage:", connected.platformKnowledgeCoverage);
console.log("coordinator:", { status: emp?.status, blockers: emp?.blockers, ready: isDigitalEmployeeOperationalReady(emp) });

if (!isDigitalEmployeeOperationalReady(emp)) {
  console.error("FAIL: coordinator not operational ready");
  process.exit(1);
}

const result = await runProspectInquiryOperatingLoop({
  stack: connected.operatingStack ?? connected.ctx,
  integrationPlatform: connected.integrationPlatform,
  workspaceId: businessId,
  nowISO: new Date().toISOString(),
  inquiry: {
    name: "Magna Mare Verify",
    email: "verify@example.com",
    message: "Automated readiness verification inquiry.",
  },
});

console.log("prospect loop:", {
  ok: result.ok,
  duplicate: result.duplicate,
  workId: result.prospectFollowUpWork?.id,
  emailStatus: result.emailResult?.status,
});

if (!result.ok) {
  console.error("FAIL: prospect loop", result);
  process.exit(1);
}

console.log("PASS: magna mare coordinator ready and prospect loop succeeded");
