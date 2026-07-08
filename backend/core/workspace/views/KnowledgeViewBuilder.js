import { deepFreeze } from "../_utils/deepFreeze.js";

import { KnowledgeReadinessEngine } from "../../knowledge/readiness/KnowledgeReadinessEngine.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function buildKnowledgeView({ workspaceConfig, runtime } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("KnowledgeViewBuilder: workspaceConfig required.");
  }

  const knowledgeRepository = runtime?.getKnowledgeRepository?.() ?? { items: [] };
  const knowledgeCategories = runtime?.getKnowledgeCategories?.() ?? { items: [] };
  const companyId = String(runtime?.getCompany?.()?.companyName ?? "company");
  const generatedAt = String(workspaceConfig?.metadata?.generatedAt ?? workspaceConfig?.metadata?.viewGeneratedAt ?? "2026-07-01T00:00:00.000Z");

  const enabled =
    (workspaceConfig.modules ?? []).some((m) => (typeof m === "string" ? m : m?.id) === "knowledge") ||
    safeArray(knowledgeRepository?.items).length > 0;

  const categories = Array.isArray(workspaceConfig.knowledgeLayout?.categories)
    ? workspaceConfig.knowledgeLayout.categories
    : safeArray(knowledgeCategories?.items);

  if (!enabled) {
    return deepFreeze({
      id: "knowledge_view",
      title: "Knowledge",
      subtitle: "Business knowledge for policies, procedures, and operating context",
      icon: "book",
      badges: [],
      actions: [],
      displayOrder: 70,
      visibility: "VISIBLE",
      status: "NOT_CONFIGURED",
      operationalStatus: "not_configured",
      categories: [],
      summary: "Knowledge is not yet configured for this workspace.",
      health: deepFreeze({ level: "warning", score: 0, summary: "Not configured" }),
      coverage: deepFreeze({}),
      metrics: deepFreeze({
        totalKnowledgeItems: 0,
        totalActiveKnowledgeItems: 0,
        activeCategories: 0,
        totalCategories: 0,
        gapCount: 0,
        riskCount: 0,
        recommendationCount: 0,
      }),
      areas: deepFreeze([]),
      gaps: deepFreeze([]),
      risks: deepFreeze([]),
      strengths: deepFreeze([]),
      recommendations: deepFreeze([
        deepFreeze({
          id: "configure_knowledge",
          actionType: "configure",
          priority: 50,
          recommendation:
            "Connect knowledge categories and publish operating documents so your team and digital workforce can reference them during work.",
        }),
      ]),
      nextFocusSubtitle: "Configure knowledge to give your business a shared source of truth.",
    });
  }

  const readiness = new KnowledgeReadinessEngine({ nowISO: generatedAt }).generate({
    companyId,
    generatedAt,
    knowledgeRepository,
    knowledgeCategories,
    moduleEnabled: true,
  });

  return deepFreeze({
    id: "knowledge_view",
    title: "Knowledge",
    subtitle: "Operating knowledge your business can rely on",
    icon: "book",
    badges: [],
    actions: [{ id: "open_knowledge", label: "Open knowledge", type: "NAVIGATE", href: "/knowledge" }],
    displayOrder: 70,
    visibility: "VISIBLE",
    status: "READY",
    operationalStatus: "operational",
    categories,
    summary: readiness.summary,
    health: readiness.health,
    coverage: readiness.coverage,
    metrics: readiness.metrics,
    areas: readiness.areas,
    gaps: readiness.gaps,
    risks: readiness.risks,
    strengths: readiness.strengths,
    recommendations: readiness.recommendations,
    nextFocusSubtitle: readiness.nextFocusSubtitle,
  });
}
