#!/usr/bin/env node
/**
 * Production-parity Architect → install → invites → access → improve journey.
 * Uses product services only (no demo/Horizon shortcuts).
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { runMigrations } from "../backend/core/platform/db/migrate.js";
import { closePool } from "../backend/core/platform/db/pool.js";
import { platformStore } from "../backend/core/platform/persistence/PostgresPlatformStore.js";
import { bootstrapPlatformAdmin, hashPassword } from "../backend/core/platform/services/AuthCredentialService.js";
import { createAndDeliverInvitation } from "../backend/core/platform/services/InvitationService.js";
import { MEMBERSHIP_ROLES } from "../backend/core/platform/permissions/rolePermissions.js";
import { authorizeBusinessAccess, AuthorizationError } from "../backend/core/platform/authorizeBusinessAccess.js";
import { AiBuilderService } from "../backend/core/ai-builder/AiBuilderService.js";
import { BuilderSessionRepository } from "../backend/core/ai-builder/BuilderSessionRepository.js";
import { ContinuousBusinessBuilderService } from "../backend/core/ai-builder/ContinuousBusinessBuilderService.js";
import { createDurableAccessRequestService } from "../backend/core/access-requests/AccessRequestService.js";
import { applyAccessRequestMembershipGrant } from "../backend/core/access-requests/applyAccessRequestMembershipGrant.js";
import { createKnowledgeStorageProvider } from "../backend/core/platform/knowledge/createKnowledgeStorageProvider.js";
import { createBusinessWithOwnerInvite } from "../backend/core/platform/services/PlatformBusinessService.js";

const suffix = Date.now();
const storageRoot = process.env.KNOWLEDGE_STORAGE_ROOT
  ?? path.join(root, ".dev", "pilot-knowledge-storage");
process.env.KNOWLEDGE_STORAGE_ROOT = storageRoot;
fs.mkdirSync(storageRoot, { recursive: true });

function step(label) {
  console.log(`→ ${label}`);
}

await runMigrations();

step("Admin bootstrap");
const admin = await bootstrapPlatformAdmin({
  email: `pilot-admin-${suffix}@vtechdevelopment.com`,
  password: `PilotAdmin-${suffix}!`,
  name: "Pilot Admin",
});

const builder = new AiBuilderService({
  repository: new BuilderSessionRepository({ platformStore }),
  platformStore,
});

step("Architect — create new business session");
const started = await builder.startSession({
  mode: "new_business",
  actorId: admin.user.id,
  businessName: `Pilot Co ${suffix}`,
  description: "Property management company needing leasing, maintenance, and owner reporting.",
});
const sessionId = started.session.sessionId;

step("Architect interview");
for (const [questionId, answer] of [
  ["q_company_name", `Pilot Co ${suffix}`],
  ["q_industry", "property management"],
  ["q_services", "leasing, maintenance, owner reporting"],
  ["q_customers", "property owners and residents"],
  ["q_roles", "owner, manager, leasing agent"],
  ["q_repetitive_work", "maintenance follow-ups and owner updates"],
  ["q_approvals", "lease offers and vendor spend"],
  ["q_pain_points", "manual coordination across email and spreadsheets"],
  ["q_desired_outcomes", "one Mission Control for the living business"],
]) {
  await builder.answer({ sessionId, questionId, answer });
}

step("Website research");
try {
  await builder.research({
    sessionId,
    websiteUrl: "https://vtechdevelopment.com",
    manualFallbackText: "VIBETech builds operating systems for real businesses.",
  });
} catch (err) {
  console.log(`  research soft-fail: ${err instanceof Error ? err.message : err}`);
}

step("Upload documents (durable object storage)");
const upload = await builder.upload({
  sessionId,
  filename: "pilot-handbook.txt",
  mimeType: "text/plain",
  textPreview: "Pilot SOP: respond to maintenance tickets within 4 hours.",
  contentBase64: Buffer.from("Pilot SOP: respond to maintenance tickets within 4 hours.", "utf8").toString("base64"),
});
if (!upload.ok) throw new Error("Upload failed");

step("Generate proposal / Business OS");
const proposed = await builder.propose({ sessionId });
if (!proposed.ok) throw new Error(`Propose failed: ${proposed.reason ?? "unknown"}`);

step("Preview portal");
await builder.portalPreview({ sessionId, membershipRole: "OWNER" });

step("Dry run → approve → install");
const dry = await builder.dryRun({ sessionId });
if (!dry.ok) throw new Error(`Dry run failed: ${dry.reason ?? "unknown"}`);
const approved = await builder.approve({ sessionId, actorId: admin.user.id });
if (!approved.ok) throw new Error(`Approve failed: ${approved.reason ?? "unknown"}`);
const installed = await builder.install({ sessionId, actorId: admin.user.id });
if (!installed.ok) throw new Error(`Install failed: ${installed.reason ?? "unknown"}`);
const businessId = installed.session?.businessId ?? installed.openHref?.match(/\/b\/([^/]+)/)?.[1];
if (!businessId || String(businessId).startsWith("draft_")) {
  throw new Error(`Install did not register a platform business: ${businessId}`);
}
const businessRow = await platformStore.getBusinessById(businessId);
if (!businessRow) throw new Error("Installed business missing from platform store");

step("Invite owner + accept");
const ownerEmail = `pilot-owner-${suffix}@example.com`;
const ownerInvite = await createAndDeliverInvitation({
  businessId,
  email: ownerEmail,
  role: MEMBERSHIP_ROLES.OWNER,
  invitedByUserId: admin.user.id,
  inviterRole: MEMBERSHIP_ROLES.OWNER,
  businessName: businessRow.name,
});
const owner = await platformStore.createUser({
  email: ownerEmail,
  name: "Pilot Owner",
  passwordHash: await hashPassword("PilotOwner-123!"),
});
await platformStore.acceptInvitation({ invitationId: ownerInvite.invitation.id, userId: owner.id });

step("Invite employee + accept");
const employeeEmail = `pilot-employee-${suffix}@example.com`;
const employeeInvite = await createAndDeliverInvitation({
  businessId,
  email: employeeEmail,
  role: MEMBERSHIP_ROLES.EMPLOYEE,
  invitedByUserId: owner.id,
  inviterRole: MEMBERSHIP_ROLES.OWNER,
  businessName: businessRow.name,
});
const employee = await platformStore.createUser({
  email: employeeEmail,
  name: "Pilot Employee",
  passwordHash: await hashPassword("PilotEmployee-123!"),
});
await platformStore.acceptInvitation({ invitationId: employeeInvite.invitation.id, userId: employee.id });

step("Access request → owner approval");
const access = createDurableAccessRequestService(platformStore);
const req = await access.requestAccess({
  businessId,
  requesterUserId: employee.id,
  requestKind: "module",
  requestedModuleId: "performance",
  reason: "Need performance for weekly report",
});
if (!req.ok) throw new Error("Access request failed");
const decided = await access.decide({
  businessId,
  accessRequestId: req.accessRequest.accessRequestId,
  actorUserId: owner.id,
  actorRole: MEMBERSHIP_ROLES.OWNER,
  decision: "approved",
  membershipUpdater: async (grant) => {
    await applyAccessRequestMembershipGrant(platformStore, { ...grant, approverUserId: owner.id });
  },
});
if (!decided.ok) throw new Error("Access approval failed");

step("Restart recovery for access requests");
const access2 = createDurableAccessRequestService(platformStore);
const listed = await access2.store.list(businessId);
if (!listed.some((row) => row.accessRequestId === req.accessRequest.accessRequestId && row.status === "approved")) {
  throw new Error("Access request did not survive service recreation");
}

step("Ask VIBETech / improve → dry run → approve → install revision");
const continuous = new ContinuousBusinessBuilderService({ aiBuilder: builder });
const improve = await continuous.startImprovement({
  businessId,
  actorId: owner.id,
  installedSpecification: proposed.specification,
  prompt: "Improve this business: add clearer owner reporting",
});
if (!improve.ok) throw new Error(`Improve failed: ${improve.reason ?? "unknown"}`);
const improveSessionId = improve.session.sessionId;
await builder.chat({ sessionId: improveSessionId, text: "Add clearer owner reporting" });
const improvePropose = await builder.propose({ sessionId: improveSessionId });
if (!improvePropose.ok) throw new Error(`Improve propose failed: ${improvePropose.reason ?? "unknown"}`);
const improveDry = await builder.dryRun({ sessionId: improveSessionId });
if (!improveDry.ok) throw new Error(`Improve dry-run failed: ${improveDry.reason ?? "unknown"}`);
const improveApproved = await builder.approve({ sessionId: improveSessionId, actorId: owner.id });
if (!improveApproved.ok) throw new Error(`Improve approve failed: ${improveApproved.reason ?? "unknown"}`);
const improveInstalled = await builder.install({ sessionId: improveSessionId, actorId: owner.id });
if (!improveInstalled.ok) throw new Error(`Improve install failed: ${improveInstalled.reason ?? "unknown"}`);

step("Tenant isolation");
const otherBiz = await createBusinessWithOwnerInvite({
  name: `Other Pilot ${suffix}`,
  ownerEmail: `other-owner-${suffix}@example.com`,
  createdByUserId: admin.user.id,
});
let denied = false;
try {
  await authorizeBusinessAccess({ userId: owner.id, businessId: otherBiz.business.id });
} catch (err) {
  denied = err instanceof AuthorizationError;
}
if (!denied) throw new Error("Expected tenant isolation denial");

step("Persistent storage verification");
const storage = createKnowledgeStorageProvider();
const probeKey = `pilot_probe_${crypto.randomBytes(4).toString("hex")}.txt`;
await storage.putObject({ businessId, storageKey: probeKey, buffer: Buffer.from("pilot-ok") });
if (!(await storage.objectExists({ businessId, storageKey: probeKey }))) {
  throw new Error("Storage probe missing after putObject");
}

console.log("\nPilot Architect journey passed (database + product services).");
console.log(`  businessId: ${businessId}`);
console.log(`  architectSession: ${sessionId}`);
console.log(`  improveSession: ${improveSessionId}`);
console.log(`  ownerInviteDelivery: ${ownerInvite.delivery?.sent ? "sent" : ownerInvite.delivery?.reason ?? "not_sent"}`);
console.log(`  employeeInviteDelivery: ${employeeInvite.delivery?.sent ? "sent" : employeeInvite.delivery?.reason ?? "not_sent"}`);
console.log(`  storageRoot: ${storageRoot}`);
console.log("  NOTE: Live HTTPS/DNS for app.vtechdevelopment.com must still pass pilot:gates.");

await closePool();
