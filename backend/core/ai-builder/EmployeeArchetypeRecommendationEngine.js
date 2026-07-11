import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderRecommendation } from "./BuilderRecommendation.js";
import { listEmployeeArchetypeIds } from "../business-os/BusinessOSEmployeeArchetypes.js";

const ARCHETYPE_PICKS = Object.freeze({
  property_management: [
    { archetypeId: "intake_specialist", title: "Prospect Intake Coordinator" },
    { archetypeId: "follow_up_specialist", title: "Relationship Follow-Up Specialist" },
    { archetypeId: "operations_monitor", title: "Maintenance Operations Coordinator" },
    { archetypeId: "campaign_coordinator", title: "Campaign Coordinator" },
  ],
  dental: [
    { archetypeId: "intake_specialist", title: "Patient Intake Coordinator" },
    { archetypeId: "scheduler", title: "Appointment Scheduler" },
    { archetypeId: "follow_up_specialist", title: "Treatment Follow-Up Specialist" },
    { archetypeId: "reviewer", title: "Clinical Notes Reviewer" },
  ],
  sports: [
    { archetypeId: "scheduler", title: "Scheduling Coordinator" },
    { archetypeId: "document_specialist", title: "Practice Planning Assistant" },
    { archetypeId: "analyst", title: "Scouting Analyst" },
    { archetypeId: "coordinator", title: "Travel Coordinator" },
  ],
  default: [
    { archetypeId: "coordinator", title: "Operations Coordinator" },
    { archetypeId: "follow_up_specialist", title: "Follow-Up Specialist" },
    { archetypeId: "reviewer", title: "Owner Review Specialist" },
  ],
});

/**
 * Specialize existing archetypes — propose gaps for unknown types.
 */
export class EmployeeArchetypeRecommendationEngine {
  recommend({ businessSummary = {} } = {}) {
    const industry = String(businessSummary.industry ?? "default");
    const picks = ARCHETYPE_PICKS[industry] ?? ARCHETYPE_PICKS.default;
    const known = new Set(listEmployeeArchetypeIds());

    const recommendations = [];
    const gaps = [];

    for (const pick of picks) {
      if (!known.has(pick.archetypeId)) {
        gaps.push({
          kind: "reusable_component_needed",
          label: `Missing archetype: ${pick.archetypeId}`,
          requestedOutcome: pick.title,
        });
        continue;
      }
      recommendations.push(createBuilderRecommendation({
        recommendationId: `rec_emp_${pick.archetypeId}`,
        kind: "employee_archetype",
        label: pick.title,
        why: `Uses reusable ${pick.archetypeId.replace(/_/g, " ")} archetype with industry specialization.`,
        evidence: [`archetype:${pick.archetypeId}`, `industry:${industry}`],
        confidence: 0.85,
        selected: true,
      }));
    }

    return deepFreeze({ ok: true, recommendations, gaps });
  }
}
