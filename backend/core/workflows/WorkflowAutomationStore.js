/**
 * Durable HighLevel/Zapier-style workflow automations on
 * installation.configuration.workflows
 */
import crypto from "node:crypto";

export const WORKFLOW_STATUSES = Object.freeze(["live", "off"]);

export const TRIGGER_TYPES = Object.freeze([
  { id: "form_submit", label: "Website form submitted", eventType: "FORM_SUBMIT" },
  { id: "meta_lead", label: "Facebook / Meta lead", eventType: "META_LEAD" },
  { id: "contact_created", label: "New contact created", eventType: "CONTACT_CREATED" },
  { id: "contact_imported", label: "Lead list imported", eventType: "CONTACT_IMPORTED" },
  { id: "pipeline_stage", label: "Pipeline stage changed", eventType: "PIPELINE_STAGE_ENTERED" },
  { id: "pipeline_card_created", label: "Card added to pipeline", eventType: "PIPELINE_CARD_CREATED" },
  { id: "party_subject_linked", label: "Person linked to a property", eventType: "PARTY_SUBJECT_LINKED" },
  { id: "manual", label: "Run manually / test", eventType: "MANUAL_RUN" },
]);

export const CONDITION_OPS = Object.freeze([
  { id: "equals", label: "is" },
  { id: "not_equals", label: "is not" },
  { id: "contains", label: "contains" },
  { id: "exists", label: "has any value" },
  { id: "not_exists", label: "is empty" },
  { id: "in", label: "is one of" },
]);

/** Friendly fields for non-technical condition builder */
export const CONDITION_FIELDS = Object.freeze([
  { id: "contact.kind", label: "Contact type" },
  { id: "contact.email", label: "Email" },
  { id: "contact.phone", label: "Phone" },
  { id: "contact.name", label: "Name" },
  { id: "contact.tags", label: "Tags" },
  { id: "pipeline.stageId", label: "Pipeline stage id" },
  { id: "pipeline.stageLabel", label: "Pipeline stage name" },
  { id: "pipeline.name", label: "Pipeline name" },
  { id: "subject.id", label: "Property / listing id" },
  { id: "subject.name", label: "Property / listing name" },
  { id: "source", label: "Source" },
]);

export const ACTION_TYPES = Object.freeze([
  { id: "add_to_pipeline", label: "Add to pipeline", blurb: "Create a card on a board stage" },
  { id: "tag_contact", label: "Add tags to contact", blurb: "Label the person for later filters" },
  { id: "update_contact", label: "Update contact", blurb: "Change type, notes, or owner" },
  { id: "create_work", label: "Create work item", blurb: "Put a task in the Work queue" },
  { id: "notify_team", label: "Notify team", blurb: "Create an internal alert work item" },
  { id: "run_workflow", label: "Start another automation", blurb: "Chain into a different workflow" },
]);

export function emptyWorkflowState() {
  return {
    version: 1,
    workflows: [],
    updatedAt: null,
  };
}

export function readWorkflowState(installation = null) {
  const raw = installation?.configuration?.workflows;
  if (!raw || typeof raw !== "object") return emptyWorkflowState();
  return {
    version: 1,
    workflows: Array.isArray(raw.workflows) ? raw.workflows.map(normalizeWorkflow) : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

export async function writeWorkflowState({ platformStore, installation, workflowsState, actorId = null }) {
  if (!platformStore || !installation) {
    throw new Error("writeWorkflowState requires platformStore and installation");
  }
  const next = {
    version: 1,
    workflows: (workflowsState.workflows ?? []).map(normalizeWorkflow),
    updatedAt: new Date().toISOString(),
  };
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "workflows_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration ?? {}),
      workflows: next,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      { at: next.updatedAt, action: "workflows_update", actorId },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });
  return next;
}

export function normalizeWorkflow(raw = {}) {
  const id = String(raw.id || `wf_${crypto.randomUUID().slice(0, 10)}`);
  const triggerType = String(raw.trigger?.type || raw.triggerType || "form_submit");
  const triggerMeta = TRIGGER_TYPES.find((t) => t.id === triggerType) || TRIGGER_TYPES[0];
  return {
    id,
    name: String(raw.name ?? "Untitled automation").trim() || "Untitled automation",
    description: String(raw.description ?? "").trim(),
    status: WORKFLOW_STATUSES.includes(String(raw.status)) ? String(raw.status) : "off",
    trigger: {
      type: triggerMeta.id,
      eventType: triggerMeta.eventType,
      label: triggerMeta.label,
      // optional filter e.g. specific pipeline stage
      config: raw.trigger?.config && typeof raw.trigger.config === "object"
        ? raw.trigger.config
        : {},
    },
    steps: Array.isArray(raw.steps) ? raw.steps.map(normalizeStep) : [],
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export function normalizeStep(raw = {}) {
  const type = String(raw.type || "action");
  const id = String(raw.id || `step_${crypto.randomUUID().slice(0, 8)}`);
  if (type === "condition") {
    return {
      id,
      type: "condition",
      logic: String(raw.logic || "and").toLowerCase() === "or" ? "or" : "and",
      rules: Array.isArray(raw.rules)
        ? raw.rules.map((r) => ({
          field: String(r.field || "contact.kind"),
          op: String(r.op || "equals"),
          value: r.value ?? "",
        }))
        : [{ field: "contact.kind", op: "equals", value: "lead" }],
      thenSteps: Array.isArray(raw.thenSteps) ? raw.thenSteps.map(normalizeStep) : [],
      elseSteps: Array.isArray(raw.elseSteps) ? raw.elseSteps.map(normalizeStep) : [],
    };
  }
  return {
    id,
    type: "action",
    action: String(raw.action || "create_work"),
    params: raw.params && typeof raw.params === "object" ? { ...raw.params } : {},
    label: String(raw.label || ""),
  };
}

export function createBlankWorkflow({ name = "New automation", triggerType = "form_submit" } = {}) {
  return normalizeWorkflow({
    name,
    status: "off",
    trigger: { type: triggerType },
    steps: [
      {
        type: "action",
        action: "create_work",
        params: { title: "Follow up on new lead", brief: "Automation created this work item." },
      },
    ],
  });
}

export function upsertWorkflow(state, workflow) {
  const next = normalizeWorkflow(workflow);
  next.updatedAt = new Date().toISOString();
  const workflows = [...(state.workflows ?? [])];
  const idx = workflows.findIndex((w) => String(w.id) === String(next.id));
  if (idx >= 0) workflows[idx] = { ...workflows[idx], ...next, createdAt: workflows[idx].createdAt };
  else workflows.push(next);
  return { ...state, workflows };
}

export function removeWorkflow(state, workflowId) {
  const id = String(workflowId ?? "").trim();
  return {
    ...state,
    workflows: (state.workflows ?? []).filter((w) => String(w.id) !== id),
  };
}

export function listLiveWorkflowsForEvent(state, eventType) {
  const type = String(eventType ?? "").trim();
  return (state.workflows ?? []).filter((w) => {
    if (String(w.status) !== "live") return false;
    return String(w.trigger?.eventType) === type || String(w.trigger?.type) === type.toLowerCase();
  });
}

export function triggerCatalog() {
  return TRIGGER_TYPES;
}

export function actionCatalog() {
  return ACTION_TYPES;
}

export function conditionFieldCatalog() {
  return CONDITION_FIELDS;
}

export function conditionOpCatalog() {
  return CONDITION_OPS;
}
