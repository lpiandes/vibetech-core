import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";

/**
 * Presentation-only adapter — no business logic.
 */
export function adaptBusinessIntelligenceWorkspace(workspace, {
  businessId = null,
  businessName = null,
} = {}) {
  if (!workspace || workspace.contract !== "BusinessIntelligenceWorkspace/v1") {
    throw new Error("BusinessIntelligenceViewAdapter: BusinessIntelligenceWorkspace/v1 required.");
  }

  return deepFreeze({
    contract: "BusinessIntelligenceWorkspaceView/v1",
    businessId: businessId == null ? null : String(businessId),
    businessName: businessName == null ? workspace.companyId : String(businessName),
    generatedAt: workspace.generatedAt,
    pipeline: workspace.pipeline,
    mutatesBusinessOs: false,
    honesty: {
      message: "Every recommendation includes reason, evidence, confidence, impact, risk, and required approvals. Nothing changes until you approve.",
      opaqueScoresForbidden: true,
    },
    sections: Object.freeze([
      section("executive_briefing", "Executive Briefing", workspace.executiveBriefing),
      section("recommendations", "Recommendations", workspace.recommendations),
      section("opportunities", "Opportunities", workspace.opportunities),
      section("business_health", "Business Health", workspace.businessHealth),
      section("risks", "Risks", workspace.risks),
      section("capacity", "Capacity", workspace.capacity),
      section("ai_suggestions", "AI Suggestions", workspace.aiSuggestions),
      section("recent_improvements", "Recent Improvements", workspace.recentImprovements),
      section("future_roadmap", "Future Roadmap", workspace.futureRoadmap),
      section("what_changed", "What changed", workspace.changes),
      section("improving", "What is improving", workspace.improving),
      section("worsening", "What is getting worse", workspace.worsening),
    ]),
    executiveBriefing: workspace.executiveBriefing,
    recommendations: workspace.recommendations,
    opportunities: workspace.opportunities,
    businessHealth: workspace.businessHealth,
    risks: workspace.risks,
    capacity: workspace.capacity,
    aiSuggestions: workspace.aiSuggestions,
    recentImprovements: workspace.recentImprovements,
    futureRoadmap: workspace.futureRoadmap,
    observationCounts: workspace.observationCounts,
  });
}

function section(id, label, payload) {
  const count = Array.isArray(payload)
    ? payload.length
    : payload && typeof payload === "object" && Array.isArray(payload.items)
      ? payload.items.length
      : payload ? 1 : 0;
  return deepFreeze({ id, label, count, payload });
}
