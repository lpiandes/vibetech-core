import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { KPI_BADGE_ALLOWED, KPI_STATUS_ALLOWED } from "./AnalyticsViewDefaults.js";

function fail(message) {
  throw new Error(`AnalyticsKPIView: ${message}`);
}

export function createAnalyticsKPIView({
  kpiId,
  name,
  category,
  value,
  unit,
  meaning,
  status,
  badge,
  priority,
  metadata,
} = {}) {
  if (!kpiId) fail("kpiId required.");
  if (!name) fail("name required.");
  if (!category) fail("category required.");
  if (typeof value !== "number" || !Number.isFinite(value)) fail("value must be finite number.");
  if (!unit) fail("unit required.");
  if (status === undefined || status === null) fail("status required.");
  const st = String(status);
  if (!KPI_STATUS_ALLOWED.includes(st)) fail(`status invalid: ${st}`);
  const bd = String(badge ?? "");
  if (!KPI_BADGE_ALLOWED.includes(bd)) fail(`badge invalid: ${bd}`);
  if (priority === undefined || priority === null || typeof priority !== "number" || !Number.isFinite(priority)) fail("priority must be finite number.");

  const view = {
    kpiId: String(kpiId),
    name: String(name),
    category: String(category),
    value,
    unit: String(unit),
    meaning: String(meaning ?? ""),
    status: st,
    badge: bd,
    priority: Number(priority),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

