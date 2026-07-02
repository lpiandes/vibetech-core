import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { VIEW_ID_CAPABILITIES, PROVIDER_STATUS } from "./CapabilityViewDefaults.js";
import { createCapabilityViewModel } from "./CapabilityViewModel.js";
import { validateCapabilityViewModel } from "./CapabilityViewValidator.js";

import { createCapabilitySummaryView } from "./CapabilitySummaryView.js";
import { createCapabilityCategoryView } from "./CapabilityCategoryView.js";
import { createCapabilityProviderView } from "./CapabilityProviderView.js";
import { createCapabilityGapView } from "./CapabilityGapView.js";
import { createCapabilityRiskView } from "./CapabilityRiskView.js";
import { createCapabilityRecommendationView } from "./CapabilityRecommendationView.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function statusForCategory({ requiredCount, coveredCount }) {
  const r = Number(requiredCount ?? 0);
  const c = Number(coveredCount ?? 0);
  if (r <= 0) return "unknown";
  if (c >= r) return "fully_covered";
  if (c > 0) return "partially_covered";
  return "missing";
}

function computeProviderStatus({ providerType, risks } = {}) {
  const pt = String(providerType ?? "");
  const inactive = safeArray(risks).some((r) => r.type === "inactive_provider" && String(r.providerType ?? "") === pt);
  if (inactive) return PROVIDER_STATUS.inactive;
  const overloaded = safeArray(risks).some((r) => r.type === "overloaded_provider" && String(r.providerType ?? "") === pt);
  if (overloaded) return PROVIDER_STATUS.overloaded;
  return PROVIDER_STATUS.available;
}

export class CapabilityViewAdapter {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  translate({ capabilityRuntime, capabilityIntelligenceReport, companyWorkspaceRuntime, nowISO } = {}) {
    if (!capabilityRuntime) throw new Error("CapabilityViewAdapter.translate requires capabilityRuntime.");
    if (!capabilityIntelligenceReport) throw new Error("CapabilityViewAdapter.translate requires capabilityIntelligenceReport.");

    const report = capabilityIntelligenceReport;
    const effectiveNowISO = nowISO ?? this.nowISO ?? report.generatedAt ?? "2026-07-01T00:00:00.000Z";

    const capabilities = safeArray(capabilityRuntime.getCapabilities?.());
    const capabilitiesById = Object.fromEntries(capabilities.map((c) => [String(c.id), c]));
    const categories = safeArray(capabilityRuntime.getCategories?.());

    const required = safeArray(report.coverage?.requiredCapabilities).map(String);
    const covered = safeArray(report.coverage?.coveredCapabilities).map(String);
    const coveredSet = new Set(covered);

    // Category coverage mapping only uses canonical report fields.
    const byCategoryRequired = {};
    const byCategoryCovered = {};
    const unknownCategoryId = "unknown";

    for (const capId of required) {
      const cap = capabilitiesById[capId] ?? null;
      const cid = cap ? String(cap.category ?? unknownCategoryId) : unknownCategoryId;
      byCategoryRequired[cid] = (byCategoryRequired[cid] ?? 0) + 1;
      if (coveredSet.has(String(capId))) byCategoryCovered[cid] = (byCategoryCovered[cid] ?? 0) + 1;
    }

    const categoryViews = [];
    for (const cat of categories) {
      const cid = String(cat.id);
      if (!(cid in byCategoryRequired)) continue;
      const r = byCategoryRequired[cid] ?? 0;
      const c = byCategoryCovered[cid] ?? 0;
      categoryViews.push(
        createCapabilityCategoryView({
          id: cid,
          name: String(cat.name),
          summary: `${c}/${r} covered`,
          status: statusForCategory({ requiredCount: r, coveredCount: c }),
          requiredCount: r,
          coveredCount: c,
          metadata: deepFreeze({ derivedFrom: { reportId: report.reportId, categoryId: cid } }),
        }),
      );
    }

    if ((byCategoryRequired[unknownCategoryId] ?? 0) > 0) {
      categoryViews.push(
        createCapabilityCategoryView({
          id: unknownCategoryId,
          name: "Unknown",
          summary: `${byCategoryCovered[unknownCategoryId] ?? 0}/${byCategoryRequired[unknownCategoryId] ?? 0} covered`,
          status: statusForCategory({
            requiredCount: byCategoryRequired[unknownCategoryId] ?? 0,
            coveredCount: byCategoryCovered[unknownCategoryId] ?? 0,
          }),
          requiredCount: byCategoryRequired[unknownCategoryId] ?? 0,
          coveredCount: byCategoryCovered[unknownCategoryId] ?? 0,
          metadata: deepFreeze({ derivedFrom: { reportId: report.reportId } }),
        }),
      );
    }

    // Providers: derived from risks + capability definitions + covered capability ids.
    const providerTypes = new Set();
    for (const capId of required) {
      const cap = capabilitiesById[capId];
      if (!cap) continue;
      for (const pt of safeArray(cap.providedBy)) providerTypes.add(String(pt));
    }

    const riskList = safeArray(report.risks);
    const providerViews = [];
    for (const pt of Array.from(providerTypes).sort((a, b) => String(a).localeCompare(String(b)))) {
      const ptStr = String(pt);
      const capRequiredCount = required.filter((capId) => {
        const cap = capabilitiesById[capId];
        return cap && safeArray(cap.providedBy).includes(ptStr);
      }).length;

      const capCoveredCount = required.filter((capId) => {
        if (!coveredSet.has(String(capId))) return false;
        const cap = capabilitiesById[capId];
        return cap && safeArray(cap.providedBy).includes(ptStr);
      }).length;

      providerViews.push(
        createCapabilityProviderView({
          providerType: ptStr,
          status: computeProviderStatus({ providerType: ptStr, risks: riskList }),
          capabilityCountRequired: capRequiredCount,
          capabilityCountCovered: capCoveredCount,
          metadata: deepFreeze({ derivedFrom: { reportId: report.reportId, providerType: ptStr } }),
        }),
      );
    }

    const gapViews = safeArray(report.gaps).map((g) => {
      const cap = capabilitiesById[String(g.capabilityId ?? "")] ?? null;
      return createCapabilityGapView({
        id: String(g.id),
        capabilityId: String(g.capabilityId ?? ""),
        name: cap ? safeString(cap.name) : "Unknown capability",
        reason: safeString(g.reason),
        metadata: deepFreeze({ derivedFrom: { reportId: report.reportId, gapId: String(g.id) } }),
      });
    });

    const riskViews = safeArray(report.risks).map((r) =>
      createCapabilityRiskView({
        id: String(r.id),
        type: String(r.type ?? ""),
        capabilityId: r.capabilityId === null || r.capabilityId === undefined ? null : String(r.capabilityId),
        providerType: r.providerType === null || r.providerType === undefined ? null : String(r.providerType),
        severity: Number(r.severity ?? 0),
        message: safeString(r.message),
        metadata: deepFreeze({ derivedFrom: { reportId: report.reportId, riskId: String(r.id) } }),
      }),
    );

    const recViews = safeArray(report.recommendations).map((rec) =>
      createCapabilityRecommendationView({
        id: String(rec.id),
        type: String(rec.type ?? ""),
        description: safeString(rec.description),
        priority: Number(rec.priority ?? 0),
        relatedCapabilityIds: safeArray(rec.relatedCapabilityIds),
        metadata: deepFreeze({ derivedFrom: { reportId: report.reportId, recommendationId: String(rec.id) } }),
      }),
    );

    const cov = report.coverage ?? {};
    const summaryView = createCapabilitySummaryView({
      overallReadiness: report.overallReadiness,
      coverageScore: cov.coverageScore,
      gapScore: cov.gapScore,
      riskScore: cov.riskScore,
      coverageSummary: `${safeString(cov.coverageScore)}% coverage`,
      metadata: deepFreeze({ derivedFrom: { reportId: report.reportId } }),
    });

    const metrics = deepFreeze({
      totalRequiredCapabilities: safeArray(cov.requiredCapabilities).length,
      totalCoveredCapabilities: safeArray(cov.coveredCapabilities).length,
      gapCount: safeArray(report.gaps).length,
      riskCount: safeArray(report.risks).length,
      recommendationCount: safeArray(report.recommendations).length,
      coverageScore: Number(cov.coverageScore ?? 0),
      gapScore: Number(cov.gapScore ?? 0),
      riskScore: Number(cov.riskScore ?? 0),
      overallReadiness: Number(report.overallReadiness ?? 0),
      coverageSummary: summaryView.coverageSummary,
    });

    const vm = createCapabilityViewModel({
      viewId: VIEW_ID_CAPABILITIES,
      companyId: String(report.companyId ?? "company"),
      generatedAt: String(report.generatedAt ?? effectiveNowISO),
      summary: safeString(report.summary),
      overallReadiness: Number(report.overallReadiness ?? 0),
      coverage: deepFreeze({
        ...(cov && typeof cov === "object" ? cov : {}),
        unmatchedWorkRequirements: safeArray(cov.unmatchedWorkRequirements).map(String),
      }),
      categories: deepFreeze(categoryViews),
      providers: deepFreeze(providerViews),
      gaps: deepFreeze(gapViews),
      risks: deepFreeze(riskViews),
      recommendations: deepFreeze(recViews),
      metrics,
      metadata: deepFreeze({
        derivedFrom: { reportId: report.reportId },
        intelligenceVersion: 1,
        viewGeneratedAt: String(effectiveNowISO),
      }),
    });

    validateCapabilityViewModel(vm);
    return vm;
  }
}

