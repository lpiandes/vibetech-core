/**
 * Postgres-backed access-request store — durable via platformStore.
 * Work items, approvals, and grants live in request metadata so restart recovery works.
 */

export function createPostgresAccessRequestStore(platformStore) {
  return {
    async save(record) {
      const existing = await platformStore.getAccessRequest(record.businessId, record.accessRequestId);
      const metadata = {
        ...(existing?.metadata ?? {}),
        ...(record.metadata ?? {}),
      };
      if (record.approverUserId && !isUuidLike(record.approverUserId)) {
        metadata.approverLabel = String(record.approverUserId);
      }
      return platformStore.upsertAccessRequest({ ...record, metadata });
    },

    async get(businessId, accessRequestId) {
      return platformStore.getAccessRequest(businessId, accessRequestId);
    },

    async listOpen(businessId) {
      return platformStore.listOpenAccessRequests(businessId);
    },

    async list(businessId) {
      return platformStore.listAccessRequests(businessId);
    },

    async saveWork(item) {
      const accessRequestId = item?.metadata?.accessRequestId
        ?? String(item.id ?? "").replace(/^work_access_/, "");
      const businessId = item?.metadata?.businessId;
      let record = businessId && accessRequestId
        ? await platformStore.getAccessRequest(businessId, accessRequestId)
        : null;
      if (!record) {
        record = await platformStore.getAccessRequestByWorkItemId(item.id);
      }
      if (!record) {
        throw new Error(`Access request not found for work item ${item.id}`);
      }
      return platformStore.upsertAccessRequest({
        ...record,
        workItemId: item.id,
        metadata: { ...(record.metadata ?? {}), workItem: item },
      });
    },

    async getWork(id) {
      if (!id) return null;
      const record = await platformStore.getAccessRequestByWorkItemId(id);
      return record?.metadata?.workItem ?? null;
    },

    async saveApproval(item) {
      const accessRequestId = item?.sourceReference?.accessRequestId
        ?? String(item.id ?? "").replace(/^apr_access_/, "");
      const businessId = item?.sourceReference?.businessId;
      let record = businessId && accessRequestId
        ? await platformStore.getAccessRequest(businessId, accessRequestId)
        : null;
      if (!record) {
        record = await platformStore.getAccessRequestByApprovalId(item.id);
      }
      if (!record) {
        throw new Error(`Access request not found for approval ${item.id}`);
      }
      return platformStore.upsertAccessRequest({
        ...record,
        approvalRequestId: item.id,
        metadata: { ...(record.metadata ?? {}), approval: item },
      });
    },

    async getApproval(id) {
      if (!id) return null;
      const record = await platformStore.getAccessRequestByApprovalId(id);
      return record?.metadata?.approval ?? null;
    },

    async saveGrant(grant) {
      const record = await platformStore.getAccessRequest(grant.businessId, grant.accessRequestId)
        ?? (await platformStore.listAccessRequests(grant.businessId)).find((entry) => (
          String(entry.requesterUserId) === String(grant.userId)
          && entry.status === "approved"
        ));
      if (!record) return grant;
      const grants = Array.isArray(record.metadata?.grants) ? [...record.metadata.grants] : [];
      grants.push(grant);
      await platformStore.upsertAccessRequest({
        ...record,
        metadata: { ...(record.metadata ?? {}), grants, grant },
      });
      return grant;
    },

    async listGrants(businessId) {
      const rows = await platformStore.listAccessRequests(businessId);
      return rows.flatMap((entry) => {
        if (Array.isArray(entry.metadata?.grants)) return entry.metadata.grants;
        if (entry.metadata?.grant) return [entry.metadata.grant];
        return [];
      });
    },

    async recordAudit(event) {
      return platformStore.recordAuditEvent(event);
    },

    async listAudits() {
      return platformStore.listAuditEvents({ limit: 100 });
    },
  };
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}
