import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { COMPANY_BRIEF_VERSION, SECTION_ORDER } from "./CompanyBriefDefaults.js";

export function createCompanyBrief({
  briefId,
  companyId,
  generatedAt,
  greeting,
  summary,
  overallStatus,
  sections,
  priorities,
  decisionsWaiting,
  risks,
  opportunities,
  workforceSummary,
  activitySummary,
  recommendedActions,
  metadata,
} = {}) {
  if (!briefId || typeof briefId !== "string") throw new Error("CompanyBrief: briefId required.");
  if (!companyId || typeof companyId !== "string") throw new Error("CompanyBrief: companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") throw new Error("CompanyBrief: generatedAt required.");
  if (!greeting || typeof greeting !== "string") throw new Error("CompanyBrief: greeting required.");
  if (typeof summary !== "string") throw new Error("CompanyBrief: summary required.");
  if (!overallStatus || typeof overallStatus !== "string") throw new Error("CompanyBrief: overallStatus required.");
  if (!Array.isArray(sections)) throw new Error("CompanyBrief: sections required.");
  if (!Array.isArray(priorities)) throw new Error("CompanyBrief: priorities required.");
  if (!Array.isArray(decisionsWaiting)) throw new Error("CompanyBrief: decisionsWaiting required.");
  if (!Array.isArray(risks)) throw new Error("CompanyBrief: risks required.");
  if (!Array.isArray(opportunities)) throw new Error("CompanyBrief: opportunities required.");
  if (!recommendedActions || !Array.isArray(recommendedActions)) throw new Error("CompanyBrief: recommendedActions required.");

  const normalizedSections = [...sections];
  if (normalizedSections.length !== SECTION_ORDER.length) {
    // Allow engines to omit optional sections in the future; Epic 4 requires required sections present.
    // Validator will enforce the exact set.
  }

  const brief = {
    briefId,
    companyId,
    generatedAt,
    greeting,
    summary,
    overallStatus,
    sections,
    priorities,
    decisionsWaiting,
    risks,
    opportunities,
    workforceSummary: workforceSummary ?? deepFreeze({}),
    activitySummary: activitySummary ?? deepFreeze({}),
    recommendedActions,
    metadata: {
      version: COMPANY_BRIEF_VERSION,
      ...((metadata && typeof metadata === "object") ? metadata : {}),
    },
  };

  return deepFreeze(brief);
}

