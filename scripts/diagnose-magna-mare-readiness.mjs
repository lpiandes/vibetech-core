import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { platformStore } from "../backend/core/platform/persistence/platformStore.js";
import { workspaceCompositionRegistry } from "../frontend/lib/workspace/WorkspaceCompositionRegistry.js";
import { workspaceActivationRegistry } from "../backend/core/workspace/activation/WorkspaceActivationRegistry.js";
import { businessRecordToActivation } from "../backend/core/platform/persistence/platformMappers.js";
import { ConnectedBusinessWorkspace } from "../frontend/lib/workspace/ConnectedBusinessWorkspace.ts";
import { refreshWorkspaceOperationalState } from "../backend/core/workspace/refreshWorkspaceOperationalState.js";
import { connectBusinessEmailDev } from "../backend/core/integrations/use-cases/connectBusinessEmailDev.js";
import {
  getDigitalEmployeeReadinessEntry,
  isDigitalEmployeeOperationalReady,
} from "../backend/core/industries/employees/digitalEmployeeReadinessHelpers.js";

const businessId = "e58a7a52-969b-4377-a77e-98500e5bf648";
const PM = "pm_resident_prospect_coordinator";

function snapshot(connected, label) {
  const emp = getDigitalEmployeeReadinessEntry(connected.employeeReadinessReport, PM);
  const email = connected.integrationPlatform?.connectionRuntime?.getConnectionByType("business_email");
  console.log(`\n--- ${label} ---`);
  console.log("email:", email?.status ?? "missing", email?.capabilities ?? []);
  console.log("platformKnowledgeCoverage:", connected.platformKnowledgeCoverage);
  console.log("employee status:", emp?.status ?? "missing");
  console.log("blockers:", emp?.blockers ?? []);
  console.log("isOperationalReady:", isDigitalEmployeeOperationalReady(emp));
  console.log(
    "snapshot email:",
    connected.connectedSystemsSnapshot?.connections?.find((c) => c.id === "business_email")?.status,
  );
}

function simulateHomeLoad(serviceConnected, knowledgeCount) {
  const refreshed = refreshWorkspaceOperationalState({
    ctx: serviceConnected.ctx,
    installationResult: serviceConnected.installationResult,
    integrationPlatform: serviceConnected.integrationPlatform,
    activation: serviceConnected.activation,
    platformActiveKnowledgeCount: knowledgeCount,
  });
  Object.assign(serviceConnected, refreshed);

  const connections = serviceConnected.connectedSystemsSnapshot?.connections ?? [];
  const emailConnected = connections.some(
    (c) => String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
  );
  const coordinatorReady = isDigitalEmployeeOperationalReady(
    getDigitalEmployeeReadinessEntry(serviceConnected.employeeReadinessReport, PM),
  );
  const showProspectInquiryForm =
    coordinatorReady &&
    !(serviceConnected.ctx.requestRuntime.getRequests?.() ?? []).some(
      (r) => String(r.requestType) === "PROSPECT_INQUIRY",
    );

  return { emailConnected, coordinatorReady, showProspectInquiryForm, knowledgeCount };
}

function simulateApiGuard(serviceConnected, knowledgeCount) {
  const refreshed = refreshWorkspaceOperationalState({
    ctx: serviceConnected.ctx,
    installationResult: serviceConnected.installationResult,
    integrationPlatform: serviceConnected.integrationPlatform,
    activation: serviceConnected.activation,
    platformActiveKnowledgeCount: knowledgeCount,
  });
  Object.assign(serviceConnected, refreshed);
  const emp = getDigitalEmployeeReadinessEntry(serviceConnected.employeeReadinessReport, PM);
  return { allowed: isDigitalEmployeeOperationalReady(emp), emp };
}

const business = await platformStore.getBusinessById(businessId);
if (!business) {
  console.error("business not found");
  process.exit(1);
}

const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
const activation = businessRecordToActivation(business);
workspaceActivationRegistry.ensure(businessId, activation);

console.log("Postgres knowledgeCount:", knowledgeCount);
console.log("Registry has composition BEFORE:", workspaceCompositionRegistry.has(businessId));

const connected = workspaceCompositionRegistry.getOrCreate(businessId, ({ workspaceId }) => {
  return new ConnectedBusinessWorkspace({ workspaceId, activation });
});

snapshot(connected, "A: registry composition on first access (before explicit refresh)");

const homeBefore = simulateHomeLoad(connected, knowledgeCount);
console.log("Home VM (before email connect):", homeBefore);

if (connected.integrationPlatform?.connectionRuntime?.getConnectionByType("business_email")?.status !== "CONNECTED") {
  await connectBusinessEmailDev({
    integrationPlatform: connected.integrationPlatform,
    workspaceId: businessId,
    nowISO: new Date().toISOString(),
  });
  refreshWorkspaceOperationalState({
    ctx: connected.ctx,
    installationResult: connected.installationResult,
    integrationPlatform: connected.integrationPlatform,
    activation: connected.activation,
    platformActiveKnowledgeCount: knowledgeCount,
  });
}

snapshot(connected, "B: after email connect + refresh");

const homeAfter = simulateHomeLoad(connected, knowledgeCount);
const apiAfter = simulateApiGuard(connected, knowledgeCount);
console.log("\nHome VM (after connect):", homeAfter);
console.log("API guard (after connect):", { allowed: apiAfter.allowed, status: apiAfter.emp?.status });

// Simulate stale employee report: connect email refreshed with knowledge 0
const stale = workspaceCompositionRegistry.getOrCreate(`stale_${businessId}`, ({ workspaceId }) => {
  return new ConnectedBusinessWorkspace({ workspaceId: businessId, activation });
});
await connectBusinessEmailDev({
  integrationPlatform: stale.integrationPlatform,
  workspaceId: businessId,
  nowISO: new Date().toISOString(),
});
refreshWorkspaceOperationalState({
  ctx: stale.ctx,
  installationResult: stale.installationResult,
  integrationPlatform: stale.integrationPlatform,
  activation: stale.activation,
  platformActiveKnowledgeCount: 0,
});
const homeStale = simulateHomeLoad(stale, knowledgeCount);
const apiStale = simulateApiGuard(stale, knowledgeCount);
console.log("\n=== STALE SCENARIO: email connected with refresh(0), home load with postgres count ===");
console.log("Home VM:", homeStale);
console.log("API guard:", { allowed: apiStale.allowed, status: apiStale.emp?.status, blockers: apiStale.emp?.blockers });
