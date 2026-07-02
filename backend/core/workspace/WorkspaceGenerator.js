import { createDefaultWorkspaceModules } from "./WorkspaceModuleRegistry.js";
import { buildWorkspaceDashboard } from "./WorkspaceDashboard.js";
import { createWorkspaceWidget } from "./WorkspaceWidget.js";
import { buildWorkspaceQueue } from "./WorkspaceQueue.js";
import { buildWorkspaceRecommendations } from "./WorkspaceRecommendation.js";
import { validateWorkspaceConfiguration } from "./WorkspaceValidation.js";
import { createWorkspaceConfiguration } from "./WorkspaceConfiguration.js";
import { WORKSPACE_DEFAULT_VERSION, MODULE_REGISTRY } from "./WorkspaceDefaults.js";

import { NavigationService } from "./navigation/NavigationService.js";

function statusByCapabilityId(businessCapabilities) {
  const caps = Array.isArray(businessCapabilities)
    ? businessCapabilities
    : Array.isArray(businessCapabilities?.capabilities)
      ? businessCapabilities.capabilities
      : [];
  const map = new Map();
  for (const c of caps) {
    if (!c || !c.id) continue;
    map.set(String(c.id), c.status);
  }
  return map;
}

function isModuleEnabled({ module, capabilityStatusMap, connectedSystems, industryPrimaryIndustry } = {}) {
  if (!module) return false;
  const capsOk = (module.requiredCapabilities ?? []).every((id) => capabilityStatusMap.get(String(id)) === "READY");
  if (!capsOk) return false;

  // Connected system feature availability
  if (Array.isArray(module.requiredConnectedSystems) && module.requiredConnectedSystems.length > 0) {
    const sys = Array.isArray(connectedSystems) ? connectedSystems : [];
    const features = new Set();
    for (const s of sys) {
      if (s?.status !== "READY") continue;
      if (Array.isArray(s.features)) for (const f of s.features) features.add(String(f));
    }
    for (const reqFeature of module.requiredConnectedSystems ?? []) {
      if (!features.has(String(reqFeature))) return false;
    }
  }

  // Knowledge requirement (optional)
  // For Sprint 1, we treat module.requiredKnowledge as optional gating only.
  return true;
}

export class WorkspaceGenerator {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO ?? "2026-07-01T00:00:00.000Z";
  }

  generate({
    runtime,
    companyProfile,
    businessProfile,
    knowledge,
    connectedSystems,
    businessCapabilities,
    industryTemplate,
    nowISO,
  } = {}) {
    if (!runtime) throw new Error("WorkspaceGenerator.generate requires `runtime`.");

    const resolvedConnectedSystems = connectedSystems ?? runtime.getConnectedSystems?.() ?? [];
    const capabilityStatusMap = statusByCapabilityId(businessCapabilities);

    const industry = businessProfile?.industry?.primaryIndustry ?? runtime.getBusinessProfile?.()?.industry?.primaryIndustry ?? "";
    const template = industryTemplate ?? businessProfile?.industry?.industryTemplate ?? null;

    const allModules = createDefaultWorkspaceModules();

    const enabledModules = allModules.filter((m) =>
      isModuleEnabled({
        module: m,
        capabilityStatusMap,
        connectedSystems: resolvedConnectedSystems,
        industryPrimaryIndustry: industry,
      }),
    );

    // Always include base modules that do not require capabilities.
    const baseIncludedIds = MODULE_REGISTRY.filter((m) => (m.requiredCapabilities ?? []).length === 0).map((m) => m.id);
    for (const id of baseIncludedIds) {
      if (!enabledModules.some((m) => m.id === id)) {
        const mod = allModules.find((m) => m.id === id);
        if (mod) enabledModules.push(mod);
      }
    }

    // Stable deterministic module ordering by navigation section/item.
    enabledModules.sort((a, b) => {
      const as = a.navigation?.section ?? "Workspace";
      const bs = b.navigation?.section ?? "Workspace";
      const ao = as.localeCompare(bs);
      if (ao !== 0) return ao;
      return (a.navigation?.item ?? a.title).localeCompare(b.navigation?.item ?? b.title);
    });

    const navigation = new NavigationService({ nowISO: nowISO ?? this.nowISO }).generate({
      modules: enabledModules,
    });

    const widgetIds = [];
    for (const m of enabledModules) {
      for (const w of m.defaultWidgets ?? []) widgetIds.push(String(w));
    }

    // Template recommended widgets are contract-only ids.
    const templateRecommendedWidgets = Array.isArray(template?.recommendedDashboardModules)
      ? template.recommendedDashboardModules
      : [];
    for (const w of templateRecommendedWidgets) {
      if (!widgetIds.includes(String(w))) widgetIds.push(String(w));
    }

    // De-dup preserving order.
    const seen = new Set();
    const uniqueWidgetIds = [];
    for (const id of widgetIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      uniqueWidgetIds.push(id);
    }

    const widgets = uniqueWidgetIds.map((id) => createWorkspaceWidget(id));

    const capabilitySummary = {
      overallReadiness: businessCapabilities?.overallReadiness ?? "IN_PROGRESS",
    };

    const dashboard = buildWorkspaceDashboard({ modules: enabledModules, widgets: uniqueWidgetIds, capabilitySummary });

    const queues = [];
    const views = [];
    if (enabledModules.some((m) => m.id === "work_queue")) {
      const q = buildWorkspaceQueue({ runtime, queueId: "work_queue" });
      queues.push(q);
      views.push({ id: "work_queue_view", queueId: "work_queue", title: "Queue View" });
    }

    const digitalWorkforceLayout = deepFreeze({
      sections: [
        ...(enabledModules.some((m) => m.id === "knowledge") ? [{ id: "Knowledge", enabled: true }] : []),
        ...(enabledModules.some((m) => m.id === "communications") ? [{ id: "Communications", enabled: true }] : []),
      ],
    });

    const knowledgeLayout = deepFreeze({
      categories: enabledModules.some((m) => m.id === "knowledge") ? runtime.getKnowledgeCategories?.().items ?? [] : [],
    });

    const analyticsLayout = deepFreeze({
      enabled: enabledModules.some((m) => m.id === "analytics"),
    });

    const communicationSetup = runtime.getCommunicationSetup?.();
    const communicationsModuleEnabled = enabledModules.some((m) => m.id === "communications");

    const morningBriefConfiguration = deepFreeze({
      enabled: communicationsModuleEnabled,
      quietHours: communicationSetup?.quietHours ?? {},
      tone: communicationSetup?.communicationDefaults?.defaultTone ?? "Professional",
    });

    const notifications = deepFreeze({
      enabled: communicationsModuleEnabled && Boolean(communicationSetup?.readiness?.quietHoursReady),
      quietHours: communicationSetup?.quietHours ?? {},
      channels: ["EMAIL"],
    });

    const recommendations = buildWorkspaceRecommendations({ capabilities: businessCapabilities?.capabilities ?? businessCapabilities ?? [] });

    const permissions = deepFreeze({
      read: enabledModules.map((m) => m.permissions?.read ?? []).flat(),
    });

    const config = createWorkspaceConfiguration({
      navigation,
      modules: enabledModules,
      dashboard,
      widgets,
      queues,
      views,
      digitalWorkforceLayout,
      knowledgeLayout,
      analyticsLayout,
      morningBriefConfiguration,
      notifications,
      recommendations,
      permissions,
      metadata: {
        version: WORKSPACE_DEFAULT_VERSION,
        generatedAt: nowISO ?? this.nowISO,
        industry,
      },
    });

    validateWorkspaceConfiguration(config);
    return config;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

