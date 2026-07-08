import { createIndustryPackage } from "../../../backend/core/industries/IndustryPackage.js";
import { buildOutcomeAutomationConfiguration } from "../../../backend/core/industries/install/buildOutcomeAutomationConfiguration.js";

/** Minimal operations fixture package for universality proof. */
export const OPERATIONS_FIXTURE_PACKAGE = createIndustryPackage({
  id: "pkg_fixture_operations",
  name: "Operations Fixture",
  description: "Minimal operations package for universality proof.",
  version: 1,
  terminology: {
    party: { default: "Stakeholder" },
    request: { OPERATIONAL_ISSUE: "Operational Issue" },
    work: { operational_action: "Operational Action" },
  },
  capabilities: [
    { id: "issue_triage", name: "Issue Triage", description: "Triage operational issues.", category: "operations" },
  ],
  automationConfigurations: [
    {
      id: "ops_action_required",
      configuration: buildOutcomeAutomationConfiguration({
        outcomeValue: "action_required",
        workType: "operational_action",
        title: "Operational action",
        workItemIdPrefix: "work_ops_",
        actionId: "act_ops_action",
        stageId: "stage_ops",
        queueId: "queue_ops",
      }),
    },
  ],
  knowledgeCategories: [
    { id: "OPS_PROCEDURES", name: "Operational Procedures", description: "Standard operating procedures.", sortOrder: 500 },
  ],
  requestTypes: [{ id: "OPERATIONAL_ISSUE", displayName: "Operational Issue" }],
  workTypes: [{ id: "operational_action", displayName: "Operational Action" }],
  interactionOutcomes: [{ id: "action_required", displayName: "Action Required" }],
  metadata: { fixture: true },
});
