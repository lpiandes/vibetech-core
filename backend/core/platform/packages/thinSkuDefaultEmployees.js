/**
 * Guaranteed thin-SKU workers with runnable automation paths (approve-first).
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  applyOperatingContractPatch,
  ensureEmployeeOperatingContract,
} from "../../ai-builder/operating-contract/buildOperatingContract.js";
import {
  PATH_AUDIENCES,
  PATH_RUN_MODES,
  PATH_STEP_TYPES,
} from "../../ai-builder/operating-contract/automationPath.js";

function salesAssistantPath() {
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
        label: "Add to pipeline",
      },
      {
        id: "step_email",
        type: PATH_STEP_TYPES.SEND_EMAIL,
        enabled: true,
        runMode: PATH_RUN_MODES.MANUAL,
        audience: PATH_AUDIENCES.SUBMITTER,
        label: "Draft outreach email",
        subject: "Following up — {{businessName}}",
        body: "Hi {{name}},\n\nThanks for your interest. Happy to answer questions or set a time.\n\n— {{businessName}}",
      },
    ],
  };
}

function leadFollowUpPath() {
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
        label: "Add lead to pipeline",
      },
      {
        id: "step_email",
        type: PATH_STEP_TYPES.SEND_EMAIL,
        enabled: true,
        runMode: PATH_RUN_MODES.MANUAL,
        audience: PATH_AUDIENCES.SUBMITTER,
        label: "Draft follow-up email",
        subject: "Thanks for reaching out",
        body: "Hi {{name}},\n\nThanks for submitting the form — we received it and will follow up shortly.\n\n— {{businessName}}",
      },
      {
        id: "step_sms",
        type: PATH_STEP_TYPES.SEND_SMS,
        enabled: true,
        runMode: PATH_RUN_MODES.MANUAL,
        audience: PATH_AUDIENCES.SUBMITTER,
        label: "Draft follow-up SMS",
        body: "Hi {{name}} — we got your request and will follow up soon.",
      },
    ],
  };
}

function withRunnableContract(base, { automationPath, trigger }) {
  const ensured = ensureEmployeeOperatingContract(base, {});
  const patched = applyOperatingContractPatch({
    employee: ensured,
    patch: {
      automationPath,
      trigger,
    },
  });
  const { _operatingContractMeta, ...rest } = ensured;
  const automations = (Array.isArray(ensured.automationDefinitions) ? ensured.automationDefinitions : [])
    .map((auto) => ({ ...auto, status: "ACTIVE" }));
  return deepFreeze({
    ...rest,
    operatingContract: patched.contract,
    automationDefinitions: automations,
    packDefault: true,
    activateOnInstall: true,
  });
}

export function buildDefaultSalesAssistantEmployee() {
  return withRunnableContract(
    {
      employeeId: "emp_sales_assistant_default",
      id: "emp_sales_assistant_default",
      archetypeId: "follow_up_specialist",
      label: "Sales Assistant",
      displayName: "Sales Assistant",
      purpose: "Draft outreach from new leads for owner approval before send.",
      communicationPermissions: { customerFacingRequiresApproval: true },
      connectionDependencies: ["business_email"],
    },
    {
      automationPath: salesAssistantPath(),
      trigger: {
        mode: "manual_or_events",
        summary: "When a new lead or form arrives",
        eventTypes: ["NEW_INQUIRY", "FORM_SUBMIT", "META_LEAD", "SPECIALTY_JOB_REQUESTED"],
      },
    },
  );
}

export function buildDefaultLeadFollowUpEmployee() {
  return withRunnableContract(
    {
      employeeId: "emp_lead_follow_up_default",
      id: "emp_lead_follow_up_default",
      archetypeId: "intake_specialist",
      label: "Lead Follow-up",
      displayName: "Lead Follow-up",
      purpose: "On form or Meta lead, add to pipeline and draft approve-first follow-up.",
      communicationPermissions: { customerFacingRequiresApproval: true },
      connectionDependencies: ["business_email"],
    },
    {
      automationPath: leadFollowUpPath(),
      trigger: {
        mode: "manual_or_events",
        summary: "When a website form or Meta lead arrives",
        eventTypes: ["FORM_SUBMIT", "META_LEAD", "NEW_INQUIRY", "SPECIALTY_JOB_REQUESTED"],
      },
    },
  );
}
