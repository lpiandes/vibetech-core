import { createIndustryPackage } from "../../../backend/core/industries/IndustryPackage.js";
import { buildOutcomeAutomationConfiguration } from "../../../backend/core/industries/install/buildOutcomeAutomationConfiguration.js";

/** Minimal fixture package proving universality — not a full vertical. */
export const PROFESSIONAL_SERVICES_FIXTURE_PACKAGE = createIndustryPackage({
  id: "pkg_fixture_professional_services",
  name: "Professional Services Fixture",
  description: "Minimal non-PM package for universality proof.",
  version: 1,
  terminology: {
    party: { default: "Client", byRelationship: { CLIENT: "Client" } },
    request: { CLIENT_INTAKE: "Client Intake" },
    work: { client_follow_up: "Client Follow-Up" },
  },
  capabilities: [
    { id: "client_intake", name: "Client Intake", description: "Process new client inquiries.", category: "customer_service" },
  ],
  automationConfigurations: [
    {
      id: "ps_client_follow_up",
      configuration: buildOutcomeAutomationConfiguration({
        outcomeValue: "client_follow_up_required",
        workType: "client_follow_up",
        title: "Client follow-up",
        workItemIdPrefix: "work_ps_client_",
        actionId: "act_ps_client_follow_up",
        stageId: "stage_client",
        queueId: "queue_client",
      }),
    },
  ],
  knowledgeCategories: [
    { id: "PS_CLIENT_POLICIES", name: "Client Policies", description: "Client engagement policies.", sortOrder: 400 },
  ],
  requestTypes: [{ id: "CLIENT_INTAKE", displayName: "Client Intake" }],
  workTypes: [{ id: "client_follow_up", displayName: "Client Follow-Up" }],
  interactionOutcomes: [{ id: "client_follow_up_required", displayName: "Client Follow-Up Required" }],
  subjectTypes: [{ id: "engagement", displayName: "Service Engagement" }],
  inboundRouting: [{ eventKind: "form_submission", requestType: "CLIENT_INTAKE" }],
  segmentTemplates: [
    {
      id: "clients_with_subject",
      name: "Clients with subject interest",
      targetEntityType: "Party",
      criteria: [{ fieldPath: "subjectCount", operator: "EXISTS" }],
    },
  ],
  metadata: { fixture: true },
});
