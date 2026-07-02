import { PROVIDER_TYPE_LIST } from "./CapabilityIntelligenceDefaults.js";

function fail(message) {
  throw new Error(`CapabilityIntelligenceValidator: ${message}`);
}

function isFrozenObject(v) {
  return v !== null && typeof v === "object" ? Object.isFrozen(v) : false;
}

export function validateCapabilityIntelligenceReport(report) {
  if (!report || typeof report !== "object") fail("report required.");
  if (!Object.isFrozen(report)) fail("report must be frozen.");

  const requiredFields = [
    "reportId",
    "companyId",
    "generatedAt",
    "summary",
    "overallReadiness",
    "strengths",
    "gaps",
    "risks",
    "recommendations",
    "coverage",
    "metadata",
  ];
  for (const f of requiredFields) {
    if (!(f in report)) fail(`report missing ${f}`);
  }

  if (!Array.isArray(report.strengths)) fail("strengths must be array.");
  if (!Array.isArray(report.gaps)) fail("gaps must be array.");
  if (!Array.isArray(report.risks)) fail("risks must be array.");
  if (!Array.isArray(report.recommendations)) fail("recommendations must be array.");

  if (typeof report.overallReadiness !== "number") fail("overallReadiness must be number.");
  if (report.overallReadiness < 0 || report.overallReadiness > 100) fail("overallReadiness out of range.");

  // Shallow element checks (freeze is enforced by factories).
  const checkItems = (arr, label) => {
    for (const x of arr) {
      if (!isFrozenObject(x)) fail(`${label} entries must be frozen objects.`);
    }
  };
  checkItems(report.strengths, "strengths");
  checkItems(report.gaps, "gaps");
  checkItems(report.risks, "risks");
  checkItems(report.recommendations, "recommendations");

  if (!report.coverage || typeof report.coverage !== "object") fail("coverage must be object.");

  // metadata should be an object.
  if (report.metadata === undefined || report.metadata === null || typeof report.metadata !== "object") fail("metadata must be object.");

  // provider type list is deterministic; only used for basic sanity.
  for (const r of report.risks) {
    if (r.providerType !== null && r.providerType !== undefined && r.providerType !== "") {
      if (!PROVIDER_TYPE_LIST.includes(String(r.providerType))) fail(`risk.providerType unsupported: ${String(r.providerType)}`);
    }
  }

  return true;
}

