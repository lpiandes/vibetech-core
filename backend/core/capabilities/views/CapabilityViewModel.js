import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CapabilityViewModel: ${message}`);
}

export function createCapabilityViewModel({
  viewId,
  companyId,
  generatedAt,
  summary,
  overallReadiness,
  coverage,
  categories,
  providers,
  gaps,
  risks,
  recommendations,
  metrics,
  metadata,
} = {}) {
  if (!viewId || typeof viewId !== "string") fail("viewId required.");
  if (!companyId || typeof companyId !== "string") fail("companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") fail("generatedAt required.");
  if (typeof summary !== "string") fail("summary required string.");
  if (typeof overallReadiness !== "number") fail("overallReadiness required number.");
  if (!coverage || typeof coverage !== "object") fail("coverage required object.");
  if (!Array.isArray(categories)) fail("categories required array.");
  if (!Array.isArray(providers)) fail("providers required array.");
  if (!Array.isArray(gaps)) fail("gaps required array.");
  if (!Array.isArray(risks)) fail("risks required array.");
  if (!Array.isArray(recommendations)) fail("recommendations required array.");
  if (!metrics || typeof metrics !== "object") fail("metrics required object.");

  const vm = {
    viewId,
    companyId,
    generatedAt,
    summary,
    overallReadiness,
    coverage: deepFreeze(coverage),
    categories: deepFreeze(categories),
    providers: deepFreeze(providers),
    gaps: deepFreeze(gaps),
    risks: deepFreeze(risks),
    recommendations: deepFreeze(recommendations),
    metrics: deepFreeze(metrics),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  // deepFreeze doesn't freeze nested arrays by default (it freezes recursively), but we rely on it.
  return deepFreeze(vm);
}

