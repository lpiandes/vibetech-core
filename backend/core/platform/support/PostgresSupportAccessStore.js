/**
 * Postgres-backed support access store — durable sessions via platformStore.
 */
export function createPostgresSupportAccessStore(platformStore) {
  return {
    listBusinesses() {
      return platformStore.listBusinesses();
    },
    async saveSession(session) {
      return platformStore.upsertSupportAccessSession(session);
    },
    async getSession(sessionId) {
      return platformStore.getSupportAccessSession(sessionId);
    },
    async getActiveSession(adminUserId, businessId) {
      return platformStore.getActiveSupportAccessSession(adminUserId, businessId);
    },
    recordAudit(event) {
      return platformStore.recordAuditEvent(event);
    },
    listAudits() {
      return platformStore.listAuditEvents({ limit: 100 });
    },
  };
}
