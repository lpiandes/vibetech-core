import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCompanyInsights({
  insightsId,
  companyId,
  generatedAt,
  comparisonWindow,
  summary,
  insights,
  notableChanges,
  positiveChanges,
  negativeChanges,
  neutralChanges,
  recommendedAttention,
  metadata,
} = {}) {
  if (!insightsId || typeof insightsId !== "string") throw new Error("CompanyInsights: insightsId required.");
  if (!companyId || typeof companyId !== "string") throw new Error("CompanyInsights: companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") throw new Error("CompanyInsights: generatedAt required.");
  if (!comparisonWindow || typeof comparisonWindow !== "object") {
    throw new Error("CompanyInsights: comparisonWindow required.");
  }
  if (!summary || typeof summary !== "string") throw new Error("CompanyInsights: summary required.");
  if (!Array.isArray(insights)) throw new Error("CompanyInsights: insights required.");

  const payload = {
    insightsId,
    companyId,
    generatedAt,
    comparisonWindow,
    summary,
    insights: deepFreeze(insights),
    notableChanges: deepFreeze(notableChanges ?? []),
    positiveChanges: deepFreeze(positiveChanges ?? []),
    negativeChanges: deepFreeze(negativeChanges ?? []),
    neutralChanges: deepFreeze(neutralChanges ?? []),
    recommendedAttention: deepFreeze(recommendedAttention ?? []),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(payload);
}

