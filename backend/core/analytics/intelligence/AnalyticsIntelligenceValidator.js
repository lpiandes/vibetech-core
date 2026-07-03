import { TREND_DIRECTIONS } from "./AnalyticsIntelligenceDefaults.js";

function fail(message) {
  throw new Error(`AnalyticsIntelligenceValidator: ${message}`);
}

function isFrozenObject(v) {
  return v !== null && typeof v === "object" ? Object.isFrozen(v) : false;
}

export function validateAnalyticsIntelligenceReport(report) {
  if (!report || typeof report !== "object") fail("report required.");
  if (!Object.isFrozen(report)) fail("report must be frozen.");

  const requiredFields = [
    "reportId",
    "companyId",
    "generatedAt",
    "summary",
    "overallPerformance",
    "kpis",
    "trends",
    "insights",
    "recommendations",
    "metrics",
    "metadata",
  ];
  for (const f of requiredFields) {
    if (!(f in report)) fail(`report missing ${f}`);
  }

  if (!Array.isArray(report.kpis)) fail("kpis must be array.");
  if (!Array.isArray(report.trends)) fail("trends must be array.");
  if (!Array.isArray(report.insights)) fail("insights must be array.");
  if (!Array.isArray(report.recommendations)) fail("recommendations must be array.");
  if (!Array.isArray(report.metrics)) fail("metrics must be array.");

  if (typeof report.overallPerformance !== "number" || !Number.isFinite(report.overallPerformance)) fail("overallPerformance must be finite number.");
  if (report.overallPerformance < 0 || report.overallPerformance > 100) fail("overallPerformance out of range.");

  const checkItems = (arr, label) => {
    for (const x of arr) {
      if (!isFrozenObject(x)) fail(`${label} entries must be frozen objects.`);
    }
  };
  checkItems(report.kpis, "kpis");
  checkItems(report.trends, "trends");
  checkItems(report.insights, "insights");
  checkItems(report.recommendations, "recommendations");
  checkItems(report.metrics, "metrics");

  // Minimal shape: ensure trend directions are allowed.
  for (const t of report.trends) {
    if (!TREND_DIRECTIONS.includes(String(t.direction))) fail(`trend direction invalid: ${String(t.direction)}`);
  }

  if (!report.metadata || typeof report.metadata !== "object") fail("metadata must be object.");

  return true;
}

