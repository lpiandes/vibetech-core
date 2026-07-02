import { deepFreeze } from "../_utils/deepFreeze.js";

export function buildRecommendationsView({ workspaceConfig } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("RecommendationViewBuilder: workspaceConfig required.");
  }

  const recItems = Array.isArray(workspaceConfig.recommendations?.items)
    ? workspaceConfig.recommendations.items
    : [];

  const recommendations = recItems.map((text, idx) =>
    deepFreeze({
      id: `rec_${idx}_${String(text).slice(0, 24).replace(/\s+/g, "_")}`,
      title: text,
      subtitle: "Deterministic next-step guidance",
      icon: "sparkles",
      badges: [],
      actions: [{ id: "open_recommendations", label: "View", type: "NAVIGATE", href: "/recommendations" }],
      displayOrder: idx,
      visibility: "VISIBLE",
      status: "READY",
    }),
  );

  return deepFreeze({
    id: "recommendations_view",
    title: "Recommendations",
    subtitle: "Next steps based on your workspace readiness",
    icon: "sparkles",
    badges: [],
    actions: [],
    displayOrder: 40,
    visibility: "VISIBLE",
    status: "READY",
    items: recommendations,
  });
}

