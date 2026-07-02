import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCompanyOpportunities({
  opportunitiesId,
  companyId,
  generatedAt,
  summary,
  overallPotential,
  opportunities,
  quickWins,
  strategicInvestments,
  recommendedOrder,
  metadata,
} = {}) {
  if (!opportunitiesId || typeof opportunitiesId !== "string") throw new Error("CompanyOpportunities: opportunitiesId required.");
  if (!companyId || typeof companyId !== "string") throw new Error("CompanyOpportunities: companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") throw new Error("CompanyOpportunities: generatedAt required.");
  if (!summary || typeof summary !== "string") throw new Error("CompanyOpportunities: summary required.");
  if (!overallPotential || typeof overallPotential !== "string") throw new Error("CompanyOpportunities: overallPotential required.");
  if (!Array.isArray(opportunities)) throw new Error("CompanyOpportunities: opportunities required.");
  if (!Array.isArray(quickWins)) throw new Error("CompanyOpportunities: quickWins required.");
  if (!Array.isArray(strategicInvestments)) throw new Error("CompanyOpportunities: strategicInvestments required.");
  if (!Array.isArray(recommendedOrder)) throw new Error("CompanyOpportunities: recommendedOrder required.");

  const obj = {
    opportunitiesId,
    companyId,
    generatedAt,
    summary,
    overallPotential,
    opportunities: deepFreeze(opportunities),
    quickWins: deepFreeze(quickWins),
    strategicInvestments: deepFreeze(strategicInvestments),
    recommendedOrder: deepFreeze(recommendedOrder.map(String)),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(obj);
}

