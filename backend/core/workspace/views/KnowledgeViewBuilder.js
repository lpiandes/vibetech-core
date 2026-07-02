import { deepFreeze } from "../_utils/deepFreeze.js";

export function buildKnowledgeView({ workspaceConfig } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("KnowledgeViewBuilder: workspaceConfig required.");
  }

  const enabled = (workspaceConfig.modules ?? []).some((m) => m?.id === "knowledge");
  const categories = Array.isArray(workspaceConfig.knowledgeLayout?.categories)
    ? workspaceConfig.knowledgeLayout.categories
    : [];

  const view = deepFreeze({
    id: "knowledge_view",
    title: "Knowledge",
    subtitle: "Make readiness visible for your internal knowledge",
    icon: "book",
    badges: enabled ? [] : [{ id: "disabled", label: "Knowledge module disabled" }],
    actions: [{ id: "open_knowledge", label: "Open knowledge", type: "NAVIGATE", href: "/knowledge" }],
    displayOrder: 70,
    visibility: enabled ? "VISIBLE" : "HIDDEN",
    status: "READY",
    categories,
  });

  return view;
}

