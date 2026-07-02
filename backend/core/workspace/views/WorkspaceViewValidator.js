import { deepFreeze } from "../_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`WorkspaceViewValidator: ${message}`);
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function validateNoDuplicates(ids, label) {
  const seen = new Set();
  for (const id of ids) {
    const s = String(id);
    if (seen.has(s)) fail(`duplicate ${label}: ${s}`);
    seen.add(s);
  }
}

function isRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export function validateWorkspaceViews(workspaceConfig, derivedViews = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    fail("workspaceConfig required.");
  }

  const modules = Array.isArray(workspaceConfig.modules) ? workspaceConfig.modules : [];
  const moduleIds = modules.map((m) => m?.id).filter(Boolean).map(String);
  if (moduleIds.length === 0) {
    fail("no modules found.");
  }
  validateNoDuplicates(moduleIds, "module id");

  // Navigation consistency: each nav item moduleId must exist in modules.
  const navItems = [];
  const navigation = workspaceConfig.navigation;
  if (navigation && Array.isArray(navigation.items)) {
    for (const section of navigation.items) {
      if (!section || !Array.isArray(section.items)) continue;
      for (const it of section.items) {
        if (it?.moduleId) navItems.push(String(it.moduleId));
      }
    }
  }

  for (const moduleId of navItems) {
    if (!moduleIds.includes(moduleId)) fail(`navigation refers to missing module: ${moduleId}`);
  }

  // Dashboard consistency: dashboard.defaultWidgets must map to widgets list.
  const widgets = Array.isArray(workspaceConfig.widgets) ? workspaceConfig.widgets : [];
  const widgetIds = widgets.map((w) => w?.id).filter(Boolean).map(String);
  const dashboard = workspaceConfig.dashboard;
  const defaultWidgets = Array.isArray(dashboard?.defaultWidgets) ? dashboard.defaultWidgets : [];

  const defaultWidgetIds = defaultWidgets.map((id) => String(id));
  validateNoDuplicates(defaultWidgetIds, "widget id");
  for (const wid of defaultWidgetIds) {
    if (!widgetIds.includes(wid)) fail(`dashboard defaultWidgets refers to missing widget: ${wid}`);
  }

  // Queue/view integrity: every config.views entry with queueId must reference a config.queues entry.
  const queues = Array.isArray(workspaceConfig.queues) ? workspaceConfig.queues : [];
  const queueIds = queues.map((q) => q?.id).filter(Boolean).map(String);

  const views = Array.isArray(workspaceConfig.views) ? workspaceConfig.views : [];
  const viewIds = views.map((v) => v?.id).filter(Boolean).map(String);
  if (viewIds.length > 0) validateNoDuplicates(viewIds, "view id");

  for (const v of views) {
    if (!v?.queueId) continue;
    const qid = String(v.queueId);
    if (!queueIds.includes(qid)) fail(`view references missing queue: ${qid}`);
  }

  // Duplicate derived view ids (if present).
  const derived = isRecord(derivedViews) ? derivedViews : {};
  const derivedIds = Object.entries(derived)
    .map(([, vm]) => (vm && typeof vm === "object" && vm.id ? String(vm.id) : null))
    .filter(Boolean);
  if (derivedIds.length > 0) validateNoDuplicates(derivedIds, "derived view id");

  return deepFreeze({ ok: true, navItems: unique(navItems) });
}

