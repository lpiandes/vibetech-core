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

function receptionistPath() {
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
        label: "Log caller in intake",
      },
      {
        id: "step_email",
        type: PATH_STEP_TYPES.SEND_EMAIL,
        enabled: true,
        runMode: PATH_RUN_MODES.MANUAL,
        audience: PATH_AUDIENCES.SUBMITTER,
        label: "Draft callback follow-up",
        subject: "Following up on your call — {{businessName}}",
        body: "Hi {{name}},\n\nThanks for calling. We have your note and will follow up shortly.\n\n— {{businessName}}",
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

function appointmentSetterPath() {
  return {
    version: 1,
    customized: true,
    steps: [
      { id: "step_pipeline", type: PATH_STEP_TYPES.ADD_TO_PIPELINE, enabled: true, runMode: PATH_RUN_MODES.AUTO, audience: PATH_AUDIENCES.SUBMITTER, label: "Add lead to pipeline" },
      { id: "step_sms", type: PATH_STEP_TYPES.SEND_SMS, enabled: true, runMode: PATH_RUN_MODES.AUTO, audience: PATH_AUDIENCES.SUBMITTER, direction: "external", label: "Text lead to book appointment", body: "Hi {{name}} — thanks for your interest. Reply to this text to book an appointment with {{businessName}}." },
      { id: "step_notify", type: PATH_STEP_TYPES.NOTIFY_TEAM, enabled: true, runMode: PATH_RUN_MODES.AUTO, audience: PATH_AUDIENCES.TEAM, label: "Notify team lead is being texted", body: "A new lead is receiving appointment-setting SMS follow-up." },
      { id: "step_draft", type: PATH_STEP_TYPES.CREATE_DRAFT, enabled: true, runMode: PATH_RUN_MODES.MANUAL, label: "Review appointment setter activity", briefHint: "Owner-visible appointment-setting activity and follow-up." },
    ],
  };
}

function socialScreenerPath() {
  return {
    version: 1,
    customized: true,
    steps: [
      {
        id: "step_social_screen",
        type: PATH_STEP_TYPES.SOCIAL_SCREEN,
        enabled: true,
        runMode: PATH_RUN_MODES.AUTO,
        label: "Run social background screen",
      },
      {
        id: "step_draft_report",
        type: PATH_STEP_TYPES.CREATE_DRAFT,
        enabled: true,
        runMode: PATH_RUN_MODES.MANUAL,
        label: "Review filtered report",
        briefHint: "Social background screening report for owner review before any adverse action.",
      },
      {
        id: "step_email_report",
        type: PATH_STEP_TYPES.SEND_EMAIL,
        enabled: true,
        runMode: PATH_RUN_MODES.MANUAL,
        audience: PATH_AUDIENCES.TEAM,
        direction: "internal",
        label: "Email report to hiring manager",
        subject: "Social background screening report — {{name}}",
        body: "A filtered social background screening report is ready for review in Needs Attention / Work.\n\nSubject: {{name}}\n\n— {{businessName}}",
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

export function buildDefaultAppointmentSetterEmployee() {
  return withRunnableContract(
    {
      employeeId: "emp_appointment_setter_default",
      id: "emp_appointment_setter_default",
      archetypeId: "appointment_setter",
      label: "Lead Appointment Setter",
      displayName: "Lead Appointment Setter",
      purpose: "Instantly qualifies Meta and form leads by SMS and requests appointment holds for team confirmation.",
      communicationPermissions: { customerFacingRequiresApproval: false },
      connectionDependencies: ["sms_channel", "calendar", "meta_lead_ads"],
    },
    {
      automationPath: appointmentSetterPath(),
      trigger: {
        mode: "manual_or_events",
        summary: "When a Meta lead, form, or new inquiry arrives",
        eventTypes: ["META_LEAD", "FORM_SUBMIT", "NEW_INQUIRY", "SPECIALTY_JOB_REQUESTED"],
      },
    },
  );
}

/**
 * AI Receptionist default — phone inbound, not Meta/form lead capture.
 */
export function buildDefaultReceptionistEmployee() {
  return withRunnableContract(
    {
      employeeId: "emp_receptionist_intake_default",
      id: "emp_receptionist_intake_default",
      archetypeId: "intake_specialist",
      label: "Front Desk Follow-up",
      displayName: "Front Desk Follow-up",
      purpose: "On inbound calls, log the caller and draft approve-first follow-ups. Live answers run on Twilio Voice + Knowledge.",
      communicationPermissions: { customerFacingRequiresApproval: true },
      connectionDependencies: ["voice_channel"],
    },
    {
      automationPath: receptionistPath(),
      trigger: {
        mode: "manual_or_events",
        summary: "When an inbound phone call arrives",
        eventTypes: ["INBOUND_VOICE_CALL", "NEW_INQUIRY", "SPECIALTY_JOB_REQUESTED"],
      },
    },
  );
}

/**
 * Rewrite installed receptionist workers that still carry lead/Meta form triggers.
 */
export function healReceptionistEmployeeIfNeeded(employee) {
  const id = String(employee?.employeeId ?? employee?.id ?? "");
  const label = String(employee?.label ?? employee?.displayName ?? "");
  const isReceptionist =
    id === "emp_receptionist_intake_default"
    || /front.?desk|reception/i.test(label);
  if (!isReceptionist) return employee;
  const events = Array.isArray(employee?.operatingContract?.trigger?.eventTypes)
    ? employee.operatingContract.trigger.eventTypes.map(String)
    : [];
  const hasLeadNoise = events.includes("META_LEAD") || events.includes("FORM_SUBMIT");
  const missingVoice = !events.includes("INBOUND_VOICE_CALL");
  if (!hasLeadNoise && !missingVoice) return employee;
  return buildDefaultReceptionistEmployee();
}

/**
 * Social Background Screening default — public-web screen → filtered report for review.
 */
export function buildDefaultSocialScreenerEmployee() {
  return withRunnableContract(
    {
      employeeId: "emp_social_background_screener_default",
      id: "emp_social_background_screener_default",
      archetypeId: "follow_up_specialist",
      label: "Social Background Screener",
      displayName: "Social Background Screener",
      purpose: "Run public social media searches and draft an FCRA-filtered background report for owner review before any adverse action.",
      communicationPermissions: { customerFacingRequiresApproval: true },
      connectionDependencies: ["social_screening"],
    },
    {
      automationPath: socialScreenerPath(),
      trigger: {
        mode: "manual_or_events",
        summary: "When a social background screen is requested",
        eventTypes: ["SOCIAL_SCREEN_REQUESTED", "SPECIALTY_JOB_REQUESTED"],
      },
    },
  );
}
