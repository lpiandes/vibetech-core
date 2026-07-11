import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AccessRequestService,
  createInMemoryAccessRequestStore,
} from "./AccessRequestService.js";
import { MEMBERSHIP_ROLES } from "../platform/permissions/rolePermissions.js";

const NOW = "2026-07-10T23:30:00.000Z";

test("access request creates approval Work and blocks duplicates", async () => {
  const store = createInMemoryAccessRequestStore();
  const service = new AccessRequestService({
    store,
    nowISO: () => NOW,
  });

  const created = await service.requestAccess({
    businessId: "biz_a",
    requesterUserId: "user_emp",
    requestKind: "module_access",
    requestedModuleId: "campaigns",
    reason: "Need campaign visibility for seasonal launch",
    currentAccess: { modules: ["work", "properties"] },
    riskLevel: "medium",
    approverUserId: "user_owner",
  });
  assert.equal(created.ok, true);
  assert.equal(created.workItem.workType, "access_request_approval");
  assert.equal(created.workItem.queueId, "queue_approvals");
  assert.equal(created.approval.status, "PENDING");
  assert.ok(store.listAudits().some((entry) => entry.action === "access_request.created"));

  const duplicate = await service.requestAccess({
    businessId: "biz_a",
    requesterUserId: "user_emp",
    requestKind: "module_access",
    requestedModuleId: "campaigns",
    reason: "Same request again",
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "duplicate_open_request");
});

test("owner approve updates access and records audit; reject remembers decision", async () => {
  const store = createInMemoryAccessRequestStore();
  const service = new AccessRequestService({ store, nowISO: () => NOW });
  const created = await service.requestAccess({
    businessId: "biz_a",
    requesterUserId: "user_emp",
    requestKind: "action_permission",
    requestedPermission: "performance.view",
    reason: "Need performance metrics",
    approverUserId: "user_owner",
  });

  const approved = await service.decide({
    businessId: "biz_a",
    accessRequestId: created.accessRequest.accessRequestId,
    actorUserId: "user_owner",
    actorRole: MEMBERSHIP_ROLES.OWNER,
    decision: "approved",
    notes: "Granted for Q3",
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.accessRequest.status, "approved");
  assert.ok(store.listGrants("biz_a").some((grant) => grant.permission === "performance.view"));
  assert.ok(store.listAudits().some((entry) => entry.action === "access_request.approved"));
  assert.ok(store.listAudits().some((entry) => entry.action === "access_request.requester_notified"));

  const rejectedFlow = await service.requestAccess({
    businessId: "biz_a",
    requesterUserId: "user_emp",
    requestKind: "module_access",
    requestedModuleId: "settings",
    reason: "Want settings",
  });
  const rejected = await service.decide({
    businessId: "biz_a",
    accessRequestId: rejectedFlow.accessRequest.accessRequestId,
    actorUserId: "user_owner",
    actorRole: MEMBERSHIP_ROLES.OWNER,
    decision: "rejected",
    notes: "Too sensitive",
  });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.accessRequest.status, "rejected");
  assert.equal(store.getApproval(rejectedFlow.approval.id).status, "REJECTED");
});

test("tenant isolation and final owner protection", async () => {
  const store = createInMemoryAccessRequestStore();
  const service = new AccessRequestService({ store, nowISO: () => NOW });
  const created = await service.requestAccess({
    businessId: "biz_a",
    requesterUserId: "user_emp",
    requestKind: "role_upgrade",
    requestedRoleId: "manager",
    reason: "Promotion",
  });

  const foreign = await service.decide({
    businessId: "biz_b",
    accessRequestId: created.accessRequest.accessRequestId,
    actorUserId: "user_owner",
    actorRole: MEMBERSHIP_ROLES.OWNER,
    decision: "approved",
  });
  assert.equal(foreign.ok, false);
  assert.ok(["not_found", "foreign_business_rejection"].includes(foreign.reason));

  const protection = service.protectOwnerAccess({
    businessId: "biz_a",
    targetUserId: "user_owner",
    memberships: [
      { userId: "user_owner", businessId: "biz_a", role: MEMBERSHIP_ROLES.OWNER, status: "ACTIVE" },
    ],
  });
  assert.equal(protection.ok, false);
  assert.equal(protection.reason, "cannot_remove_final_owner_access");
});

test("module alias normalizes to module_access", async () => {
  const store = createInMemoryAccessRequestStore();
  const service = new AccessRequestService({ store, nowISO: () => NOW });
  const created = await service.requestAccess({
    businessId: "biz_a",
    requesterUserId: "user_emp",
    requestKind: "module",
    requestedModuleId: "performance",
    reason: "Need performance",
  });
  assert.equal(created.ok, true);
  assert.equal(created.accessRequest.requestKind, "module_access");
});
