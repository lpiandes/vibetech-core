import { buildCompanyInsights } from "./CompanyInsightBuilder.js";
import { validateCompanyInsights } from "./CompanyInsightValidator.js";

export class CompanyInsightEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  generate({
    previousCompanyHealth,
    currentCompanyHealth,
    previousCompanyBrief,
    currentCompanyBrief,
    previousRuntimeSnapshot,
    currentRuntimeSnapshot,
    nowISO,
  } = {}) {
    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";

    const insights = buildCompanyInsights({
      previousCompanyHealth,
      currentCompanyHealth,
      previousCompanyBrief,
      currentCompanyBrief,
      previousRuntimeSnapshot,
      currentRuntimeSnapshot,
      nowISO: effectiveNowISO,
    });

    validateCompanyInsights(insights);
    return insights;
  }
}

