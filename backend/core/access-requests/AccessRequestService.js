import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  createAccessRequest,
  accessRequestOpenKey,
  ACCESS_REQUEST_STATUSES,
} from "./AccessRequest.js";
import { createWorkItem } from "../work/WorkItem.js";
import { createApprovalRequest } from "../approvals/ApprovalRequest.js";
import { APPROVAL_REQUEST_STATUSES } from "../approvals/ApprovalEventTypes.js";
import { MEMBERSHIP_ROLES } from "../platform/permissions/rolePermissions.js";
import { platformStore as defaultPlatformStore } from "../platform/persistence/platformStore.js";
import { createPostgresAccessRequestStore } from "./PostgresAccessRequestStore.js";

function fail(message) {
  throw new Error(`AccessRequestService: ${message}`);
}

/**
 * Governed access-request workflow reusing Work + Approvals.
 * No automatic approval. Duplicate open requests are blocked.
 */
export class AccessRequestService {
  constructor({
    store = null,
    auditRecorder = null,
    nowISO = () => new Date().toISOString(),
  } = {}) {
    this.store = store ?? createInMemoryAccessRequestStore();
    this.auditRecorder = auditRecorder;
    this.nowISO = nowISO;
  }

  async requestAccess({
    businessId,
    requesterUserId,
    requestKind,
    reason,
    requestedPermission = null,
    requestedModuleId = null,
    requestedRoleId = null,
    recordScope = null,
    durationHours = null,
    currentAccess = {},
    riskLevel = "medium",
    approverUserId = "owner",
  }) {
    const draft = createAccessRequest({
      businessId,
      requesterUserId,
      requestKind,
      reason,
      requestedPermission,
      requestedModuleId,
      requestedRoleId,
      recordScope,
      durationHours,
      currentAccess,
      riskLevel,
      approverUserId,
      createdAt: this.nowISO(),
    });

    const open = (await Promise.resolve(this.store.listOpen(businessId))).find((entry) => (
      accessRequestOpenKey(entry) === accessRequestOpenKey(draft)
    ));
    if (open) {
      return deepFreeze({ ok: false, reason: "duplicate_open_request", existing: open });
    }

    const workItemId = `work_access_${draft.accessRequestId}`;
    const approvalRequestId = `apr_access_${draft.accessRequestId}`;
    const now = this.nowISO();

    const workItem = createWorkItem({
      id: workItemId,
      title: `Access request: ${requestedModuleId ?? requestedPermission ?? requestedRoleId ?? requestKind}`,
      description: reason,
      workType: "access_request_approval",
      status: "review_required",
      priority: riskLevel === "high" ? "high" : "medium",
      stageId: "stage_approval",
      queueId: "queue_approvals",
      assignedTo: String(approverUserId),
      requestedBy: String(requesterUserId),
      source: "access_request",
      createdAt: now,
      updatedAt: now,
      relatedObjects: [
        { type: "access_request", id: draft.accessRequestId },
        { type: "business", id: businessId },
      ],
      metadata: {
        accessRequestId: draft.accessRequestId,
        requestKind: draft.requestKind,
        businessId,
      },
    });

    const approval = createApprovalRequest({
      id: approvalRequestId,
      requestType: "ACCESS_REQUEST",
      source: "access_request",
      sourceReference: { accessRequestId: draft.accessRequestId, businessId },
      status: APPROVAL_REQUEST_STATUSES.PENDING,
      requestedAt: now,
      requestedBy: String(requesterUserId),
      requiredApprover: String(approverUserId),
      context: {
        requestKind: draft.requestKind,
        requestedPermission,
        requestedModuleId,
        requestedRoleId,
        reason,
        riskLevel,
      },
    });

    const record = createAccessRequest({
      ...draft,
      workItemId,
      approvalRequestId,
      status: "pending",
    });

    await Promise.resolve(this.store.save(record));
    await Promise.resolve(this.store.saveWork(workItem));
    await Promise.resolve(this.store.saveApproval(approval));
    await this._audit({
      actorUserId: requesterUserId,
      businessId,
      action: "access_request.created",
      targetType: "access_request",
      targetId: record.accessRequestId,
      metadata: { requestKind: draft.requestKind, workItemId, approvalRequestId },
    });

    return deepFreeze({
      ok: true,
      accessRequest: record,
      workItem,
      approval,
    });
  }

  async decide({
    businessId,
    accessRequestId,
    actorUserId,
    actorRole,
    decision,
    notes = null,
    grantPermission = null,
    membershipUpdater = null,
  }) {
    if (!["approved", "rejected"].includes(String(decision))) {
      fail("decision must be approved or rejected.");
    }
    if (![MEMBERSHIP_ROLES.OWNER, MEMBERSHIP_ROLES.ADMIN, "PLATFORM_ADMIN"].includes(String(actorRole))) {
      return deepFreeze({ ok: false, reason: "approver_role_required" });
    }

    const existing = await Promise.resolve(this.store.get(businessId, accessRequestId));
    if (!existing) return deepFreeze({ ok: false, reason: "not_found" });
    if (String(existing.businessId) !== String(businessId)) {
      return deepFreeze({ ok: false, reason: "foreign_business_rejection" });
    }
    if (existing.status !== "pending") {
      return deepFreeze({ ok: false, reason: "already_decided", accessRequest: existing });
    }

    const now = this.nowISO();
    const updated = createAccessRequest({
      ...existing,
      status: String(decision),
      decidedAt: now,
      decisionNotes: notes,
      approverUserId: actorUserId,
    });

    let membershipUpdate = null;
    if (decision === "approved") {
      if (existing.requestedRoleId === "owner" || existing.requestedRoleId === MEMBERSHIP_ROLES.OWNER) {
        if (String(actorRole) !== MEMBERSHIP_ROLES.OWNER) {
          return deepFreeze({ ok: false, reason: "owner_escalation_requires_owner" });
        }
      }
      membershipUpdate = {
        accessRequestId: existing.accessRequestId,
        userId: existing.requesterUserId,
        businessId,
        permission: grantPermission ?? existing.requestedPermission,
        moduleId: existing.requestedModuleId,
        roleId: existing.requestedRoleId,
        temporary: existing.requestKind === "temporary_access",
        durationHours: existing.durationHours,
        expiresAt: existing.durationHours
          ? new Date(Date.parse(now) + existing.durationHours * 3600_000).toISOString()
          : null,
      };
      if (typeof membershipUpdater === "function") {
        await Promise.resolve(membershipUpdater(membershipUpdate));
      }
      await Promise.resolve(this.store.saveGrant(membershipUpdate));
    }

    await Promise.resolve(this.store.save(updated));
    const approval = await Promise.resolve(this.store.getApproval(existing.approvalRequestId));
    if (approval) {
      await Promise.resolve(this.store.saveApproval(deepFreeze({
        ...approval,
        status: decision === "approved"
          ? APPROVAL_REQUEST_STATUSES.GRANTED
          : APPROVAL_REQUEST_STATUSES.REJECTED,
        decision: String(decision),
        decidedAt: now,
      })));
    }
    const work = await Promise.resolve(this.store.getWork(existing.workItemId));
    if (work) {
      await Promise.resolve(this.store.saveWork(deepFreeze({
        ...work,
        status: decision === "approved" ? "approved" : "rejected",
        updatedAt: now,
        completedAt: now,
      })));
    }

    await this._audit({
      actorUserId,
      businessId,
      action: decision === "approved" ? "access_request.approved" : "access_request.rejected",
      targetType: "access_request",
      targetId: accessRequestId,
      metadata: { membershipUpdate, notes },
    });

    await this._audit({
      actorUserId,
      businessId,
      action: "access_request.requester_notified",
      targetType: "user",
      targetId: existing.requesterUserId,
      metadata: { accessRequestId, decision },
    });

    return deepFreeze({
      ok: true,
      accessRequest: updated,
      membershipUpdate,
    });
  }

  protectOwnerAccess({ memberships, targetUserId, businessId }) {
    const owners = (memberships ?? []).filter((entry) => (
      entry.businessId === businessId
      && entry.role === MEMBERSHIP_ROLES.OWNER
      && entry.status === "ACTIVE"
    ));
    if (owners.length === 1 && owners[0].userId === targetUserId) {
      return deepFreeze({ ok: false, reason: "cannot_remove_final_owner_access" });
    }
    return deepFreeze({ ok: true });
  }

  async _audit(event) {
    if (typeof this.auditRecorder === "function") {
      await Promise.resolve(this.auditRecorder(event));
      return;
    }
    if (typeof this.store.recordAudit === "function") {
      await Promise.resolve(this.store.recordAudit(event));
    }
  }
}

export function createInMemoryAccessRequestStore() {
  const requests = new Map();
  const work = new Map();
  const approvals = new Map();
  const grants = [];
  const audits = [];

  return {
    save(record) {
      requests.set(`${record.businessId}:${record.accessRequestId}`, deepFreeze(record));
      return record;
    },
    get(businessId, accessRequestId) {
      return requests.get(`${businessId}:${accessRequestId}`) ?? null;
    },
    listOpen(businessId) {
      return [...requests.values()].filter((entry) => (
        entry.businessId === businessId && entry.status === "pending"
      ));
    },
    list(businessId) {
      return [...requests.values()].filter((entry) => entry.businessId === businessId);
    },
    saveWork(item) {
      work.set(item.id, deepFreeze(item));
      return item;
    },
    getWork(id) {
      return work.get(id) ?? null;
    },
    saveApproval(item) {
      approvals.set(item.id, deepFreeze(item));
      return item;
    },
    getApproval(id) {
      return approvals.get(id) ?? null;
    },
    saveGrant(grant) {
      grants.push(deepFreeze(grant));
      return grant;
    },
    listGrants(businessId) {
      return grants.filter((entry) => entry.businessId === businessId);
    },
    recordAudit(event) {
      audits.push(deepFreeze(event));
      return event;
    },
    listAudits() {
      return [...audits];
    },
  };
}

export function createDurableAccessRequestService(platformStore = defaultPlatformStore) {
  return new AccessRequestService({
    store: createPostgresAccessRequestStore(platformStore),
  });
}

export { ACCESS_REQUEST_STATUSES };
