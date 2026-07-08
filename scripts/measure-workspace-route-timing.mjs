#!/usr/bin/env node
/**
 * Measure server-side workspace request path timings (cold vs warm registry).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { runMigrations } from "../backend/core/platform/db/migrate.js";
import { closePool } from "../backend/core/platform/db/pool.js";
import { platformStore } from "../backend/core/platform/persistence/PostgresPlatformStore.js";
import { businessRecordToActivation } from "../backend/core/platform/persistence/platformMappers.js";
import { authorizeBusinessAccess } from "../backend/core/platform/authorizeBusinessAccess.js";
import { loadRuntimeSnapshotsMap } from "../backend/core/persistence/createWorkspacePersistence.js";
import { workspaceCompositionRegistry } from "../frontend/lib/workspace/WorkspaceCompositionRegistry.js";
import { workspaceActivationRegistry } from "../backend/core/workspace/activation/WorkspaceActivationRegistry.js";
import { activateWorkspace } from "../backend/core/workspace/activation/activateWorkspace.js";
import { CommunicationViewAdapter } from "../backend/core/communications/views/CommunicationViewAdapter.js";
import { buildCommunicationThreadDetail } from "../backend/core/communications/views/buildCommunicationThreadDetail.js";
import { ConnectionCenterViewAdapter } from "../backend/core/workspace/views/ConnectionCenterViewAdapter.js";
import { TeamViewAdapter } from "../backend/core/team/views/TeamViewAdapter.js";
import { refreshWorkspaceOperationalState } from "../backend/core/workspace/refreshWorkspaceOperationalState.js";

const businessId =
  process.env.MEASURE_BUSINESS_ID ?? "e58a7a52-969b-4377-a77e-98500e5bf648";

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  return { label, ms: Math.round(performance.now() - start), result };
}

function printStage(label, ms) {
  console.log(`${label.padEnd(28)} ${String(ms).padStart(5)}ms`);
}

async function measureRoute(label, fn) {
  const { ms, result } = await timed(label, fn);
  printStage(label, ms);
  return result;
}

async function simulateGetAuthorizedWorkspace({ userId, skipSnapshotsIfWarm = true }) {
  const stages = {};

  let t = performance.now();
  const business = await platformStore.getBusinessById(businessId);
  await platformStore.getMembership(userId, businessId);
  stages.AUTH = Math.round(performance.now() - t);

  const activation = businessRecordToActivation(business);
  workspaceActivationRegistry.ensure(businessId, activation);

  const registryWarm = workspaceCompositionRegistry.has(businessId);

  t = performance.now();
  let runtimeSnapshots;
  if (!skipSnapshotsIfWarm || !registryWarm) {
    runtimeSnapshots = await loadRuntimeSnapshotsMap(businessId);
  }
  stages.SNAPSHOT_LOAD = registryWarm && skipSnapshotsIfWarm ? 0 : Math.round(performance.now() - t);

  t = performance.now();
  const connected = workspaceCompositionRegistry.getOrCreate(businessId, ({ workspaceId }) => {
    return activateWorkspace({ workspaceId, activation, runtimeSnapshots });
  });
  stages.WORKSPACE_ACTIVATION = Math.round(performance.now() - t);

  return { connected, stages, registryWarm };
}

function refreshOperationalState(connected, knowledgeDocumentCount) {
  const refreshed = refreshWorkspaceOperationalState({
    ctx: connected.ctx,
    installationResult: connected.installationResult,
    integrationPlatform: connected.integrationPlatform,
    activation: connected.activation,
    platformActiveKnowledgeCount: knowledgeDocumentCount,
  });
  Object.assign(connected, refreshed);
}

async function routeHome(connected) {
  const stages = {};
  let t = performance.now();
  const [knowledgeDocumentCount, teamInviteChecklistComplete] = await Promise.all([
    platformStore.countActiveKnowledgeDocuments(businessId),
    platformStore.isTeamInviteChecklistComplete(businessId),
  ]);
  stages.KNOWLEDGE_COUNT = Math.round(performance.now() - t);

  t = performance.now();
  refreshOperationalState(connected, knowledgeDocumentCount);
  stages.REFRESH_OPERATIONAL_STATE = Math.round(performance.now() - t);

  t = performance.now();
  const connections = connected.connectedSystemsSnapshot?.connections ?? [];
  const emailConnected = connections.some(
    (c) => String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
  );
  void { knowledgeDocumentCount, teamInviteChecklistComplete, emailConnected };
  stages.VIEW_MODEL = Math.round(performance.now() - t);

  return stages;
}

async function routeIntegrations(connected) {
  const stages = {};
  let t = performance.now();
  const knowledgeDocumentCount = await platformStore.countActiveKnowledgeDocuments(businessId);
  stages.KNOWLEDGE_COUNT = Math.round(performance.now() - t);

  t = performance.now();
  refreshOperationalState(connected, knowledgeDocumentCount);
  stages.REFRESH_OPERATIONAL_STATE = Math.round(performance.now() - t);

  t = performance.now();
  new ConnectionCenterViewAdapter().translate({
    connectedSystemsSnapshot: connected.connectedSystemsSnapshot,
    connectionDependencyProjection: connected.connectionDependencyProjection,
    installationResult: connected.installationResult,
  });
  stages.VIEW_MODEL = Math.round(performance.now() - t);

  return stages;
}

async function routeInbox(connected) {
  const t = performance.now();
  new CommunicationViewAdapter().translate({
    communicationRuntime: connected.ctx.communicationRuntime,
    workRuntime: connected.ctx.workRuntime,
    teamRuntime: connected.ctx.teamRuntime,
    companyWorkspaceRuntime: connected.ctx.companyRuntime,
  });
  return { VIEW_MODEL: Math.round(performance.now() - t) };
}

async function routeInboxDetail(connected) {
  const vm = new CommunicationViewAdapter().translate({
    communicationRuntime: connected.ctx.communicationRuntime,
    workRuntime: connected.ctx.workRuntime,
    teamRuntime: connected.ctx.teamRuntime,
    companyWorkspaceRuntime: connected.ctx.companyRuntime,
  });
  const threadId = vm.threads?.[0]?.id;
  const t = performance.now();
  if (threadId) {
    buildCommunicationThreadDetail({
      threadId: String(threadId),
      communicationRuntime: connected.ctx.communicationRuntime,
      requestRuntime: connected.ctx.requestRuntime,
      businessGraphRuntime: connected.ctx.businessGraphRuntime,
      interactionRuntime: connected.ctx.interactionRuntime,
    });
  }
  return { VIEW_MODEL: Math.round(performance.now() - t), threadId };
}

async function routeTeam(connected) {
  const stages = {};
  let t = performance.now();
  const knowledgeDocumentCount = await platformStore.countActiveKnowledgeDocuments(businessId);
  stages.KNOWLEDGE_COUNT = Math.round(performance.now() - t);

  t = performance.now();
  refreshOperationalState(connected, knowledgeDocumentCount);
  stages.REFRESH_OPERATIONAL_STATE = Math.round(performance.now() - t);

  t = performance.now();
  new TeamViewAdapter().translate({
    teamRuntime: connected.ctx.teamRuntime,
    companyRuntime: connected.ctx.companyRuntime,
    employeeReadinessReport: connected.employeeReadinessReport,
    installationResult: connected.installationResult,
  });
  stages.VIEW_MODEL = Math.round(performance.now() - t);

  t = performance.now();
  await Promise.all([
    platformStore.listMembershipsForBusiness(businessId),
    platformStore.listPendingInvitationsForBusiness(businessId),
  ]);
  stages.TEAM_QUERIES = Math.round(performance.now() - t);

  return stages;
}

function sumStages(stages) {
  return Object.values(stages).reduce((a, b) => a + b, 0);
}

function printRouteReport(routeName, authStages, routeStages) {
  console.log(`\n--- ${routeName} ---`);
  for (const [k, v] of Object.entries(authStages)) {
    if (typeof v === "number") printStage(k, v);
  }
  for (const [k, v] of Object.entries(routeStages)) {
    if (typeof v === "number") printStage(k, v);
  }
  const total =
    Object.values(authStages).filter((v) => typeof v === "number").reduce((a, b) => a + b, 0) +
    Object.values(routeStages).filter((v) => typeof v === "number").reduce((a, b) => a + b, 0);
  printStage("ROUTE_TOTAL", total);
}

await runMigrations();

const business = await platformStore.getBusinessById(businessId);
if (!business) {
  console.error(`Business not found: ${businessId}`);
  process.exit(1);
}

const memberships = await platformStore.listMembershipsForBusiness(businessId);
const owner = memberships.find((m) => m.role === "OWNER") ?? memberships[0];
if (!owner) {
  console.error(`No membership for business: ${businessId}`);
  process.exit(1);
}

console.log(`\n=== Workspace route timing: ${business.name} (${businessId}) ===\n`);

console.log("=== COLD (registry cleared, snapshots loaded) ===");
workspaceCompositionRegistry.clear(businessId);
const cold = await simulateGetAuthorizedWorkspace({ userId: owner.userId, skipSnapshotsIfWarm: false });
printStage("REGISTRY_WARM", cold.registryWarm ? 1 : 0);
const coldSnap = await loadRuntimeSnapshotsMap(businessId);
printStage("SNAPSHOT_ROW_COUNT", coldSnap ? Object.keys(coldSnap).length : 0);

printRouteReport("HOME (cold)", cold.stages, await routeHome(cold.connected));
printRouteReport("INTEGRATIONS (cold)", cold.stages, await routeIntegrations(cold.connected));
printRouteReport("INBOX (cold)", cold.stages, await routeInbox(cold.connected));
printRouteReport("INBOX_DETAIL (cold)", cold.stages, await routeInboxDetail(cold.connected));
printRouteReport("TEAM (cold)", cold.stages, await routeTeam(cold.connected));

console.log("\n=== WARM round 1 (registry hit, current code still loads snapshots) ===");
const warmCurrent = await simulateGetAuthorizedWorkspace({ userId: owner.userId, skipSnapshotsIfWarm: false });
printRouteReport("HOME (warm, snapshots always)", warmCurrent.stages, await routeHome(warmCurrent.connected));

console.log("\n=== WARM round 2 (registry hit, skip snapshot load when warm) ===");
const warmFixed = await simulateGetAuthorizedWorkspace({ userId: owner.userId, skipSnapshotsIfWarm: true });
printRouteReport("HOME (warm, skip snapshots)", warmFixed.stages, await routeHome(warmFixed.connected));
printRouteReport("INTEGRATIONS (warm)", warmFixed.stages, await routeIntegrations(warmFixed.connected));
printRouteReport("INBOX (warm)", warmFixed.stages, await routeInbox(warmFixed.connected));
printRouteReport("INBOX_DETAIL (warm)", warmFixed.stages, await routeInboxDetail(warmFixed.connected));
printRouteReport("TEAM (warm)", warmFixed.stages, await routeTeam(warmFixed.connected));

console.log("\n=== activateWorkspace only (cold hydrate) ===");
workspaceCompositionRegistry.clear(businessId);
const snapshots = await loadRuntimeSnapshotsMap(businessId);
const activation = businessRecordToActivation(business);
await measureRoute("COLD_ACTIVATION", async () => {
  workspaceCompositionRegistry.getOrCreate(businessId, ({ workspaceId }) => {
    return activateWorkspace({ workspaceId, activation, runtimeSnapshots: snapshots });
  });
});
await measureRoute("WARM_REGISTRY_HIT", async () => {
  workspaceCompositionRegistry.getOrCreate(businessId, () => {
    throw new Error("should not create");
  });
});

await closePool();
console.log("\nDone.\n");
