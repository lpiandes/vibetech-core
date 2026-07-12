import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { isPlatformAdmin } from "../platform/persistence/platformMappers.js";
import { getDefaultBlueprintRegistry } from "../blueprints/BlueprintRegistry.js";
import { BUSINESS_OS_EMPLOYEE_ARCHETYPES } from "../business-os/BusinessOSEmployeeArchetypes.js";
import { listDashboardComponentTypes, BUSINESS_OS_DASHBOARD_COMPONENTS } from "../business-os/BusinessOSDashboardComponentRegistry.js";

function fail(message) {
  throw new Error(`AdminPlatformService: ${message}`);
}

/**
 * VIBETech Admin Platform orchestration — wraps existing stores/registries.
 * Does not invent parallel auth or become business owner.
 *
 * @param {{
 *   platformStore: any,
 *   supportAccessService?: any,
 *   blueprintRegistry?: any,
 *   nowISO?: () => string,
 * }} [options]
 */
export class AdminPlatformService {
  constructor({
    platformStore,
    supportAccessService = null,
    blueprintRegistry = null,
    nowISO = () => new Date().toISOString(),
  } = {}) {
    if (!platformStore) fail("platformStore required.");
    this.platformStore = platformStore;
    this.supportAccessService = supportAccessService;
    this.blueprintRegistry = blueprintRegistry ?? getDefaultBlueprintRegistry();
    this.nowISO = nowISO;
  }

  assertAdmin(platformRole) {
    if (!isPlatformAdmin({ platformRole })) {
      return { ok: false, reason: "platform_admin_required" };
    }
    return { ok: true };
  }

  async getDashboard({ adminUserId, platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);

    const businesses = await this.platformStore.listBusinesses();
    const sessions = await this.platformStore.listAiBuilderSessions?.() ?? [];
    const installations = await this._listInstallationsSafe(businesses);
    const audits = await this._listAuditsSafe(40);
    const supportActive = await this._listActiveSupportSafe();

    const needsAttention = businesses.filter((business) => {
      const status = String(business.status ?? business.ownerStatus ?? "").toLowerCase();
      return /attention|failed|partial|inactive/.test(status);
    }).length;

    const failedInstalls = installations.filter((entry) => /fail|partial/i.test(String(entry.status ?? ""))).length;

    await this.platformStore.recordAuditEvent?.({
      actorUserId: adminUserId,
      action: "admin.dashboard_viewed",
      targetType: "platform",
      targetId: "admin_dashboard",
    });

    return deepFreeze({
      ok: true,
      metrics: {
        totalBusinesses: businesses.length,
        activeBusinesses: businesses.filter((entry) => !entry.archivedAt && entry.status !== "archived").length,
        needingAttention: needsAttention,
        recentArchitectSessions: sessions.slice(0, 8).length,
        recentInstallations: installations.slice(0, 8).length,
        failedOrPartialInstalls: failedInstalls,
        activeSupportSessions: supportActive.length,
      },
      recentSessions: sessions.slice(0, 8).map(summarizeSession),
      recentInstallations: installations.slice(0, 8),
      activeSupportSessions: supportActive,
      platformAlerts: buildPlatformAlerts({ failedInstalls, needsAttention, supportActive }),
      recentAudits: audits,
      capabilityGaps: collectGaps(sessions),
      integrationHealth: { status: "projected", note: "Per-business integration health appears on business detail." },
    });
  }

  async listBusinesses({ adminUserId, platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);

    const businesses = await this.platformStore.listBusinesses();
    const rows = [];
    for (const business of businesses) {
      if (isTestBusiness(business)) continue;
      const ownerStatus = await this.platformStore.getBusinessOwnerStatus?.(business.id) ?? "Unknown";
      const installation = await this.platformStore.getBusinessOSInstallation?.(business.id).catch?.(() => null)
        ?? await safeGet(this.platformStore, "getBusinessOSInstallation", business.id);
      rows.push({
        id: String(business.id),
        name: String(business.name ?? "Business"),
        industry: business.industry ?? business.kind ?? "unknown",
        ownerStatus,
        blueprint: installation?.configuration?.blueprintId ?? installation?.plan?.blueprintId ?? null,
        installedOsVersion: installation?.specificationVersion ?? null,
        readiness: installation?.status ?? "not_installed",
        integrationHealth: "unknown",
        users: null,
        lastActivity: business.updatedAt ?? business.createdAt ?? null,
        supportStatus: "none",
        status: business.status ?? "active",
      });
    }

    await this.platformStore.recordAuditEvent?.({
      actorUserId: adminUserId,
      action: "admin.businesses_listed",
      targetType: "platform",
      targetId: "business_directory",
    });

    return deepFreeze({ ok: true, businesses: rows });
  }

  async getBusinessSummary({ adminUserId, platformRole, businessId }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);
    const business = await this.platformStore.getBusiness?.(businessId)
      ?? (await this.platformStore.listBusinesses()).find((entry) => String(entry.id) === String(businessId));
    if (!business) return deepFreeze({ ok: false, reason: "not_found" });

    const ownerStatus = await this.platformStore.getBusinessOwnerStatus?.(businessId);
    const members = await this.platformStore.listMembershipsForBusiness?.(businessId) ?? [];
    const installation = await safeGet(this.platformStore, "getBusinessOSInstallation", businessId);
    const sessions = await this.platformStore.listAiBuilderSessionsForBusiness?.(businessId) ?? [];
    const support = this.supportAccessService
      ? await this.supportAccessService.getActiveSession(adminUserId, businessId)
      : null;

    await this.platformStore.recordAuditEvent?.({
      actorUserId: adminUserId,
      businessId,
      action: "admin.business_viewed",
      targetType: "business",
      targetId: businessId,
    });

    return deepFreeze({
      ok: true,
      business: {
        id: String(business.id),
        name: business.name,
        industry: business.industry ?? business.kind ?? null,
        ownerStatus,
        members: members.map((member) => ({
          userId: member.userId,
          email: member.email,
          role: member.role,
          name: member.userName ?? member.name ?? null,
        })),
        installation: installation ? summarizeInstallation(installation) : null,
        architectSessions: sessions.map(summarizeSession),
        supportSession: support,
        note: "Support access required before entering the business portal. Never silently become owner.",
      },
    });
  }

  async listArchitectSessions({ adminUserId, platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);
    const sessions = await this.platformStore.listAiBuilderSessions?.() ?? [];
    await this.platformStore.recordAuditEvent?.({
      actorUserId: adminUserId,
      action: "admin.architect_sessions_listed",
      targetType: "platform",
      targetId: "architect_sessions",
    });
    return deepFreeze({
      ok: true,
      sessions: sessions.map((session) => ({
        ...summarizeSession(session),
        resumeHref: session.sessionId ? `/architect/${session.sessionId}` : "/architect",
      })),
    });
  }

  listBlueprints({ platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);
    const blueprints = this.blueprintRegistry.list?.({}) ?? [];
    return deepFreeze({
      ok: true,
      blueprints: blueprints.map((blueprint) => ({
        blueprintId: blueprint.blueprintId,
        name: blueprint.name,
        industry: blueprint.industry,
        maturity: blueprint.maturity,
        goldStatus: Boolean(blueprint.goldStatus),
        source: blueprint.source,
        version: blueprint.version,
        supportedCapabilities: blueprint.supportedCapabilities ?? [],
        requiredCapabilities: blueprint.requiredCapabilities ?? [],
        dependencies: blueprint.dependencies ?? [],
      })),
    });
  }

  listComponents({ platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);
    const dashboard = BUSINESS_OS_DASHBOARD_COMPONENTS.map((entry) => ({
      name: entry.label,
      type: entry.type,
      family: "dashboard",
      category: "dashboard",
      supportedData: entry.projectionKinds ?? [],
      permissions: [],
      responsiveSupport: true,
      darkModeSupport: true,
      usageCount: null,
      blueprintUsage: null,
    }));
    return deepFreeze({
      ok: true,
      components: dashboard,
      dashboardComponents: dashboard,
      dashboardTypes: listDashboardComponentTypes(),
    });
  }

  listEmployeeArchetypes({ platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);
    return deepFreeze({
      ok: true,
      archetypes: BUSINESS_OS_EMPLOYEE_ARCHETYPES.map((entry) => ({
        archetypeId: entry.archetypeId,
        label: entry.label,
        purpose: entry.purpose,
        responsibilities: [entry.purpose],
        capabilities: [],
        approvalLimits: ["human_approval_default"],
        knowledgeRequirements: [],
        readiness: "catalog",
        businessesUsing: null,
      })),
    });
  }

  async listInstallations({ adminUserId, platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);
    const businesses = await this.platformStore.listBusinesses();
    const installations = await this._listInstallationsSafe(businesses);
    await this.platformStore.recordAuditEvent?.({
      actorUserId: adminUserId,
      action: "admin.installations_listed",
      targetType: "platform",
      targetId: "install_history",
    });
    return deepFreeze({ ok: true, installations });
  }

  async listPlatformUsers({ adminUserId, platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);
    const users = await this.platformStore.listUsers?.() ?? [];
    await this.platformStore.recordAuditEvent?.({
      actorUserId: adminUserId,
      action: "admin.users_listed",
      targetType: "platform",
      targetId: "users",
    });
    return deepFreeze({
      ok: true,
      users: users.map((user) => ({
        id: String(user.id),
        email: user.email,
        name: user.name,
        platformRole: user.platformRole ?? null,
        createdAt: user.createdAt ?? null,
      })),
    });
  }

  async getPlatformAnalytics({ adminUserId, platformRole }) {
    const dash = await this.getDashboard({ adminUserId, platformRole });
    if (!dash.ok) return dash;
    const blueprints = this.listBlueprints({ platformRole });
    return deepFreeze({
      ok: true,
      metrics: dash.metrics,
      businessesByReadiness: groupBy(dash.recentInstallations, (entry) => entry.status ?? "unknown"),
      architectCompletion: {
        total: dash.recentSessions.length,
        blocked: dash.recentSessions.filter((entry) => /fail|block/i.test(String(entry.stage ?? ""))).length,
      },
      installationOutcomes: {
        failedOrPartial: dash.metrics.failedOrPartialInstalls,
        recent: dash.recentInstallations.length,
      },
      commonCapabilityGaps: dash.capabilityGaps,
      activeSupportSessions: dash.metrics.activeSupportSessions,
      blueprintUsage: blueprints.ok ? blueprints.blueprints.length : 0,
      componentUsage: listDashboardComponentTypes().length,
      honesty: { fabricatedRevenueForbidden: true },
    });
  }

  async _listInstallationsSafe(businesses) {
    const out = [];
    for (const business of businesses.slice(0, 100)) {
      const installation = await safeGet(this.platformStore, "getBusinessOSInstallation", business.id);
      if (installation) {
        out.push({
          ...summarizeInstallation(installation),
          businessId: String(business.id),
          businessName: business.name,
        });
      }
    }
    return out.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  }

  async _listAuditsSafe(limit) {
    if (typeof this.platformStore.listAuditEvents === "function") {
      return this.platformStore.listAuditEvents({ limit });
    }
    return [];
  }

  async _listActiveSupportSafe() {
    if (typeof this.platformStore.listActiveSupportSessions === "function") {
      return this.platformStore.listActiveSupportSessions();
    }
    return [];
  }
}

function summarizeSession(session) {
  return {
    sessionId: session.sessionId ?? session.id,
    businessId: session.businessId ?? null,
    stage: session.currentStage ?? session.stage ?? null,
    status: session.status ?? null,
    progress: session.progress ?? null,
    gaps: session.capabilityGaps ?? [],
    updatedAt: session.updatedAt ?? null,
    blocked: /fail|block/i.test(String(session.status ?? session.currentStage ?? "")),
  };
}

function summarizeInstallation(installation) {
  const history = Array.isArray(installation.history) ? installation.history : [];
  const warnings = history.filter((entry) => /warn|partial/i.test(String(entry.status ?? entry.message ?? "")));
  return {
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion,
    planId: installation.planId,
    planHash: installation.specificationContentHash ?? installation.plan?.planHash ?? null,
    status: installation.status,
    actorUserId: installation.actorUserId,
    startedAt: installation.createdAt ?? installation.installedAt,
    endedAt: installation.updatedAt ?? installation.installedAt,
    checkpoints: installation.actionCheckpoints ?? [],
    warnings,
    partialFailureVisible: /partial|fail/i.test(String(installation.status ?? "")),
    updatedAt: installation.updatedAt,
  };
}

function buildPlatformAlerts({ failedInstalls, needsAttention, supportActive }) {
  const alerts = [];
  if (failedInstalls > 0) {
    alerts.push({ id: "failed_installs", label: `${failedInstalls} failed/partial install(s)`, level: "warning" });
  }
  if (needsAttention > 0) {
    alerts.push({ id: "biz_attention", label: `${needsAttention} business(es) needing attention`, level: "warning" });
  }
  if (supportActive.length) {
    alerts.push({ id: "support_active", label: `${supportActive.length} active support session(s)`, level: "info" });
  }
  return alerts;
}

function collectGaps(sessions) {
  const counts = new Map();
  for (const session of sessions) {
    for (const gap of session.capabilityGaps ?? []) {
      const label = String(gap.label ?? gap.kind ?? "gap");
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));
}

function groupBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = String(keyFn(item) ?? "unknown");
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function isTestBusiness(business) {
  return /journey|test|smoke/i.test(String(business.name ?? ""));
}

async function safeGet(store, method, ...args) {
  if (typeof store[method] !== "function") return null;
  try {
    return await store[method](...args);
  } catch {
    return null;
  }
}
