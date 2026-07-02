import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCompanyRecommendations({
  recommendationsId,
  companyId,
  generatedAt,
  summary,
  recommendations,
  topRecommendation,
  immediateActions,
  nextActions,
  laterActions,
  metadata,
} = {}) {
  if (!recommendationsId || typeof recommendationsId !== "string") throw new Error("CompanyRecommendations: recommendationsId required.");
  if (!companyId || typeof companyId !== "string") throw new Error("CompanyRecommendations: companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") throw new Error("CompanyRecommendations: generatedAt required.");
  if (!summary || typeof summary !== "string") throw new Error("CompanyRecommendations: summary required.");
  if (!Array.isArray(recommendations)) throw new Error("CompanyRecommendations: recommendations required.");
  if (!topRecommendation || typeof topRecommendation !== "object") throw new Error("CompanyRecommendations: topRecommendation required.");
  if (!Array.isArray(immediateActions)) throw new Error("CompanyRecommendations: immediateActions required.");
  if (!Array.isArray(nextActions)) throw new Error("CompanyRecommendations: nextActions required.");
  if (!Array.isArray(laterActions)) throw new Error("CompanyRecommendations: laterActions required.");

  const payload = {
    recommendationsId,
    companyId,
    generatedAt,
    summary,
    recommendations: deepFreeze(recommendations),
    topRecommendation: deepFreeze(topRecommendation),
    immediateActions: deepFreeze(immediateActions),
    nextActions: deepFreeze(nextActions),
    laterActions: deepFreeze(laterActions),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(payload);
}

