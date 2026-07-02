import { deepFreeze } from "./_utils/deepFreeze.js";

function unique(arr) {
  return Array.from(new Set(arr));
}

function validateNoDuplicates(ids, label) {
  const dupe = ids.find((id, idx) => ids.indexOf(id) !== idx);
  if (dupe) throw new Error(`WorkspaceValidation: duplicate ${label}: ${dupe}`);
}

export function validateWorkspaceConfiguration(config) {
  if (!config || typeof config !== "object") throw new Error("WorkspaceValidation: config required.");

  const moduleIds = (config.modules ?? []).map((m) => m.id);
  validateNoDuplicates(moduleIds, "module");

  // Validate navigation references
  const navItems = [];
  for (const section of config.navigation?.items ?? []) {
    for (const it of section?.items ?? []) navItems.push(it.moduleId);
  }
  for (const moduleId of navItems) {
    if (moduleId && !moduleIds.includes(moduleId)) {
      throw new Error(
        `WorkspaceValidation: navigation refers to missing module: ${moduleId}`,
      );
    }
  }

  // Dashboard widgets must be deterministic (no unknown entries)
  const widgets = config.dashboard?.widgets ?? [];
  const widgetIds = widgets.map((w) => w.id);
  validateNoDuplicates(widgetIds, "widget");

  // Queues consistency: every queue view should reference an actual queue id.
  const queueIds = (config.queues ?? []).map((q) => q.id);
  const viewQueueIds = (config.views ?? [])
    .filter((v) => v.queueId)
    .map((v) => v.queueId);

  for (const qid of viewQueueIds) {
    if (!queueIds.includes(qid)) throw new Error(`WorkspaceValidation: view references missing queue: ${qid}`);
  }

  return deepFreeze({ ok: true });
}

