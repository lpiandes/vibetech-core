/**
 * Reproduces terminal sequence: connect email → home load → API guard
 * using the same refresh assignment pattern as WorkspaceService.
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
  if (refreshed.connectedSystemsSnapshot) connected.connectedSystemsSnapshot = refreshed.connectedSystemsSnapshot;
  if (refreshed.connectionDependencyProjection) connected.connectionDependencyProjection = refreshed.connectionDependencyProjection;
  if (refreshed.employeeReadinessReport) connected.employeeReadinessReport = refreshed.employeeReadinessReport;
  if (refreshed.platformKnowledgeCoverage) connected.platformKnowledgeCoverage = refreshed.platformKnowledgeCoverage;
  return refreshed;
}

function homeVm(connected, knowledgeCount) {
  const connections = connected.connectedSystemsSnapshot?.connections ?? [];
  const emailConnected = connections.some(
    (c) => String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
  );
  const emp = getDigitalEmployeeReadinessEntry(connected.employeeReadinessReport, PM);
  const coordinatorReady = isDigitalEmployeeOperationalReady(emp);
  const hasInquiry = (connected.ctx.requestRuntime.getRequests?.() ?? []).some(
    (r) => String(r.requestType) === "PROSPECT_INQUIRY",
  );
  return {
    knowledgeComplete: knowledgeCount > 0,
    emailConnected,
    coordinatorReady,
    showForm: coordinatorReady && !hasInquiry,
    empStatus: emp?.status,
    blockers: emp?.blockers ?? [],
  };
}

function apiGuard(connected, knowledgeCount) {
  applyRefresh(connected, knowledgeCount);
  const emp = getDigitalEmployeeReadinessEntry(connected.employeeReadinessReport, PM);
  return { allowed: isDigitalEmployeeOperationalReady(emp), status: emp?.status, blockers: emp?.blockers ?? [] };
}

async function connectEmail(connected, knowledgeCount) {
  await connectBusinessEmailDev({
    integrationPlatform: connected.integrationPlatform,
    workspaceId: businessId,
    nowISO: new Date().toISOString(),
  });
  const count =
    knowledgeCount ??
    connected.platformKnowledgeCoverage?.activeDocumentCount ??
    0;
  applyRefresh(connected, count);
}

const business = await platformStore.getBusinessById(businessId);
const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
const activation = businessRecordToActivation(business);
workspaceActivationRegistry.ensure(businessId, activation);

// Fresh composition like server restart
workspaceCompositionRegistry.clear(businessId);
const connected = workspaceCompositionRegistry.getOrCreate(businessId, ({ workspaceId }) => {
  return new ConnectedBusinessWorkspace({ workspaceId, activation });
});

console.log("=== STEP 0: initial home (no refresh) ===");
console.log(homeVm(connected, knowledgeCount));

console.log("\n=== STEP 1: POST business-email ===");
await connectEmail(connected, knowledgeCount);
console.log("after connect, before home refresh:");
console.log(homeVm(connected, knowledgeCount));

console.log("\n=== STEP 2: GET home (refresh + load) ===");
applyRefresh(connected, knowledgeCount);
const home = homeVm(connected, knowledgeCount);
console.log(home);

console.log("\n=== STEP 3: POST prospect-inquiries guard ===");
const api = apiGuard(connected, knowledgeCount);
console.log(api);

console.log("\n=== MISMATCH? ===");
console.log("form visible but API blocked:", home.showForm && !api.allowed);
