import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { createBlueprintDefinition } from "../../../blueprints/BlueprintDefinition.js";
import {
  applyOperatingContractPatch,
  ensureEmployeeOperatingContract,
} from "../buildOperatingContract.js";
import {
  PATH_AUDIENCES,
  PATH_RUN_MODES,
  PATH_STEP_TYPES,
} from "../automationPath.js";
import { normalizeRftServiceStandard } from "./rftContract.js";
import { RFT_PIPELINE_ID, RFT_SCHEMA_ID, defaultRftPipelineStages } from "./rftCatalog.js";

/**
 * Revenue Follow-Through v1 blueprint + default employee (B2B services / Northline-shaped).
 * Depends on universal core — not a new industry pack.
 */

function revenueFollowThroughPath() {
  return {
    version: 1,
    customized: true,
    steps: [
      {
        id: "step_pipeline",
        type: PATH_STEP_TYPES.ADD_TO_PIPELINE,
        enabled: true,
        runMode: PATH_RUN_MODES.AUTO,
        audience: PATH_AUDIENCES.SUBMITTER,
        label: "Capture opportunity in Revenue Follow-Through",
      },
      {
        id: "step_email",
        type: PATH_STEP_TYPES.SEND_EMAIL,
        enabled: true,
        runMode: PATH_RUN_MODES.MANUAL,
        audience: PATH_AUDIENCES.SUBMITTER,
        label: "Draft acknowledgement",
        subject: "Thanks for reaching out — {{businessName}}",
        body: "Hi {{name}},\n\nThanks for your interest. We received your request and will follow up shortly.\n\n— {{businessName}}",
      },
      {
        id: "step_notify",
        type: PATH_STEP_TYPES.NOTIFY_TEAM,
        enabled: true,
        runMode: PATH_RUN_MODES.AUTO,
        audience: PATH_AUDIENCES.TEAM,
        label: "Notify owner of new opportunity",
        body: "New opportunity detected and queued for Revenue Follow-Through.",
      },
      {
        id: "step_draft",
        type: PATH_STEP_TYPES.CREATE_DRAFT,
        enabled: true,
        runMode: PATH_RUN_MODES.MANUAL,
        label: "Review follow-through plan",
        briefHint: "Owner-visible opportunity classification, assignment, and next-step draft.",
      },
    ],
  };
}

export function buildDefaultRevenueFollowThroughEmployee() {
  const base = {
    employeeId: "emp_revenue_follow_through_v1",
    id: "emp_revenue_follow_through_v1",
    roleId: "revenue_follow_through",
    archetypeId: "follow_up_specialist",
    label: "Revenue Follow-Through",
    displayName: "Revenue Follow-Through",
    purpose:
      "Own inbound opportunity follow-through: detect, acknowledge, assign, schedule, chase proposals, update systems, and hand off won work.",
    communicationPermissions: { customerFacingRequiresApproval: true },
    connectionDependencies: ["business_email", "calendar"],
    approvalRequirements: ["human_approval"],
    prohibitedActions: ["autonomous_customer_send"],
  };

  const ensured = ensureEmployeeOperatingContract(base, {
    industry: "professional_services",
  });
  const patched = applyOperatingContractPatch({
    employee: ensured,
    industry: "professional_services",
    nowISO: new Date().toISOString(),
    actorId: "system",
    patch: {
      automationPath: revenueFollowThroughPath(),
      trigger: {
        mode: "manual_or_events",
        summary: "When an inbound opportunity arrives or a follow-through card moves",
        eventTypes: [
          "NEW_INQUIRY",
          "FORM_SUBMIT",
          "META_LEAD",
          "INBOUND_VOICE_CALL",
          "INBOUND_SALES_EMAIL",
          "WEBSITE_INQUIRY",
          "PIPELINE_CARD_CREATED",
          "PIPELINE_STAGE_ENTERED",
          "SPECIALTY_JOB_REQUESTED",
        ],
      },
      scope: {
        answers: {
          audience: "Inbound B2B service opportunities and open proposals",
          when: "Acknowledge within 5 minutes during operating hours",
          where: "Website form, email, Meta leads, CRM",
          howMany: "Typical mid-market service volume",
          constraints:
            "Never send pricing outside approved policy; escalate ambiguous cases; customer-facing sends require approval until autonomy is earned",
        },
      },
      rft: normalizeRftServiceStandard(null),
    },
  });

  const { _operatingContractMeta, ...rest } = ensured;
  const automations = (Array.isArray(ensured.automationDefinitions) ? ensured.automationDefinitions : [])
    .map((auto) => ({ ...auto, status: "ACTIVE" }));

  return deepFreeze({
    ...rest,
    roleId: "revenue_follow_through",
    operatingContract: patched.contract,
    automationDefinitions: automations,
    packDefault: true,
    activateOnInstall: true,
  });
}

export function createRevenueFollowThroughBlueprint() {
  const employee = buildDefaultRevenueFollowThroughEmployee();
  return createBlueprintDefinition({
    blueprintId: "bp_rft_b2b_services",
    name: "Revenue Follow-Through (B2B Services)",
    industry: "universal",
    version: 1,
    maturity: "stable",
    source: "platform",
    supportedCapabilities: [
      "work_queue",
      "digital_workforce",
      "approved_knowledge",
      "readiness_checklist",
    ],
    requiredCapabilities: ["work_queue"],
    dependencies: ["bp_platform_universal_core"],
    employeeRecipes: [employee],
    workRecipes: [
      {
        workTypeId: "opportunity_acknowledgement",
        label: "Acknowledge opportunity",
        description: "Initial response under Revenue Follow-Through SLA",
      },
      {
        workTypeId: "won_handoff",
        label: "Won delivery handoff",
        description: "Handoff package for delivery after opportunity won",
      },
    ],
    integrationRequirements: [
      { capabilityId: "business_email", required: true },
      { capabilityId: "calendar", required: true },
      { capabilityId: "crm_or_forms", required: false },
    ],
    readinessChecks: [
      "rft_contract_installed",
      "rft_pipeline_present",
      "email_connected",
      "calendar_connected",
    ],
    acceptanceTests: [
      "rft_schema_resolves",
      "rft_state_machine_proof_gate",
      "rft_opportunity_progress_with_evidence",
    ],
    metadata: {
      contractKind: "revenue_follow_through",
      schemaId: RFT_SCHEMA_ID,
      pipelineId: RFT_PIPELINE_ID,
      pipelineStages: defaultRftPipelineStages(),
      positioning: "Managed Revenue Follow-Through for B2B service businesses",
    },
  });
}
