import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  createSupportAccessSession,
  permissionsForSupportMode,
} from "./SupportAccessSession.js";
import { isPlatformAdmin } from "../persistence/platformMappers.js";
import { platformStore as defaultPlatformStore } from "../persistence/platformStore.js";
import { createPostgresSupportAccessStore } from "./PostgresSupportAccessStore.js";

function fail(message) {
  throw new Error(`SupportAccessService: ${message}`);
}

/**
 * VIBETech platform-admin business support access.
 * Explicit reason required. Audited. No silent permanent membership.
 */
export class SupportAccessService {
  constructor({
    store = null,
    platformStore = null,
    nowISO = () => new Date().toISOString(),
  } = {}) {
    this.store = store ?? createInMemorySupportAccessStore();
    this.platformStore = platformStore;
    this.nowISO = nowISO;
  }

  listBusinessDirectory({ adminUserId, platformRole }) {
    if (!isPlatformAdmin({ platformRole })) {
      return deepFreeze({ ok: false, reason: "platform_admin_required" });
    }
    const businesses = this.store.listBusinesses?.()
      ?? [];
    this._audit({
      actorUserId: adminUserId,
      businessId: null,
      action: "support_access.directory_viewed",
      targetType: "platform",
      targetId: "business_directory",
    });
    return deepFreeze({ ok: true, businesses });
  }

  async enter({
    adminUserId,
    platformRole,
    businessId,
    reason,
    mode = "read_only",
    ttlHours = 8,
  }) {
    if (!isPlatformAdmin({ platformRole })) {
      return deepFreeze({ ok: false, reason: "platform_admin_required" });
    }
    if (!reason || !String(reason).trim()) {
      return deepFreeze({ ok: false, reason: "reason_required" });
    }

    const now = this.nowISO();
    const sessionId = `support_${businessId}_${adminUserId}_${Date.parse(now)}`;
    const expiresAt = new Date(Date.parse(now) + Number(ttlHours) * 3600_000).toISOString();
    const session = createSupportAccessSession({
      sessionId,
      businessId,
      adminUserId,
      reason,
      mode,
      startedAt: now,
      expiresAt,
      status: "active",
    });

    await Promise.resolve(this.store.saveSession(session));
    await Promise.resolve(this._audit({
      actorUserId: adminUserId,
      businessId,
      action: "support_access.entered",
      targetType: "business",
      targetId: businessId,
      metadata: {
        sessionId,
        reason,
        mode,
        permanentMembershipGranted: false,
      },
    }));

    return deepFreeze({
      ok: true,
      session,
      permissions: [...permissionsForSupportMode(mode)],
      indicator: {
        active: true,
        mode,
        reason,
        message: "VIBETech support access — actions retain your admin identity",
      },
    });
  }

  /**
   * @param {{ adminUserId: string, businessId: string, sessionId?: string | null }} input
   */
  async exit({ adminUserId, businessId, sessionId = null }) {
    const active = sessionId
      ? await Promise.resolve(this.store.getSession(sessionId))
      : await Promise.resolve(this.store.getActiveSession(adminUserId, businessId));
    if (!active || active.status !== "active") {
      return deepFreeze({ ok: false, reason: "no_active_support_session" });
    }
    if (String(active.adminUserId) !== String(adminUserId)) {
      return deepFreeze({ ok: false, reason: "actor_mismatch" });
    }
    if (String(active.businessId) !== String(businessId)) {
      return deepFreeze({ ok: false, reason: "foreign_business_rejection" });
    }

    const ended = createSupportAccessSession({
      ...active,
      status: "ended",
      endedAt: this.nowISO(),
    });
    await Promise.resolve(this.store.saveSession(ended));
    await Promise.resolve(this._audit({
      actorUserId: adminUserId,
      businessId,
      action: "support_access.exited",
      targetType: "business",
      targetId: businessId,
      metadata: { sessionId: ended.sessionId },
    }));
    return deepFreeze({ ok: true, session: ended });
  }

  async getActiveSession(adminUserId, businessId) {
    const session = await Promise.resolve(this.store.getActiveSession(adminUserId, businessId));
    if (!session || session.status !== "active") return null;
    if (session.expiresAt && Date.parse(session.expiresAt) < Date.parse(this.nowISO())) {
      await Promise.resolve(this.store.saveSession(createSupportAccessSession({
        ...session,
        status: "expired",
        endedAt: this.nowISO(),
      })));
      return null;
    }
    return session;
  }

  async resolveAuthorization({ adminUserId, platformRole, businessId }) {
    if (!isPlatformAdmin({ platformRole })) {
      return deepFreeze({ ok: false, reason: "platform_admin_required" });
    }
    const session = await this.getActiveSession(adminUserId, businessId);
    if (!session) {
      return deepFreeze({ ok: false, reason: "support_access_required" });
    }
    return deepFreeze({
      ok: true,
      session,
      role: "PLATFORM_ADMIN",
      permissions: permissionsForSupportMode(session.mode),
      isPlatformAdmin: true,
      supportAccess: {
        active: true,
        mode: session.mode,
        reason: session.reason,
        sessionId: session.sessionId,
        actorUserId: adminUserId,
      },
      permanentMembership: false,
    });
  }

  _audit(event) {
    if (this.platformStore?.recordAuditEvent) {
      return this.platformStore.recordAuditEvent(event);
    }
    return this.store.recordAudit(event);
  }
}

export function createInMemorySupportAccessStore({ businesses = [] } = {}) {
  const sessions = new Map();
  const audits = [];
  return {
    listBusinesses() {
      return businesses;
    },
    setBusinesses(list) {
      businesses.splice(0, businesses.length, ...list);
    },
    saveSession(session) {
      sessions.set(session.sessionId, deepFreeze(session));
      return session;
    },
    getSession(sessionId) {
      return sessions.get(String(sessionId)) ?? null;
    },
    getActiveSession(adminUserId, businessId) {
      return [...sessions.values()].find((entry) => (
        entry.adminUserId === String(adminUserId)
        && entry.businessId === String(businessId)
        && entry.status === "active"
      )) ?? null;
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

export function getDefaultSupportAccessService() {
  if (!getDefaultSupportAccessService._instance) {
    // Runtime default stays in-memory for unit tests; Admin APIs inject Postgres store.
    getDefaultSupportAccessService._instance = new SupportAccessService();
  }
  return getDefaultSupportAccessService._instance;
}

export function createDurableSupportAccessService(platformStore = defaultPlatformStore) {
  return new SupportAccessService({
    store: createPostgresSupportAccessStore(platformStore),
    platformStore,
  });
}

getDefaultSupportAccessService._instance = null;

export function resetDefaultSupportAccessServiceForTests() {
  getDefaultSupportAccessService._instance = null;
}
