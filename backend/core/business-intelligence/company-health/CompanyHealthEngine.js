import { buildCompanyHealth } from "./CompanyHealthBuilder.js";
import { validateCompanyHealth } from "./CompanyHealthValidator.js";
import { BusinessCapabilityEngine } from "../../capabilities/engine/BusinessCapabilityEngine.js";

export class CompanyHealthEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
    this.capabilityEngine = new BusinessCapabilityEngine();
  }

  generate({
    companyRuntime,
    companyBrief,
    workspaceConfig,
    nowISO,
    capabilityEngine,
  } = {}) {
    if (!companyRuntime) throw new Error("CompanyHealthEngine.generate requires companyRuntime.");
    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";
    const engine = capabilityEngine ?? this.capabilityEngine;
    const brief = companyBrief;

    const health = buildCompanyHealth({
      companyRuntime,
      companyBrief: brief,
      capabilityEngine: engine,
      workspaceConfig,
      nowISO: effectiveNowISO,
    });

    validateCompanyHealth(health);
    return health;
  }
}

