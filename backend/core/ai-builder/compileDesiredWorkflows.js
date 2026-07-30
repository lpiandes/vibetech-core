/**
 * Turn discovery "processes to automate" answers into installable AI teammates
 * with concrete automationPath steps (deterministic — works without LLM).
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { presentCompiledWorkflowPurpose } from "../operating-home/presentTeammateHomeGlance.js";
import {
  normalizeAutomationPath,
  normalizePathStep,
  PATH_AUDIENCES,
  PATH_STEP_TYPES,
} from "./operating-contract/automationPath.js";

const CHAIN_SPLIT = /\s*(?:→|->|=>|»)\s*|\s+then\s+/i;

/**
 * @param {{ answers?: object[], businessSummary?: object }} params
 * @returns {Array<{
 *   archetypeId: string,
 *   label: string,
 *   purpose: string,
 *   workflowText: string,
 *   trigger: object,
 *   automationPath: object,
 * }>}
 */
export function compileDesiredWorkflows({
  answers = [],
  businessSummary = {},
} = {}) {
  const workflowAnswer = answers.find((entry) => entry?.questionId === "q_desired_workflows");
  const raw = String(
    workflowAnswer?.answer
      ?? (Array.isArray(businessSummary?.desiredWorkflows)
        ? businessSummary.desiredWorkflows.join("\n")
        : businessSummary?.desiredWorkflows)
      ?? businessSummary?.primaryWorkflow
      ?? "",
  ).trim();
  if (!raw) return deepFreeze([]);

  const processes = splitProcesses(raw).slice(0, 8);
  return deepFreeze(processes.map((workflowText, index) => {
    const compiled = compileWorkflowProcess(workflowText, index);
    return compiled;
  }));
}

export function compileWorkflowProcess(workflowText, index = 0) {
  const text = String(workflowText ?? "").trim();
  const parts = text.split(CHAIN_SPLIT).map((part) => part.trim()).filter(Boolean);
  const triggerPart = parts[0] || text;
  const actionParts = parts.length > 1 ? parts.slice(1) : parts;

  const trigger = inferTrigger(triggerPart);
  const archetype = inferArchetype(text, index);
  const steps = buildStepsFromParts(actionParts, text);
  const automationPath = normalizeAutomationPath(
    { version: 1, customized: true, steps },
    { contract: {} },
  );

  const label = humanWorkflowLabel(text, archetype.label, index);
  return deepFreeze({
    archetypeId: archetype.archetypeId,
    label,
    purpose: presentCompiledWorkflowPurpose(text, trigger),
    workflowText: text,
    trigger,
    automationPath,
  });
}

/**
 * Also usable when owner pastes a chain into the automation AI composer.
 */
export function compileWorkflowChainToPath(instruction = "", { contract = {}, schema = null } = {}) {
  const text = String(instruction ?? "").trim();
  if (!text || !CHAIN_SPLIT.test(text) && !/\b(email|sms|text|pipeline|draft|notify)\b/i.test(text)) {
    return null;
  }
  const parts = text.split(CHAIN_SPLIT).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2 && !/\b(email|sms|pipeline)\b/i.test(text)) return null;

  const actionParts = parts.length > 1 ? parts.slice(1) : parts;
  const triggerPart = parts[0] || text;
  const steps = buildStepsFromParts(actionParts, text);
  const proposedPath = normalizeAutomationPath(
    { version: 1, customized: true, steps },
    { contract, schema },
  );
  const trigger = inferTrigger(triggerPart);
  return deepFreeze({
    ok: true,
    notes: ["Compiled process chain into automation steps"],
    summary: `Path from process: ${text.slice(0, 120)}`,
    proposedPath,
    proposedTrigger: trigger,
    source: "workflow_chain",
  });
}

function splitProcesses(raw) {
  const withNewlines = String(raw).split(/\n+/).map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
  if (withNewlines.length > 1) return withNewlines;
  const single = withNewlines[0] || String(raw).trim();
  if (/[;|]/.test(single) && !CHAIN_SPLIT.test(single.split(/[;|]/)[0] || "")) {
    return single.split(/[;|]/).map((part) => part.trim()).filter(Boolean);
  }
  return single ? [single] : [];
}

function inferTrigger(triggerPart) {
  const lower = String(triggerPart).toLowerCase();
  if (/\b(appointment|book)\b/.test(lower) && /\b(lead|facebook|meta|sms|text)\b/.test(lower)) {
    return { mode: "manual_or_events", summary: "Meta lead or form submit arrives", eventTypes: ["META_LEAD", "FORM_SUBMIT", "SPECIALTY_JOB_REQUESTED"], schedule: null };
  }
  if (/\b(fb|facebook|meta)\b.*\blead\b|\blead\b.*\b(fb|facebook|meta)\b|\blead\s+comes?\s+in\b/.test(lower)) {
    return {
      mode: "manual_or_events",
      summary: "Meta / Facebook lead arrives",
      eventTypes: ["META_LEAD", "SPECIALTY_JOB_REQUESTED"],
      schedule: null,
    };
  }
  if (/\bcalendar\b|\bschedule\b|\bevent\b/.test(lower)) {
    return {
      mode: "manual_or_events",
      summary: "Calendar event created or changed",
      eventTypes: ["SCHEDULE_CHANGE", "EVENT_UPDATE", "SPECIALTY_JOB_REQUESTED"],
      schedule: null,
    };
  }
  if (/\bform\b|\binquir/.test(lower)) {
    return {
      mode: "manual_or_events",
      summary: "New inquiry or form submit",
      eventTypes: ["NEW_INQUIRY", "FORM_SUBMIT", "SPECIALTY_JOB_REQUESTED"],
      schedule: null,
    };
  }
  if (/\bpipeline\b|\bstage\b/.test(lower)) {
    return {
      mode: "manual_or_events",
      summary: "Pipeline stage changes",
      eventTypes: ["PIPELINE_STAGE_ENTERED", "SPECIALTY_JOB_REQUESTED"],
      schedule: null,
    };
  }
  if (/\bannouncement\b/.test(lower)) {
    return {
      mode: "manual_or_events",
      summary: "Announcement requested",
      eventTypes: ["ANNOUNCEMENT_REQUESTED", "SPECIALTY_JOB_REQUESTED"],
      schedule: null,
    };
  }
  return {
    mode: "manual_or_events",
    summary: String(triggerPart).slice(0, 120) || "Manual run or subscribed events",
    eventTypes: ["SPECIALTY_JOB_REQUESTED"],
    schedule: null,
  };
}

function inferArchetype(text, index) {
  const lower = String(text).toLowerCase();
  if (/\b(appointment|book)\b/.test(lower) && /\b(lead|facebook|meta|sms|text)\b/.test(lower)) {
    return { archetypeId: "appointment_setter", label: "Appointment Setter" };
  }
  if (/\b(fb|facebook|meta)\b.*\blead\b|\blead\b/.test(lower)) {
    return {
      archetypeId: "facebook_lead_specialist",
      label: "Meta Lead Specialist",
    };
  }
  if (/\bcalendar\b|\bschedule\b|\bpractice\b|\bgame\b/.test(lower)) {
    return {
      archetypeId: "scheduler",
      label: "Scheduler",
    };
  }
  if (/\bintake\b|\binquir/.test(lower)) {
    return {
      archetypeId: "intake_specialist",
      label: "Intake Specialist",
    };
  }
  if (/\bemail\b|\bsms\b|\btext\b|\bparent\b|\bfamil/.test(lower)) {
    return {
      archetypeId: "communications_specialist",
      label: "Communications Assistant",
    };
  }
  return {
    archetypeId: `owner_defined_${index + 1}`,
    label: humanWorkflowLabel(text, "Process automation", index),
  };
}

function buildStepsFromParts(actionParts, fullText) {
  const lowerAll = String(fullText).toLowerCase();
  const isAppointmentSetter = /\b(appointment|book)\b/.test(lowerAll) && /\b(lead|facebook|meta|sms|text)\b/.test(lowerAll);
  if (isAppointmentSetter) {
    return [
      normalizePathStep({ id: "step_pipeline", type: PATH_STEP_TYPES.ADD_TO_PIPELINE, label: "Add lead to pipeline", enabled: true, order: 0 }, 0),
      normalizePathStep({ id: "step_sms", type: PATH_STEP_TYPES.SEND_SMS, label: "Text lead to book", audience: PATH_AUDIENCES.SCOPE_WHO, requiresApproval: false, order: 1 }, 1),
      normalizePathStep({ id: "step_notify", type: PATH_STEP_TYPES.NOTIFY_TEAM, label: "Notify team", enabled: true, order: 2 }, 2),
    ];
  }
  const steps = [
    normalizePathStep({
      id: "step_draft",
      type: PATH_STEP_TYPES.CREATE_DRAFT,
      label: "Create draft",
      briefHint: String(fullText).slice(0, 240),
      order: 0,
    }, 0),
  ];

  const tokens = actionParts.length ? actionParts : [fullText];
  let wantsEmail = false;
  let wantsSms = false;
  let wantsPipeline = false;
  let wantsNotify = false;
  let pipelineLabel = "New leads";

  for (const token of tokens) {
    const lower = String(token).toLowerCase();
    if (/\bemail\b|\be-mail\b/.test(lower)) wantsEmail = true;
    if (/\bsms\b|\btext\b/.test(lower)) wantsSms = true;
    if (/\bpipeline\b|\bboard\b|\bcrm\b|\blead\s+card\b/.test(lower)) {
      wantsPipeline = true;
      const named = String(token).match(/pipeline[:\s]+["']?([^"'\n.]+)["']?/i);
      if (named?.[1]) pipelineLabel = named[1].trim();
    }
    if (/\bnotify\b|\balert\b|\bteam\b/.test(lower) && !/\bemail\b|\bsms\b/.test(lower)) {
      wantsNotify = true;
    }
  }

  // If no explicit action tokens matched, default to email draft path.
  if (!wantsEmail && !wantsSms && !wantsPipeline && !wantsNotify) {
    wantsEmail = true;
    wantsSms = /\bsms\b|\btext\b/.test(lowerAll);
    wantsPipeline = /\bpipeline\b|\bboard\b/.test(lowerAll);
  }

  if (wantsEmail) {
    steps.push(normalizePathStep({
      id: "step_email",
      type: PATH_STEP_TYPES.SEND_EMAIL,
      label: "Send email",
      audience: PATH_AUDIENCES.SCOPE_WHO,
      subject: "",
      body: "",
      requiresApproval: true,
      order: steps.length,
    }, steps.length));
  }
  if (wantsSms) {
    steps.push(normalizePathStep({
      id: "step_sms",
      type: PATH_STEP_TYPES.SEND_SMS,
      label: "Send SMS",
      audience: PATH_AUDIENCES.SCOPE_WHO,
      body: "",
      requiresApproval: true,
      order: steps.length,
    }, steps.length));
  }
  if (wantsNotify) {
    steps.push(normalizePathStep({
      id: "step_notify",
      type: PATH_STEP_TYPES.NOTIFY_TEAM,
      label: "Notify team",
      channel: "email",
      subject: "Automation needs review",
      body: "",
      enabled: true,
      order: steps.length,
    }, steps.length));
  }
  if (wantsPipeline) {
    steps.push(normalizePathStep({
      id: "step_pipeline",
      type: PATH_STEP_TYPES.ADD_TO_PIPELINE,
      label: "Update pipeline",
      pipelineLabel,
      enabled: true,
      order: steps.length,
    }, steps.length));
  }

  return steps;
}

function humanWorkflowLabel(text, fallback, index) {
  const cleaned = String(text ?? "")
    .split(CHAIN_SPLIT)[0]
    ?.trim()
    .replace(/\s+/g, " ")
    .slice(0, 48);
  if (cleaned && cleaned.length >= 4) {
    return cleaned.replace(/^\w/, (c) => c.toUpperCase());
  }
  return fallback || `Process automation ${index + 1}`;
}
