import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderRecommendation } from "./BuilderRecommendation.js";
import { listDashboardComponentTypes } from "../business-os/BusinessOSDashboardComponentRegistry.js";

/**
 * Recommend reusable UI/runtime components — never arbitrary generated code.
 */
export class ComponentRecommendationEngine {
  recommend({ businessSummary = {} } = {}) {
    const industry = String(businessSummary.industry ?? "");
    const components = [
      { id: "work_queue", label: "Work queue", why: "Universal human-approved work." },
      { id: "attention_queue", label: "Needs attention", why: "Owner daily focus." },
      { id: "digital_workforce", label: "Digital workforce panel", why: "Employees stay grouped." },
      { id: "readiness", label: "Launch readiness", why: "Honest setup checklist." },
    ];

    void industry;

    const registered = new Set(listDashboardComponentTypes());
    const recommendations = components
      .filter((entry) => registered.has(entry.id) || entry.id === "work_queue")
      .map((entry) => createBuilderRecommendation({
        recommendationId: `rec_comp_${entry.id}`,
        kind: "component",
        label: entry.label,
        why: entry.why,
        evidence: [`component:${entry.id}`],
        confidence: 0.8,
        selected: true,
      }));

    return deepFreeze({ ok: true, recommendations });
  }
}
