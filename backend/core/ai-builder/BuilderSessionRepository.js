import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderSession } from "./BuilderSession.js";

/**
 * Repository for durable Builder sessions.
 * In-memory for tests; Postgres adapter wraps platformStore.
 */
export class BuilderSessionRepository {
  /**
   * @param {{ platformStore?: object | null }} [options]
   */
  constructor({ platformStore = null } = {}) {
    this.platformStore = platformStore;
    this.sessions = new Map();
    this.byBusiness = new Map();
  }

  async save(session) {
    const frozen = createBuilderSession(session);
    this.sessions.set(frozen.sessionId, frozen);
    if (frozen.businessId) {
      const list = this.byBusiness.get(frozen.businessId) ?? [];
      this.byBusiness.set(
        frozen.businessId,
        [frozen.sessionId, ...list.filter((id) => id !== frozen.sessionId)],
      );
    }
    if (this.platformStore?.upsertAiBuilderSession) {
      await this.platformStore.upsertAiBuilderSession(frozen);
    }
    return frozen;
  }

  async get(sessionId) {
    if (this.sessions.has(String(sessionId))) {
      return this.sessions.get(String(sessionId));
    }
    if (this.platformStore?.getAiBuilderSession) {
      const row = await this.platformStore.getAiBuilderSession(sessionId);
      if (row) {
        const session = createBuilderSession(row);
        this.sessions.set(session.sessionId, session);
        return session;
      }
    }
    return null;
  }

  async listForBusiness(businessId) {
    if (this.platformStore?.listAiBuilderSessionsForBusiness) {
      const rows = await this.platformStore.listAiBuilderSessionsForBusiness(businessId);
      const sessions = rows.map((row) => {
        const session = createBuilderSession(row);
        this.sessions.set(session.sessionId, session);
        return session;
      });
      return deepFreeze(sessions);
    }
    const ids = this.byBusiness.get(String(businessId)) ?? [];
    return deepFreeze(ids.map((id) => this.sessions.get(id)).filter(Boolean));
  }

  async listAll() {
    if (this.platformStore?.listAiBuilderSessions) {
      const rows = await this.platformStore.listAiBuilderSessions();
      return deepFreeze(rows.map((row) => createBuilderSession(row)));
    }
    return deepFreeze([...this.sessions.values()]);
  }
}
