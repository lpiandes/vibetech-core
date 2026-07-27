import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { isPlatformAdmin } from "../platform/persistence/platformMappers.js";
import { isLikelyAutomatedTestBusiness } from "../platform/platformTestData.js";
import { getDefaultBlueprintRegistry } from "../blueprints/BlueprintRegistry.js";
import { BUSINESS_OS_EMPLOYEE_ARCHETYPES } from "../business-os/BusinessOSEmployeeArchetypes.js";
import { listDashboardComponentTypes, BUSINESS_OS_DASHBOARD_COMPONENTS } from "../business-os/BusinessOSDashboardComponentRegistry.js";
import { getDefaultCapabilityPackageRegistry } from "../ai-builder/capability-packages/CapabilityPackageRegistry.js";
import { buildOperatorActions } from "./buildOperatorActions.js";
import { notifyPlatformOperators } from "./notifyPlatformOperators.js";

function fail(message) {
  throw new Error(`AdminPlatformService: ${message}`);
}

/**
 * VIBETech Admin Platform orchestration — wraps existing stores/registries.
 * Does not invent parallel auth or become business owner.
 * Dashboard/directory evidence excludes automated pilot/test tenants.
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

    const allBusinesses = await this.platformStore.listBusinesses();
    const businesses = allBusinesses.filter((business) => !isTestBusiness(business));
    const testBusinessIds = new Set(
      allBusinesses.filter((business) => isTestBusiness(business)).map((business) => String(business.id)),
    );

    const allSessions = await this.platformStore.listAiBuilderSessions?.() ?? [];
    const sessions = allSessions.filter((session) => {
      const businessId = session.businessId == null ? null : String(session.businessId);
      if (businessId && testBusinessIds.has(businessId)) return false;
      if (isTestBusiness({ name: session.businessSummary?.businessName ?? session.appearance?.businessName })) {
        return false;
      }
      return true;
    });

    const installations = await this._listInstallationsSafe(businesses);
    const audits = (await this._listAuditsSafe(40))
      .filter((event) => !isNoiseAuditAction(event?.action));
    const supportActive = await this._listActiveSupportSafe();

    const needsAttention = businesses.filter((business) => {
      const status = String(business.status ?? business.ownerStatus ?? "").toLowerCase();
      return /attention|failed|partial|inactive/.test(status);
    }).length;

    const failedInstalls = installations.filter((entry) => /fail|partial/i.test(String(entry.status ?? ""))).length;

    const operatorActions = await buildOperatorActions({
      businesses,
      listCredentials: (businessId) =>
        this.platformStore.listIntegrationCredentialsForWorkspace?.(businessId) ?? [],
      failedInstalls: installations
        .filter((entry) => /fail|partial/i.test(String(entry.status ?? "")))
        .map((entry) => ({
          ...entry,
          businessName: businesses.find((b) => String(b.id) === String(entry.businessId))?.name ?? null,
        })),
    });

    // Fire-and-forget email/Slack notify when configured (deduped; never blocks dashboard).
    void notifyPlatformOperators({ actions: operatorActions, force: false }).catch(() => {});

    return deepFreeze({
      ok: true,
      metrics: {
        totalBusinesses: businesses.length,
        activeBusinesses: businesses.filter((entry) => !entry.archivedAt && entry.status !== "archived").length,
        needingAttention: Math.max(needsAttention, operatorActions.length),
        // Totals — never the length of a "recent" slice (that looked like hardcoded 8s).
        architectSessions: sessions.length,
        installations: installations.length,
        failedOrPartialInstalls: failedInstalls,
        activeSupportSessions: supportActive.length,
        operatorActions: operatorActions.length,
        // Keep legacy keys for older UI bindings.
        recentArchitectSessions: sessions.length,
        recentInstallations: installations.length,
      },
      recentSessions: latestSessionPerBusiness(sessions)
        .slice(0, 6)
        .map(summarizeSession),
      recentInstallations: installations.slice(0, 6),
      activeSupportSessions: supportActive,
      platformAlerts: buildPlatformAlerts({
        failedInstalls,
        needsAttention,
        supportActive,
        operatorActions,
      }),
      operatorActions,
      recentAudits: audits.slice(0, 6).map(summarizeAudit),
      capabilityGaps: collectGaps(sessions),
      businesses: businesses
        .slice()
        .sort((left, right) => String(right.updatedAt ?? right.createdAt ?? "").localeCompare(String(left.updatedAt ?? left.createdAt ?? "")))
        .slice(0, 8)
        .map((business) => ({
          id: String(business.id),
          name: String(business.name ?? "Business"),
          status: business.status ?? "active",
          href: `/admin/businesses/${encodeURIComponent(business.id)}`,
        })),
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
        packageConfiguration: business.packageConfiguration ?? {},
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
    const businesses = await this.platformStore.listBusinesses();
    const testBusinessIds = new Set(
      businesses.filter((business) => isTestBusiness(business)).map((business) => String(business.id)),
    );
    const sessions = (await this.platformStore.listAiBuilderSessions?.() ?? []).filter((session) => {
      const businessId = session.businessId == null ? null : String(session.businessId);
      if (businessId && testBusinessIds.has(businessId)) return false;
      return true;
    });
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
    const businesses = (await this.platformStore.listBusinesses()).filter((business) => !isTestBusiness(business));
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
      capabilityHonesty: getDefaultCapabilityPackageRegistry().honestyMatrix(),
    });
  }

  getCapabilityHonesty({ platformRole }) {
    const gate = this.assertAdmin(platformRole);
    if (!gate.ok) return deepFreeze(gate);
    return deepFreeze({
      ok: true,
      packages: getDefaultCapabilityPackageRegistry().honestyMatrix(),
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

function latestSessionPerBusiness(sessions) {
  const sorted = sessions
    .slice()
    .sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")));
  const seen = new Set();
  const out = [];
  for (const session of sorted) {
    const key = session.businessId == null
      ? `session:${session.sessionId ?? session.id}`
      : `business:${session.businessId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(session);
  }
  return out;
}

function summarizeSession(session) {
  return {
    sessionId: session.sessionId ?? session.id,
    businessId: session.businessId ?? null,
    businessName:
      session.businessSummary?.businessName
      ?? session.appearance?.businessName
      ?? null,
    stage: session.currentStage ?? session.stage ?? null,
    stageLabel: humanizeArchitectStage(session.currentStage ?? session.stage),
    status: session.status ?? null,
    progress: session.progress ?? null,
    gaps: session.capabilityGaps ?? [],
    updatedAt: session.updatedAt ?? null,
    blocked: /fail|block/i.test(String(session.status ?? session.currentStage ?? "")),
    href: session.businessId
      ? `/admin/businesses/${encodeURIComponent(session.businessId)}`
      : (session.sessionId ? `/architect/${session.sessionId}` : "/admin/architect"),
  };
}

function summarizeAudit(event) {
  return {
    id: event.id ?? `${event.action}-${event.createdAt}`,
    action: event.action,
    label: humanizeAuditAction(event.action),
    createdAt: event.createdAt ?? null,
    when: formatRelativeTime(event.createdAt),
  };
}

function humanizeArchitectStage(stage) {
  const key = String(stage ?? "").toLowerCase();
  if (!key) return "In progress";
  if (key === "installed") return "Live";
  if (key === "awaiting_review" || key === "proposal_ready") return "Waiting on review";
  if (key === "awaiting_approval") return "Waiting on approval";
  if (key === "interviewing" || key === "discovering") return "Learning the business";
  if (key === "installing") return "Going live";
  if (key === "dry_run_ready") return "Ready to check";
  if (key === "failed" || key === "blocked") return "Needs attention";
  return key.replace(/_/g, " ");
}

function humanizeAuditAction(action) {
  const key = String(action ?? "");
  if (/architect\.installed/i.test(key)) return "Business went live";
  if (/architect\.improved/i.test(key)) return "Ask change applied";
  if (/architect\.change/i.test(key)) return "Change executed";
  if (/support\.enter/i.test(key)) return "Support entered a business";
  if (/support\.exit/i.test(key)) return "Support exited a business";
  if (/invitation/i.test(key)) return "Invitation sent";
  return key.replace(/[._]/g, " ");
}

function formatRelativeTime(value) {
  if (!value) return null;
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  const delta = Date.now() - ms;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
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

function buildPlatformAlerts({ failedInstalls, needsAttention, supportActive, operatorActions = [] }) {
  const alerts = [];
  if (operatorActions.length > 0) {
    alerts.push({
      id: "operator_actions",
      label: `${operatorActions.length} exception(s) need you — open Platform exceptions below`,
      level: "warning",
    });
  }
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
  return isLikelyAutomatedTestBusiness({
    name: business?.name ?? business?.businessName ?? null,
    ownerInviteEmail: business?.ownerInviteEmail ?? business?.ownerEmail ?? null,
  });
}

function isNoiseAuditAction(action) {
  return /admin\.(dashboard_viewed|businesses_listed|architect_sessions_listed|installations_listed|users_listed|business_viewed)/i
    .test(String(action ?? ""));
}

async function safeGet(store, method, ...args) {
  if (typeof store[method] !== "function") return null;
  try {
    return await store[method](...args);
  } catch {
    return null;
  }
}
