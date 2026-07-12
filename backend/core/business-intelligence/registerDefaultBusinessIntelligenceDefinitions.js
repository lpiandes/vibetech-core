import { getDefaultBusinessIntelligenceDefinitionRegistry } from "./definitions/BusinessIntelligenceDefinitionRegistry.js";
import { UNIVERSAL_OBSERVATION_EVALUATORS } from "./evaluation/universalEvaluators.js";

let registered = false;

function workAction(label = "Create follow-up work") {
  return {
    actionId: "create_work",
    kind: "create_work",
    label,
    workTemplate: {
      workType: "intelligence_follow_up",
      priority: "high",
    },
    requiresApproval: true,
  };
}

function changeAction(capabilityId, label = "Propose operating-system change") {
  return {
    actionId: "propose_change",
    kind: "create_architect_change_proposal",
    label,
    architectCapabilityId: capabilityId,
    requiresApproval: true,
  };
}

/**
 * Register universal observation/insight/recommendation triples + evaluators.
 */
export function registerDefaultBusinessIntelligenceDefinitions({
  registry = getDefaultBusinessIntelligenceDefinitionRegistry(),
  replace = false,
} = {}) {
  if (registered && !replace) return registry;

  for (const [evaluatorId, fn] of Object.entries(UNIVERSAL_OBSERVATION_EVALUATORS)) {
    registry.registerEvaluator(evaluatorId, fn);
  }

  const triples = [
    {
      observation: {
        definitionId: "obs_unassigned_request",
        version: "1.0.0",
        title: "Unassigned request",
        description: "Open requests without an owner.",
        category: "workflow",
        evaluatorId: "obs_unassigned_request",
        identityFields: ["subjectKey"],
      },
      insight: {
        definitionId: "ins_unassigned_request",
        version: "1.0.0",
        title: "Requests lack ownership",
        description: "Unowned requests create delays and dropped work.",
        category: "workflow",
        requiredObservationDefinitionIds: ["obs_unassigned_request"],
        explanationTemplate: "{{explanation}}",
        severity: "high",
      },
      recommendation: {
        definitionId: "rec_unassigned_request",
        version: "1.0.0",
        title: "Assign request ownership",
        description: "Assign an owner and create follow-up work if needed.",
        category: "workflow",
        sourceInsightDefinitionIds: ["ins_unassigned_request"],
        recommendedActions: [workAction("Assign owner and create work")],
      },
    },
    {
      observation: {
        definitionId: "obs_overdue_work",
        version: "1.0.0",
        title: "Overdue work",
        description: "Open work past due date.",
        category: "performance",
        evaluatorId: "obs_overdue_work",
      },
      insight: {
        definitionId: "ins_overdue_work",
        version: "1.0.0",
        title: "Commitments are slipping",
        description: "Overdue work reduces trust and throughput.",
        category: "performance",
        requiredObservationDefinitionIds: ["obs_overdue_work"],
        explanationTemplate: "{{explanation}}",
        severity: "high",
      },
      recommendation: {
        definitionId: "rec_overdue_work",
        version: "1.0.0",
        title: "Recover overdue work",
        description: "Review overdue items and reassign or complete them.",
        category: "performance",
        sourceInsightDefinitionIds: ["ins_overdue_work"],
        recommendedActions: [workAction("Create recovery work")],
      },
    },
    {
      observation: {
        definitionId: "obs_unassigned_high_priority_work",
        version: "1.0.0",
        title: "Unassigned high-priority work",
        description: "High priority open work without assignee.",
        category: "attention",
        evaluatorId: "obs_unassigned_high_priority_work",
      },
      insight: {
        definitionId: "ins_unassigned_high_priority_work",
        version: "1.0.0",
        title: "Critical work lacks an owner",
        description: "High-priority work without assignment is at risk.",
        category: "attention",
        requiredObservationDefinitionIds: ["obs_unassigned_high_priority_work"],
        explanationTemplate: "{{explanation}}",
        severity: "critical",
      },
      recommendation: {
        definitionId: "rec_unassigned_high_priority_work",
        version: "1.0.0",
        title: "Assign critical work",
        description: "Assign ownership immediately.",
        category: "attention",
        sourceInsightDefinitionIds: ["ins_unassigned_high_priority_work"],
        recommendedActions: [workAction("Create assignment follow-up")],
      },
    },
    {
      observation: {
        definitionId: "obs_workload_concentration",
        version: "1.0.0",
        title: "Workload concentration",
        description: "One assignee holds too much open work.",
        category: "capacity",
        evaluatorId: "obs_workload_concentration",
        thresholds: { openWorkPerAssignee: 8 },
      },
      insight: {
        definitionId: "ins_workload_concentration",
        version: "1.0.0",
        title: "Team capacity is uneven",
        description: "Workload concentration predicts missed follow-ups.",
        category: "capacity",
        requiredObservationDefinitionIds: ["obs_workload_concentration"],
        explanationTemplate: "{{explanation}}",
      },
      recommendation: {
        definitionId: "rec_workload_concentration",
        version: "1.0.0",
        title: "Rebalance workload",
        description: "Redistribute open work or add capacity.",
        category: "capacity",
        sourceInsightDefinitionIds: ["ins_workload_concentration"],
        recommendedActions: [
          workAction("Create rebalance review"),
          changeAction("architect.change.modify_permissions", "Adjust access if needed"),
        ],
      },
    },
    {
      observation: {
        definitionId: "obs_stale_active_relationship",
        version: "1.0.0",
        title: "Stale active relationship",
        description: "Active relationships without recent meaningful interaction.",
        category: "relationship",
        evaluatorId: "obs_stale_active_relationship",
        thresholds: { staleAfterDays: 14 },
      },
      insight: {
        definitionId: "ins_stale_active_relationship",
        version: "1.0.0",
        title: "Relationships are going quiet",
        description: "Active relationships without contact become opportunities lost.",
        category: "relationship",
        requiredObservationDefinitionIds: ["obs_stale_active_relationship"],
        explanationTemplate: "{{explanation}}",
      },
      recommendation: {
        definitionId: "rec_stale_active_relationship",
        version: "1.0.0",
        title: "Re-engage stale relationships",
        description: "Schedule governed follow-up work.",
        category: "relationship",
        sourceInsightDefinitionIds: ["ins_stale_active_relationship"],
        recommendedActions: [workAction("Create relationship follow-up")],
      },
    },
    {
      observation: {
        definitionId: "obs_approval_bottleneck",
        version: "1.0.0",
        title: "Approval bottleneck",
        description: "Approvals pending longer than expected.",
        category: "compliance",
        evaluatorId: "obs_approval_bottleneck",
        thresholds: { pendingApprovalHours: 24 },
      },
      insight: {
        definitionId: "ins_approval_bottleneck",
        version: "1.0.0",
        title: "Approvals are blocking progress",
        description: "Pending approvals stall work and communications.",
        category: "compliance",
        requiredObservationDefinitionIds: ["obs_approval_bottleneck"],
        explanationTemplate: "{{explanation}}",
        severity: "high",
      },
      recommendation: {
        definitionId: "rec_approval_bottleneck",
        version: "1.0.0",
        title: "Clear approval queue",
        description: "Review pending approvals or adjust approval policy.",
        category: "compliance",
        sourceInsightDefinitionIds: ["ins_approval_bottleneck"],
        recommendedActions: [
          workAction("Create approval chase work"),
          changeAction("architect.change.modify_approval_policy"),
        ],
      },
    },
    {
      observation: {
        definitionId: "obs_follow_up_commitment_due",
        version: "1.0.0",
        title: "Follow-up due soon",
        description: "Scheduled follow-ups approaching.",
        category: "relationship",
        evaluatorId: "obs_follow_up_commitment_due",
        thresholds: { dueSoonHours: 48 },
      },
      insight: {
        definitionId: "ins_follow_up_commitment_due",
        version: "1.0.0",
        title: "Commitments coming due",
        description: "Upcoming follow-ups need owners.",
        category: "relationship",
        requiredObservationDefinitionIds: ["obs_follow_up_commitment_due"],
        explanationTemplate: "{{explanation}}",
      },
      recommendation: {
        definitionId: "rec_follow_up_commitment_due",
        version: "1.0.0",
        title: "Prepare due follow-ups",
        description: "Create work before the commitment expires.",
        category: "relationship",
        sourceInsightDefinitionIds: ["ins_follow_up_commitment_due"],
        recommendedActions: [workAction()],
      },
    },
    {
      observation: {
        definitionId: "obs_missed_follow_up_commitment",
        version: "1.0.0",
        title: "Missed follow-up",
        description: "Past-due follow-up commitments without completion.",
        category: "risk",
        evaluatorId: "obs_missed_follow_up_commitment",
      },
      insight: {
        definitionId: "ins_missed_follow_up_commitment",
        version: "1.0.0",
        title: "Follow-up promises were broken",
        description: "Missed commitments erode trust.",
        category: "risk",
        requiredObservationDefinitionIds: ["obs_missed_follow_up_commitment"],
        explanationTemplate: "{{explanation}}",
        severity: "high",
      },
      recommendation: {
        definitionId: "rec_missed_follow_up_commitment",
        version: "1.0.0",
        title: "Recover missed follow-ups",
        description: "Create recovery work with an owner.",
        category: "risk",
        sourceInsightDefinitionIds: ["ins_missed_follow_up_commitment"],
        recommendedActions: [workAction("Create recovery follow-up")],
      },
    },
    {
      observation: {
        definitionId: "obs_request_no_recent_interaction",
        version: "1.0.0",
        title: "Request without recent interaction",
        description: "Open requests lacking recent meaningful interaction.",
        category: "workflow",
        evaluatorId: "obs_request_no_recent_interaction",
        thresholds: { staleAfterDays: 7 },
      },
      insight: {
        definitionId: "ins_request_no_recent_interaction",
        version: "1.0.0",
        title: "Open requests are going quiet",
        description: "Requests without interaction stall.",
        category: "workflow",
        requiredObservationDefinitionIds: ["obs_request_no_recent_interaction"],
        explanationTemplate: "{{explanation}}",
      },
      recommendation: {
        definitionId: "rec_request_no_recent_interaction",
        version: "1.0.0",
        title: "Re-engage quiet requests",
        description: "Create follow-up work for quiet open requests.",
        category: "workflow",
        sourceInsightDefinitionIds: ["ins_request_no_recent_interaction"],
        recommendedActions: [workAction()],
      },
    },
    {
      observation: {
        definitionId: "obs_repeated_no_response",
        version: "1.0.0",
        title: "Repeated no-response",
        description: "Parties with repeated no-response outcomes.",
        category: "relationship",
        evaluatorId: "obs_repeated_no_response",
        thresholds: { minNoResponseCount: 2 },
      },
      insight: {
        definitionId: "ins_repeated_no_response",
        version: "1.0.0",
        title: "Current outreach is not landing",
        description: "Repeated no-response means cadence or channel needs change.",
        category: "relationship",
        requiredObservationDefinitionIds: ["obs_repeated_no_response"],
        explanationTemplate: "{{explanation}}",
      },
      recommendation: {
        definitionId: "rec_repeated_no_response",
        version: "1.0.0",
        title: "Change outreach approach",
        description: "Create work to revise channel/cadence.",
        category: "relationship",
        sourceInsightDefinitionIds: ["ins_repeated_no_response"],
        recommendedActions: [workAction("Create outreach review")],
      },
    },
    {
      observation: {
        definitionId: "obs_missing_required_information",
        version: "1.0.0",
        title: "Missing required information",
        description: "Operational records missing required fields.",
        category: "data_quality",
        evaluatorId: "obs_missing_required_information",
      },
      insight: {
        definitionId: "ins_missing_required_information",
        version: "1.0.0",
        title: "Incomplete operational records",
        description: "Missing fields block reliable work.",
        category: "data_quality",
        requiredObservationDefinitionIds: ["obs_missing_required_information"],
        explanationTemplate: "{{explanation}}",
      },
      recommendation: {
        definitionId: "rec_missing_required_information",
        version: "1.0.0",
        title: "Complete required information",
        description: "Assign work to fill missing fields.",
        category: "data_quality",
        sourceInsightDefinitionIds: ["ins_missing_required_information"],
        recommendedActions: [workAction("Create data completion work")],
      },
    },
    {
      observation: {
        definitionId: "obs_integration_attention",
        version: "1.0.0",
        title: "Integration needs attention",
        description: "Failed or degraded integrations.",
        category: "integration",
        evaluatorId: "obs_integration_attention",
      },
      insight: {
        definitionId: "ins_integration_attention",
        version: "1.0.0",
        title: "Integrations are blocking operations",
        description: "Degraded connections interrupt workflows.",
        category: "integration",
        requiredObservationDefinitionIds: ["obs_integration_attention"],
        explanationTemplate: "{{explanation}}",
        severity: "high",
      },
      recommendation: {
        definitionId: "rec_integration_attention",
        version: "1.0.0",
        title: "Restore integration health",
        description: "Create work or propose integration changes.",
        category: "integration",
        sourceInsightDefinitionIds: ["ins_integration_attention"],
        recommendedActions: [workAction("Create integration recovery work")],
      },
    },
    {
      observation: {
        definitionId: "obs_ai_employee_readiness_gap",
        version: "1.0.0",
        title: "AI Employee readiness gap",
        description: "Digital employees not ready.",
        category: "capacity",
        evaluatorId: "obs_ai_employee_readiness_gap",
      },
      insight: {
        definitionId: "ins_ai_employee_readiness_gap",
        version: "1.0.0",
        title: "AI workforce is not ready",
        description: "Unreadiness blocks autonomous handling.",
        category: "capacity",
        requiredObservationDefinitionIds: ["obs_ai_employee_readiness_gap"],
        explanationTemplate: "{{explanation}}",
      },
      recommendation: {
        definitionId: "rec_ai_employee_readiness_gap",
        version: "1.0.0",
        title: "Close readiness gaps",
        description: "Propose OS/employee readiness changes.",
        category: "capacity",
        sourceInsightDefinitionIds: ["ins_ai_employee_readiness_gap"],
        recommendedActions: [
          changeAction("architect.change.add_employee", "Propose employee readiness change"),
          workAction("Create readiness follow-up"),
        ],
      },
    },
    {
      observation: {
        definitionId: "obs_repeated_workflow_failure",
        version: "1.0.0",
        title: "Repeated workflow failure",
        description: "Automations failing repeatedly.",
        category: "risk",
        evaluatorId: "obs_repeated_workflow_failure",
        thresholds: { minFailures: 2 },
      },
      insight: {
        definitionId: "ins_repeated_workflow_failure",
        version: "1.0.0",
        title: "Workflows are failing repeatedly",
        description: "Repeated failures need owner intervention.",
        category: "risk",
        requiredObservationDefinitionIds: ["obs_repeated_workflow_failure"],
        explanationTemplate: "{{explanation}}",
        severity: "high",
      },
      recommendation: {
        definitionId: "rec_repeated_workflow_failure",
        version: "1.0.0",
        title: "Repair failing workflows",
        description: "Create recovery work for failing automations.",
        category: "risk",
        sourceInsightDefinitionIds: ["ins_repeated_workflow_failure"],
        recommendedActions: [workAction("Create workflow repair work")],
      },
    },
    {
      observation: {
        definitionId: "obs_duplicate_operational_data",
        version: "1.0.0",
        title: "Duplicate operational data",
        description: "Conflicting party records sharing identity.",
        category: "data_quality",
        evaluatorId: "obs_duplicate_operational_data",
      },
      insight: {
        definitionId: "ins_duplicate_operational_data",
        version: "1.0.0",
        title: "Duplicate records create conflicting operations",
        description: "Shared emails across parties risk wrong follow-up.",
        category: "data_quality",
        requiredObservationDefinitionIds: ["obs_duplicate_operational_data"],
        explanationTemplate: "{{explanation}}",
      },
      recommendation: {
        definitionId: "rec_duplicate_operational_data",
        version: "1.0.0",
        title: "Resolve duplicate records",
        description: "Create governed work to merge or clarify duplicates.",
        category: "data_quality",
        sourceInsightDefinitionIds: ["ins_duplicate_operational_data"],
        recommendedActions: [workAction("Create duplicate resolution work")],
      },
    },
  ];

  for (const triple of triples) {
    if (!registry.getObservation(triple.observation.definitionId) || replace) {
      registry.registerObservation(triple.observation, { replace, source: "core" });
    }
    if (!registry.getInsight(triple.insight.definitionId) || replace) {
      registry.registerInsight(triple.insight, { replace, source: "core" });
    }
    if (!registry.getRecommendation(triple.recommendation.definitionId) || replace) {
      registry.registerRecommendation(triple.recommendation, { replace, source: "core" });
    }
  }

  registered = true;
  return registry;
}

export function resetBusinessIntelligenceDefinitionRegistrationForTests(registry) {
  registered = false;
  return registerDefaultBusinessIntelligenceDefinitions({ registry, replace: true });
}
