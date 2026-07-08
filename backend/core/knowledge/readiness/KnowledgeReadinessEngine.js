import crypto from "node:crypto";

import { KNOWLEDGE_READINESS_DEFAULTS } from "./KnowledgeReadinessDefaults.js";
import { buildKnowledgeReadinessReport } from "./KnowledgeReadinessBuilder.js";
import { validateKnowledgeReadinessReport } from "./KnowledgeReadinessValidator.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function fail(message) {
  throw new Error(`KnowledgeReadinessEngine: ${message}`);
}

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

function toISODate(isoString) {
  const s = safeString(isoString);
  if (!s) return null;
  // Preserve determinism and avoid locale conversions: the stored strings are ISO-like.
  return s.includes("T") ? s : new Date(s).toISOString();
}

function parseISOToMs(isoString) {
  const iso = toISODate(isoString);
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms;
}

function daysBetween(nowISO, pastISO) {
  const nowMs = parseISOToMs(nowISO);
  const pastMs = parseISOToMs(pastISO);
  if (nowMs === null || pastMs === null) return null;
  return (nowMs - pastMs) / (1000 * 60 * 60 * 24);
}

function scoreLevelFromScore(score) {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

function priorityTierFromScore(score) {
  if (score >= KNOWLEDGE_READINESS_DEFAULTS.priorityTiers.immediate) return { tier: "immediate", priority: 90 };
  if (score >= KNOWLEDGE_READINESS_DEFAULTS.priorityTiers.soon) return { tier: "soon", priority: 70 };
  return { tier: "later", priority: 40 };
}

function computeLatestUpdatedAtMsForCategory({ itemsMs, categoryUpdatedAtMs } = {}) {
  const itemLatest = safeArray(itemsMs).reduce((best, ms) => (best === null || ms > best ? ms : best), null);
  if (itemLatest !== null) return itemLatest;
  return categoryUpdatedAtMs ?? null;
}

function computeHealthAndCoverage({
  generatedAt,
  moduleEnabled,
  activeCategoryCount,
  categoriesWithoutActiveKnowledgeCount,
  activeKnowledgeCount,
  lowConfidenceActiveRatio,
  staleCategoryCount,
} = {}) {
  // Deterministic, transparent scoring:
  // - Coverage: best-effort based on active category coverage ratio
  // - Quality: penalize low-confidence active knowledge
  // - Freshness: penalize stale categories
  const totalCategoryCount = Math.max(0, activeCategoryCount + categoriesWithoutActiveKnowledgeCount);
  const activeCategoryCoverage = totalCategoryCount > 0 ? activeCategoryCount / totalCategoryCount : 1;

  const base = 100 * activeCategoryCoverage;
  const qualityPenalty = lowConfidenceActiveRatio * 25; // 0..25
  const freshnessPenalty = staleCategoryCount > 0 ? Math.min(30, staleCategoryCount * 8) : 0; // cap
  const disabledPenalty = moduleEnabled ? 0 : 50;

  // If no active knowledge exists, assume critical vulnerability regardless of category count.
  const zeroKnowledgePenalty = activeKnowledgeCount > 0 ? 0 : 40;

  const rawScore = base - qualityPenalty - freshnessPenalty - disabledPenalty - zeroKnowledgePenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const level = scoreLevelFromScore(score);

  const health = { score, level };

  return { health };
}

export class KnowledgeReadinessEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = safeString(nowISO ?? "2026-07-01T00:00:00.000Z");
  }

  generate({
    companyId,
    generatedAt,
    knowledgeRepository,
    knowledgeCategories,
    moduleEnabled,
    staleDaysThreshold = KNOWLEDGE_READINESS_DEFAULTS.staleDaysThreshold,
    lowConfidenceThreshold = KNOWLEDGE_READINESS_DEFAULTS.lowConfidenceThreshold,
  } = {}) {
    if (!companyId) fail("companyId required.");
    const effectiveGeneratedAt = safeString(generatedAt ?? this.nowISO);
    if (!effectiveGeneratedAt) fail("generatedAt required.");

    const items = safeArray(knowledgeRepository?.items);
    const categories = safeArray(knowledgeCategories?.items);

    const activeItems = items.filter((i) => String(i?.status ?? "") !== "ARCHIVED");
    const archivedItems = items.filter((i) => String(i?.status ?? "") === "ARCHIVED");

    const activeCategoryIds = new Set(activeItems.map((i) => String(i?.category ?? "")));
    const activeCategoryCount = categories.filter((c) => c?.id && activeCategoryIds.has(String(c.id))).length;
    const categoriesWithoutActiveKnowledgeCount = categories.filter((c) => c?.id && !activeCategoryIds.has(String(c.id))).length;

    const totalActiveKnowledgeCount = activeItems.length;
    const totalArchivedKnowledgeCount = archivedItems.length;

    // Category-level staleness + attention.
    const categoryById = new Map(categories.map((c) => [String(c?.id ?? ""), c]));

    const updatedAtMsByCategory = new Map();
    for (const it of activeItems) {
      const cid = String(it?.category ?? "");
      const ms = parseISOToMs(it?.updatedAt ?? it?.createdAt ?? "");
      if (ms === null) continue;
      const prev = updatedAtMsByCategory.get(cid) ?? null;
      if (prev === null || ms > prev) updatedAtMsByCategory.set(cid, ms);
    }

    const staleCategoryIds = [];
    for (const c of categories) {
      const cid = String(c?.id ?? "");
      const latestMs = computeLatestUpdatedAtMsForCategory({
        itemsMs: [...(updatedAtMsByCategory.has(cid) ? [updatedAtMsByCategory.get(cid)] : [])],
        categoryUpdatedAtMs: parseISOToMs(c?.updatedAt ?? c?.createdAt ?? ""),
      });
      if (latestMs === null) continue;
      const ageDays = daysBetween(effectiveGeneratedAt, new Date(latestMs).toISOString());
      if (ageDays === null) continue;
      if (ageDays > staleDaysThreshold) staleCategoryIds.push(cid);
    }

    const staleCategoryCount = staleCategoryIds.length;

    // Low-confidence ratio only considers active knowledge.
    const lowConfidenceActiveCount = activeItems.filter((i) => typeof i?.confidence === "number" && i.confidence < lowConfidenceThreshold).length;
    const lowConfidenceActiveRatio = totalActiveKnowledgeCount > 0 ? lowConfidenceActiveCount / totalActiveKnowledgeCount : 1;

    const { health } = computeHealthAndCoverage({
      generatedAt: effectiveGeneratedAt,
      moduleEnabled,
      activeCategoryCount,
      categoriesWithoutActiveKnowledgeCount,
      activeKnowledgeCount: totalActiveKnowledgeCount,
      lowConfidenceActiveRatio,
      staleCategoryCount,
    });

    const scoreForPriority = health.score;
    const basePriorityTier = priorityTierFromScore(scoreForPriority);

    const summary =
      moduleEnabled === false
        ? "Knowledge module is disabled; executive knowledge readiness is unavailable."
        : health.level === "excellent"
          ? "Organizational knowledge is healthy and ready for consistent execution."
          : health.level === "good"
            ? "Organizational knowledge is mostly on track."
            : health.level === "warning"
              ? "Organizational knowledge needs executive focus to reduce vulnerability."
              : "Critical business knowledge gaps or risks require immediate attention.";

    // Build areas: category-level assessments for the executive map.
    const areas = safeArray(categories)
      .slice()
      .sort((a, b) => String(a?.sortOrder ?? 0) - String(b?.sortOrder ?? 0) || String(a?.id ?? "").localeCompare(String(b?.id ?? "")))
      .map((c) => {
        const cid = String(c?.id ?? "");
        const activeCount = activeItems.filter((i) => String(i?.category ?? "") === cid).length;
        const archivedCount = archivedItems.filter((i) => String(i?.category ?? "") === cid).length;

        const categoryUpdatedAtMs = parseISOToMs(c?.updatedAt ?? c?.createdAt ?? "");
        const itemUpdatedAtMs = updatedAtMsByCategory.get(cid) ?? null;
        const latestMs = computeLatestUpdatedAtMsForCategory({
          itemsMs: itemUpdatedAtMs === null ? [] : [itemUpdatedAtMs],
          categoryUpdatedAtMs,
        });

        const ageDays = latestMs === null ? null : daysBetween(effectiveGeneratedAt, new Date(latestMs).toISOString());
        const stale = ageDays !== null && ageDays > staleDaysThreshold;

        // Category health derives from coverage + freshness + low confidence.
        const avgConfidence = activeCount > 0 ? activeItems.filter((i) => String(i?.category ?? "") === cid).reduce((sum, i) => sum + (typeof i?.confidence === "number" ? i.confidence : 0.5), 0) / activeCount : 0;
        const confidenceLow = activeCount > 0 && avgConfidence < lowConfidenceThreshold;

        let categoryLevel = "excellent";
        if (moduleEnabled === false) categoryLevel = "critical";
        else if (activeCount === 0) categoryLevel = "critical";
        else if (stale || confidenceLow) categoryLevel = "warning";
        else categoryLevel = "good";

        const attentionRequired = Boolean(activeCount === 0 || stale || confidenceLow || moduleEnabled === false);
        const freshnessLabel = stale ? `Stale (${Math.round(ageDays ?? 0)}d)` : "Current";

        return {
          categoryId: cid,
          categoryName: safeString(c?.name ?? cid),
          activeItemCount: activeCount,
          archivedItemCount: archivedCount,
          latestUpdateAt: latestMs === null ? null : new Date(latestMs).toISOString(),
          freshnessLabel,
          status: attentionRequired ? "attention" : "operating",
          healthLevel: categoryLevel,
          attentionRequired,
        };
      });

    const attentionAreaCount = areas.filter((a) => Boolean(a?.attentionRequired)).length;

    // Deterministic gaps: evidence-only.
    const gaps = [];

    // Module disabled is a gap.
    if (!moduleEnabled) {
      gaps.push({
        id: "gap_module_disabled",
        gap: "Knowledge module unavailable",
        priority: 90,
        businessImpact: "Knowledge execution readiness cannot be validated.",
        affectedArea: "Knowledge module",
        recommendedResponse: "Enable Knowledge OS module and ensure knowledge categories are configured.",
        evidence: [{ type: "module_visibility", value: "disabled" }],
      });
    } else {
      // Uncovered categories produce explicit gaps.
      for (const a of areas) {
        if (a.activeItemCount > 0) continue;
        gaps.push({
          id: `gap_uncovered_category_${a.categoryId}`,
          gap: `Uncovered knowledge category`,
          priority: a.freshnessLabel.startsWith("Stale") ? 80 : 70,
          businessImpact: "Category knowledge is not available for consistent execution.",
          affectedArea: a.categoryName,
          recommendedResponse: "Capture and publish knowledge for this category to restore coverage.",
          evidence: [{ type: "active_item_count", value: String(a.activeItemCount) }],
        });
      }

      // Low-confidence concentration produces a deterministic quality gap.
      if (totalActiveKnowledgeCount > 0 && lowConfidenceActiveRatio >= KNOWLEDGE_READINESS_DEFAULTS.lowConfidenceCoverageRatio) {
        gaps.push({
          id: "gap_low_confidence_coverage",
          gap: "Low-confidence knowledge concentration",
          priority: 70,
          businessImpact: "Leadership guidance may be inconsistent or insufficiently verified.",
          affectedArea: "Active knowledge set",
          recommendedResponse: "Review and refresh low-confidence knowledge items to improve reliability.",
          evidence: [{ type: "low_confidence_ratio", value: String(lowConfidenceActiveRatio) }],
        });
      }

      // Staleness produces a freshness gap.
      if (staleCategoryCount > 0) {
        gaps.push({
          id: "gap_outdated_knowledge",
          gap: "Outdated knowledge categories",
          priority: staleCategoryCount >= 2 ? 80 : 60,
          businessImpact: "Knowledge may be out of date for the organization’s current operations.",
          affectedArea: `${staleCategoryCount} category(s) stale`,
          recommendedResponse: "Refresh knowledge items and update category guidance to restore current accuracy.",
          evidence: [{ type: "stale_category_count", value: String(staleCategoryCount) }],
        });
      }
    }

    // Risks are a separate evidence-based list.
    const risks = [];
    if (moduleEnabled === false) {
      risks.push({
        id: "risk_module_disabled",
        type: "knowledge_module_disabled",
        providerType: null,
        severity: 80,
        message: "Knowledge module is disabled; leadership cannot validate coverage.",
      });
    } else {
      if (totalActiveKnowledgeCount === 0) {
        risks.push({
          id: "risk_no_active_knowledge",
          type: "missing_active_knowledge",
          providerType: null,
          severity: 90,
          message: "No active knowledge items are published. Execution guidance cannot be relied on.",
        });
      }

      if (lowConfidenceActiveCount > 0) {
        risks.push({
          id: "risk_low_confidence_items",
          type: "low_confidence_knowledge",
          providerType: null,
          severity: Math.round(40 + lowConfidenceActiveRatio * 60),
          message: `${lowConfidenceActiveCount} low-confidence active knowledge item(s) recorded.`,
        });
      }

      if (staleCategoryCount > 0) {
        risks.push({
          id: "risk_stale_categories",
          type: "outdated_knowledge",
          providerType: null,
          severity: Math.round(40 + Math.min(1, staleCategoryCount / Math.max(1, categories.length)) * 60),
          message: `${staleCategoryCount} knowledge categor${staleCategoryCount === 1 ? "y" : "ies"} appear stale.`,
        });
      }
    }

    const strengths = safeArray(areas)
      .filter((a) => a.activeItemCount > 0 && a.healthLevel === "good")
      .slice(0, 4)
      .map((a) => ({
        id: `strength_${a.categoryId}`,
        categoryId: a.categoryId,
        categoryName: a.categoryName,
        message: `Coverage is healthy for ${a.categoryName}.`,
      }));

    const strengthFallback = strengths.length
      ? strengths
      : safeArray(areas)
          .filter((a) => a.activeItemCount > 0)
          .slice(0, 4)
          .map((a) => ({ id: `strength_${a.categoryId}`, categoryId: a.categoryId, categoryName: a.categoryName, message: `Active knowledge exists for ${a.categoryName}.` }));

    // Recommendations must trace back to computed gaps/risks.
    const recommendations = [];
    const added = new Set();
    const addRec = (rec) => {
      if (!rec || !rec.id) return;
      if (added.has(rec.id)) return;
      added.add(rec.id);
      recommendations.push(rec);
    };

    for (const g of gaps) {
      addRec({
        id: `rec_from_gap_${g.id}`,
        type: "capture_knowledge",
        title: "Capture critical knowledge",
        description: g.recommendedResponse,
        priority: Number(g.priority ?? 0),
        relatedCategoryIds: [g.affectedArea],
      });
    }

    for (const r of risks) {
      if (r.type === "low_confidence_knowledge") {
        addRec({
          id: `rec_from_risk_low_confidence`,
          type: "review_low_confidence",
          title: "Review low-confidence knowledge",
          description: "Review and validate low-confidence knowledge items to ensure consistency and reliability.",
          priority: 65,
          relatedCategoryIds: [],
        });
      }
      if (r.type === "outdated_knowledge") {
        addRec({
          id: `rec_from_risk_outdated`,
          type: "refresh_outdated_knowledge",
          title: "Refresh outdated knowledge",
          description: "Refresh stale knowledge categories and update guidance to maintain operational accuracy.",
          priority: 70,
          relatedCategoryIds: [],
        });
      }
    }

    // If we have no gaps or risks, recommendations are empty.
    const dedupedRecommendations = recommendations.slice().sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));

    const recommendationCount = dedupedRecommendations.length;

    // next focus subtitle derived from the highest-priority computed item.
    const sortedGaps = gaps.slice().sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
    const sortedRisks = risks.slice().sort((a, b) => Number(b.severity ?? 0) - Number(a.severity ?? 0));

    const topGap = sortedGaps[0] ?? null;
    const topRisk = sortedRisks[0] ?? null;
    const topRec = dedupedRecommendations[0] ?? null;

    let nextFocusSubtitle = "";
    if (topGap) nextFocusSubtitle = `Next focus: ${topGap.recommendedResponse}`;
    else if (topRisk) nextFocusSubtitle = `Next focus: mitigate ${topRisk.type.replaceAll("_", " ")} risk.`;
    else if (topRec) nextFocusSubtitle = `Next focus: ${topRec.description}`;
    else nextFocusSubtitle = "Organizational knowledge is operating from a position of strength.";

    const reportId = sha256(
      JSON.stringify({
        companyId,
        generatedAt: effectiveGeneratedAt,
        categoryIds: categories.map((c) => String(c?.id ?? "")).sort(),
        itemIds: items.map((i) => String(i?.id ?? "")).sort(),
      }),
    );

    const summaryHealthScore = health.score;
    const healthLevel = health.level;

    const activeItemCoveragePercent = categories.length > 0 ? Math.round((activeCategoryCount / categories.length) * 100) : 100;

    const metrics = {
      totalCategories: categories.length,
      activeCategories: activeCategoryCount,
      categoriesWithoutActiveKnowledge: categoriesWithoutActiveKnowledgeCount,
      totalActiveKnowledgeItems: totalActiveKnowledgeCount,
      totalArchivedKnowledgeItems: totalArchivedKnowledgeCount,
      totalKnowledgeItems: totalActiveKnowledgeCount + totalArchivedKnowledgeCount,
      staleCategoryCount,
      lowConfidenceActiveItemCount: lowConfidenceActiveCount,
      lowConfidenceActiveRatio,
      gapCount: gaps.length,
      riskCount: risks.length,
      recommendationCount,
      activeItemCoveragePercent,
      attentionAreaCount,
      healthScore: summaryHealthScore,
      healthLevel,
    };

    const coverage = {
      totalCategories: categories.length,
      activeCategories: activeCategoryCount,
      categoriesWithoutActiveKnowledge: categoriesWithoutActiveKnowledgeCount,
      totalActiveKnowledgeItems: totalActiveKnowledgeCount,
      activeItemCoveragePercent,
    };

    // Map gaps/risks/strengths/recommendations into a view-friendly exec contract.
    const viewGaps = gaps.map((g) => ({
      id: g.id,
      gap: g.gap,
      priority: Number(g.priority ?? 0),
      businessImpact: g.businessImpact,
      affectedArea: g.affectedArea,
      recommendedResponse: g.recommendedResponse,
    }));

    const viewRisks = risks.map((r) => ({
      id: r.id,
      category: String(r?.type ?? "risk"),
      message: String(r?.message ?? ""),
      importance: importanceFromSeverity(Number(r?.severity ?? 0)),
    }));

    const viewStrengths = strengthFallback.map((s) => ({
      id: s.id,
      title: s.categoryName,
      message: s.message,
    }));

    const viewRecommendations = dedupedRecommendations.map((r) => ({
      id: r.id,
      actionType: String(r?.type ?? "recommend"),
      priority: Number(r?.priority ?? 0),
      recommendation: String(r?.description ?? ""),
    }));

    const areasForView = areas.map((a) => ({
      categoryId: a.categoryId,
      category: a.categoryName,
      healthLevel: a.healthLevel,
      activeItemCount: a.activeItemCount,
      archivedItemCount: a.archivedItemCount,
      latestUpdateAt: a.latestUpdateAt,
      freshnessLabel: a.freshnessLabel,
      attentionRequired: a.attentionRequired,
    }));

    const report = buildKnowledgeReadinessReport({
      reportId,
      companyId,
      generatedAt: effectiveGeneratedAt,
      summary,
      health,
      coverage,
      metrics,
      areas: areasForView,
      gaps: viewGaps,
      risks: viewRisks,
      strengths: viewStrengths,
      recommendations: viewRecommendations,
      nextFocusSubtitle,
    });

    validateKnowledgeReadinessReport(report);
    return report;
  }
}

function importanceFromSeverity(severity) {
  const s = Number(severity ?? 0);
  if (s >= 70) return "high";
  if (s >= 40) return "medium";
  return "low";
}
