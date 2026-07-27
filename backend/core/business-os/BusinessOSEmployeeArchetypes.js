import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Reusable digital-employee archetypes.
 * Unknown needs become capability proposals — never silent custom code.
 */
export const BUSINESS_OS_EMPLOYEE_ARCHETYPES = deepFreeze([
  { archetypeId: "coordinator", label: "Coordinator", purpose: "Coordinate intake and operating loops." },
  { archetypeId: "follow_up_specialist", label: "Follow-up specialist", purpose: "Drive relationship and operational follow-up." },
  { archetypeId: "intake_specialist", label: "Intake specialist", purpose: "Qualify and route incoming requests." },
  { archetypeId: "ai_caller", label: "Voice Call Assistant", purpose: "Prepares approved call scripts and call work. Live conversations require a configured Twilio Voice agent." },
  { archetypeId: "facebook_lead_specialist", label: "Facebook Lead Generator", purpose: "Qualify and route Facebook / Meta leads into intake work for owner review." },
  { archetypeId: "researcher", label: "Researcher", purpose: "Gather and summarize evidence." },
  { archetypeId: "reviewer", label: "Reviewer", purpose: "Prepare reviewable drafts and checks." },
  { archetypeId: "scheduler", label: "Scheduler", purpose: "Coordinate scheduling and availability." },
  { archetypeId: "campaign_coordinator", label: "Campaign coordinator", purpose: "Prepare governed campaigns." },
  { archetypeId: "operations_monitor", label: "Operations monitor", purpose: "Watch queues and readiness." },
  { archetypeId: "document_specialist", label: "Document specialist", purpose: "Organize knowledge and documents." },
  { archetypeId: "analyst", label: "Analyst", purpose: "Summarize performance and trends." },
  { archetypeId: "operations_coordinator", label: "Operations coordinator", purpose: "Coordinate day-to-day operations." },
  { archetypeId: "customer_success_coordinator", label: "Customer success coordinator", purpose: "Support customer outcomes with approved guidance." },
  { archetypeId: "marketing_coordinator", label: "Marketing coordinator", purpose: "Prepare marketing work under approval." },
  { archetypeId: "compliance_reviewer", label: "Compliance reviewer", purpose: "Review sensitive actions against policy." },
  { archetypeId: "reporting_analyst", label: "Reporting analyst", purpose: "Prepare truthful performance summaries." },
  { archetypeId: "communications_specialist", label: "Communications specialist", purpose: "Draft and route customer communications under approval." },
  { archetypeId: "dispatcher", label: "Dispatcher", purpose: "Assign and route field or operating work." },
  { archetypeId: "bookkeeper", label: "Bookkeeper", purpose: "Prepare bookkeeping drafts and reconciliation checks." },
  { archetypeId: "recruiter", label: "Recruiter", purpose: "Coordinate hiring pipelines with human approval." },
  { archetypeId: "quality_reviewer", label: "Quality reviewer", purpose: "Review quality outcomes before release." },
  { archetypeId: "executive_assistant", label: "Executive assistant", purpose: "Support owner priorities and briefing packs." },
]);

export function listEmployeeArchetypeIds() {
  return BUSINESS_OS_EMPLOYEE_ARCHETYPES.map((entry) => entry.archetypeId);
}

export function getEmployeeArchetype(archetypeId) {
  return BUSINESS_OS_EMPLOYEE_ARCHETYPES.find((entry) => entry.archetypeId === String(archetypeId ?? "")) ?? null;
}

export function resolveEmployeeArchetype(archetypeId) {
  const archetype = getEmployeeArchetype(archetypeId);
  if (!archetype) {
    return {
      ok: false,
      reason: "unknown_archetype",
      proposalRequired: true,
      message: `No reusable employee archetype matches "${archetypeId}".`,
    };
  }
  return { ok: true, archetype };
}
