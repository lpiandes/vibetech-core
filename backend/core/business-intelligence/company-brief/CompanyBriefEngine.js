import { buildCompanyBrief } from "./CompanyBriefBuilder.js";

/**
 * CompanyBriefEngine
 *
 * Deterministically composes the canonical executive brief from Company Runtime.
 * This engine does not mutate Company Runtime state.
 */
export class CompanyBriefEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  generate({ companyRuntime, nowISO } = {}) {
    if (!companyRuntime) throw new Error("CompanyBriefEngine.generate requires companyRuntime.");
    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";
    return buildCompanyBrief({ companyRuntime, nowISO: effectiveNowISO });
  }
}

