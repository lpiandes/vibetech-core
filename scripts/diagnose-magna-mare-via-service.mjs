/**
 * Simulates exact Home + API paths through WorkspaceService (same as running app).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { platformStore } from "../backend/core/platform/persistence/PostgresPlatformStore.js";
import { businessRecordToActivation } from "../backend/core/platform/persistence/platformMappers.js";
import { workspaceActivationRegistry } from "../backend/core/workspace/activation/WorkspaceActivationRegistry.js";
import { workspaceCompositionRegistry } from "../frontend/lib/workspace/WorkspaceCompositionRegistry.js";
import { WorkspaceService } from "../frontend/lib/workspace/WorkspaceService.ts";
import {
  getDigitalEmployeeReadinessEntry,
  isDigitalEmployeeOperationalReady,
} from "../backend/core/industries/employees/digitalEmployeeReadinessHelpers.js";

const businessId = "e58a7a52-969b-4377-a77e-98500e5bf648";
const PM = "pm_resident_prospect_coordinator";

const business = await platformStore.getBusinessById(businessId);
const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
const activation = businessRecordToActivation(business);
workspaceActivationRegistry.ensure(businessId, activation);

// Clear registry to mimic fresh process OR use existing
console.log("knowledgeCount:", knowledgeCount);
console.log("registry has:", workspaceCompositionRegistry.has(businessId));

function runHomePath() {
  const service = new WorkspaceService({ workspaceId: businessId, activation });
  service.refreshOperationalState(knowledgeCount);
  const home = service.loadBusinessHomeViewModel({ activeKnowledgeDocumentCount: knowledgeCount });
  const emp = service.getResidentProspectCoordinatorReadiness();
  return { home, emp, coordinatorReady: service.isResidentProspectCoordinatorReady() };
}

function runApiPath() {
  const service = new WorkspaceService({ workspaceId: businessId, activation });
  service.refreshOperationalState(knowledgeCount);
  const emp = service.getResidentProspectCoordinatorReadiness();
  return {
    allowed: isDigitalEmployeeOperationalReady(emp),
    status: emp?.status,
    blockers: emp?.blockers ?? [],
  };
}

const home = runHomePath();
const api = runApiPath();

console.log("\n=== HOME PATH ===");
console.log("checklist knowledge:", home.home.checklist.find((c) => c.id === "knowledge")?.complete);
console.log("checklist email:", home.home.checklist.find((c) => c.id === "email")?.complete);
console.log("showProspectInquiryForm:", home.home.showProspectInquiryForm);
console.log("coordinatorReady:", home.coordinatorReady);
console.log("employee status:", home.emp?.status);
console.log("employee blockers:", home.emp?.blockers);

console.log("\n=== API PATH ===");
console.log(api);

console.log("\n=== REGISTRY SNAPSHOT (no refresh) ===");
const connected = workspaceCompositionRegistry.get(businessId);
if (connected) {
  const emp = getDigitalEmployeeReadinessEntry(connected.employeeReadinessReport, PM);
  console.log("employee status:", emp?.status);
  console.log("snapshot email:", connected.connectedSystemsSnapshot?.connections?.find((c) => c.id === "business_email")?.status);
  console.log("runtime email:", connected.integrationPlatform?.connectionRuntime?.getConnectionByType("business_email")?.status);
}
