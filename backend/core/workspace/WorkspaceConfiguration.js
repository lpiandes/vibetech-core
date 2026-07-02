import { deepFreeze } from "./_utils/deepFreeze.js";

export function createWorkspaceConfiguration(input = {}) {
  if (!input || typeof input !== "object") throw new Error("createWorkspaceConfiguration: input required.");
  const config = {
    navigation: input.navigation ?? { items: [] },
    modules: input.modules ?? [],
    dashboard: input.dashboard ?? { defaultWidgets: [], layout: "IN_PROGRESS", sections: [], cards: [], summary: "", priorityOrdering: "deterministic" },
    widgets: input.widgets ?? [],
    queues: input.queues ?? [],
    views: input.views ?? [],
    digitalWorkforceLayout: input.digitalWorkforceLayout ?? {},
    knowledgeLayout: input.knowledgeLayout ?? {},
    analyticsLayout: input.analyticsLayout ?? {},
    morningBriefConfiguration: input.morningBriefConfiguration ?? {},
    notifications: input.notifications ?? {},
    recommendations: input.recommendations ?? { items: [] },
    permissions: input.permissions ?? { read: [] },
    metadata: input.metadata ?? {},
  };

  return deepFreeze(config);
}

