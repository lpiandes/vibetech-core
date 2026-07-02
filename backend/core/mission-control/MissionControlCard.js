import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createMissionControlCard({
  id,
  title,
  subtitle,
  summary,
  status,
  priority,
  metric,
  trend,
  actions,
  source,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") throw new Error("MissionControlCard: id required.");
  if (!title || typeof title !== "string") throw new Error("MissionControlCard: title required.");
  if (!subtitle || typeof subtitle !== "string") throw new Error("MissionControlCard: subtitle required.");
  if (!summary || typeof summary !== "string") throw new Error("MissionControlCard: summary required.");

  const obj = {
    id,
    title,
    subtitle,
    summary,
    status: status ? String(status) : "",
    priority: priority ? String(priority) : "",
    metric: typeof metric === "number" ? metric : metric ?? null,
    trend: trend ? String(trend) : null,
    actions: Array.isArray(actions) ? deepFreeze(actions.map(String)) : deepFreeze([]),
    source: source ? String(source) : "",
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(obj);
}

