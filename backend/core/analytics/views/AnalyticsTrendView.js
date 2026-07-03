import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { TREND_ICON_ALLOWED } from "./AnalyticsViewDefaults.js";

function fail(message) {
  throw new Error(`AnalyticsTrendView: ${message}`);
}

export function createAnalyticsTrendView({
  trendId,
  kpiId,
  direction,
  icon,
  severity,
  previousValue,
  currentValue,
  note,
  metadata,
} = {}) {
  if (!trendId) fail("trendId required.");
  if (!kpiId) fail("kpiId required.");
  if (!direction) fail("direction required.");
  if (!icon) fail("icon required.");
  const ic = String(icon);
  if (!TREND_ICON_ALLOWED.includes(ic)) fail(`icon invalid: ${ic}`);
  if (severity === undefined || severity === null || typeof severity !== "number" || !Number.isFinite(severity)) fail("severity must be finite number.");

  const view = {
    trendId: String(trendId),
    kpiId: String(kpiId),
    direction: String(direction),
    icon: ic,
    severity: Number(severity),
    previousValue: previousValue === undefined ? null : Number(previousValue),
    currentValue: currentValue === undefined ? null : Number(currentValue),
    note: String(note ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

