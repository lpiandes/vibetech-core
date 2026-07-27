import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { presentTriggerStartCopy } from "../specialty/triggerHowItStarts.js";

export const PATH_STEP_TYPES = Object.freeze({
  SEND_EMAIL: "send_email",
  SEND_SMS: "send_sms",
  CREATE_DRAFT: "create_draft",
  ADD_TO_PIPELINE: "add_to_pipeline",
  NOTIFY_TEAM: "notify_team",
});

export const PATH_RUN_MODES = Object.freeze({
  MANUAL: "manual",
  AUTO: "auto",
});

export const PATH_AUDIENCES = Object.freeze({
  SCOPE_WHO: "scope_who",
  TEAM: "team",
  SUBMITTER: "submitter",
  CUSTOM: "custom",
});

function asArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value)].filter(Boolean);
}

function answerText(raw) {
  if (raw == null) return "";
  if (typeof raw === "object") {
    if (raw.notApplicable) return "";
    return String(raw.value ?? "").trim();
  }
  return String(raw).trim();
}

function newStepId(prefix = "step") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizePeople(step = {}) {
  if (Array.isArray(step.people) && step.people.length) {
    return step.people.map((person, index) => ({
      id: String(person?.id ?? `person_${index}`),
      name: String(person?.name ?? "").trim(),
      email: String(person?.email ?? "").trim(),
      phone: String(person?.phone ?? "").trim(),
    })).filter((person) => person.name || person.email || person.phone);
  }
  return [];
}

/**
 * Manual = wait for owner (Needs you). Auto = run when triggered.
 * Accepts legacy requiresApproval boolean.
 */
export function resolveStepRunMode(step = {}, { defaultMode = PATH_RUN_MODES.MANUAL } = {}) {
  const raw = String(step.runMode ?? "").toLowerCase();
  if (raw === PATH_RUN_MODES.AUTO || raw === PATH_RUN_MODES.MANUAL) return raw;
  if (step.requiresApproval === false) return PATH_RUN_MODES.AUTO;
  if (step.requiresApproval === true) return PATH_RUN_MODES.MANUAL;
  return defaultMode;
}

export function stepIsManual(step = {}) {
  return resolveStepRunMode(step) === PATH_RUN_MODES.MANUAL;
}

/** True when any enabled step needs the owner after a fire. */
export function pathNeedsOwnerAttention(path = {}) {
  const steps = Array.isArray(path?.steps) ? path.steps : [];
  return steps.some((step) => step && step.enabled !== false && stepIsManual(step));
}

function defaultRunModeForType(type, direction = "external") {
  if (type === PATH_STEP_TYPES.ADD_TO_PIPELINE) return PATH_RUN_MODES.AUTO;
  if (type === PATH_STEP_TYPES.NOTIFY_TEAM) return PATH_RUN_MODES.AUTO;
  if (type === PATH_STEP_TYPES.SEND_EMAIL || type === PATH_STEP_TYPES.SEND_SMS) {
    return direction === "internal" ? PATH_RUN_MODES.AUTO : PATH_RUN_MODES.MANUAL;
  }
  return PATH_RUN_MODES.MANUAL;
}

/**
 * Normalize a single automation path step.
 */
export function normalizePathStep(step = {}, index = 0) {
  const type = String(step.type ?? PATH_STEP_TYPES.CREATE_DRAFT);
  const id = String(step.id ?? newStepId(`step${index}`));
  const base = {
    id,
    type,
    label: String(step.label ?? defaultLabelForType(type)).trim(),
    enabled: step.enabled === false ? false : true,
    order: Number.isFinite(Number(step.order)) ? Number(step.order) : index,
  };
  const people = normalizePeople(step);

  if (type === PATH_STEP_TYPES.SEND_EMAIL) {
    const direction = String(step.direction ?? "external") === "internal" ? "internal" : "external";
    const channels = asArray(step.channels);
    const runMode = resolveStepRunMode(step, { defaultMode: defaultRunModeForType(type, direction) });
    return deepFreeze({
      ...base,
      direction,
      channels: channels.length ? channels : ["email"],
      audience: String(step.audience ?? (direction === "internal" ? PATH_AUDIENCES.TEAM : PATH_AUDIENCES.SCOPE_WHO)),
      customRecipients: String(step.customRecipients ?? "").trim(),
      people,
      subject: String(step.subject ?? "").trim(),
      body: String(step.body ?? "").trim(),
      runMode,
      requiresApproval: runMode === PATH_RUN_MODES.MANUAL,
    });
  }
  if (type === PATH_STEP_TYPES.SEND_SMS) {
    const direction = String(step.direction ?? "external") === "internal" ? "internal" : "external";
    const channels = asArray(step.channels);
    const runMode = resolveStepRunMode(step, { defaultMode: defaultRunModeForType(type, direction) });
    return deepFreeze({
      ...base,
      direction,
      channels: channels.length ? channels : ["sms"],
      audience: String(step.audience ?? (direction === "internal" ? PATH_AUDIENCES.TEAM : PATH_AUDIENCES.SCOPE_WHO)),
      customRecipients: String(step.customRecipients ?? "").trim(),
      people,
      subject: String(step.subject ?? "").trim(),
      body: String(step.body ?? "").trim(),
      runMode,
      requiresApproval: runMode === PATH_RUN_MODES.MANUAL,
    });
  }
  if (type === PATH_STEP_TYPES.ADD_TO_PIPELINE) {
    const runMode = resolveStepRunMode(step, {
      defaultMode: defaultRunModeForType(type),
    });
    return deepFreeze({
      ...base,
      pipelineLabel: String(step.pipelineLabel ?? "New leads").trim(),
      assignee: String(step.assignee ?? "team").trim(),
      runMode,
      requiresApproval: runMode === PATH_RUN_MODES.MANUAL,
    });
  }
  if (type === PATH_STEP_TYPES.NOTIFY_TEAM) {
    const channels = asArray(step.channels);
    const channel = String(step.channel ?? "email");
    const runMode = resolveStepRunMode(step, { defaultMode: PATH_RUN_MODES.AUTO });
    return deepFreeze({
      ...base,
      direction: "internal",
      audience: String(step.audience ?? PATH_AUDIENCES.TEAM),
      customRecipients: String(step.customRecipients ?? "").trim(),
      people,
      channel,
      channels: channels.length
        ? channels
        : (channel.includes("sms") && channel.includes("email")
          ? ["email", "sms"]
          : channel.includes("sms")
            ? ["sms"]
            : ["email"]),
      subject: String(step.subject ?? "").trim(),
      body: String(step.body ?? "").trim(),
      runMode,
      requiresApproval: false,
    });
  }
  // create_draft (default)
  const runMode = resolveStepRunMode(step, { defaultMode: PATH_RUN_MODES.MANUAL });
  return deepFreeze({
    ...base,
    type: PATH_STEP_TYPES.CREATE_DRAFT,
    briefHint: String(step.briefHint ?? "").trim(),
    runMode,
    requiresApproval: runMode === PATH_RUN_MODES.MANUAL,
  });
}

function defaultLabelForType(type) {
  switch (String(type)) {
    case PATH_STEP_TYPES.SEND_EMAIL:
      return "Send email";
    case PATH_STEP_TYPES.SEND_SMS:
      return "Send SMS";
    case PATH_STEP_TYPES.ADD_TO_PIPELINE:
      return "Add to pipeline";
    case PATH_STEP_TYPES.NOTIFY_TEAM:
      return "Notify team";
    case PATH_STEP_TYPES.CREATE_DRAFT:
    default:
      return "Create draft";
  }
}

/** Owner-facing bold title — always short and action-shaped. */
export function simpleStepTitle(type) {
  return defaultLabelForType(type);
}

function audiencePhrase(audience) {
  switch (String(audience ?? PATH_AUDIENCES.SCOPE_WHO)) {
    case PATH_AUDIENCES.TEAM:
      return "your business team";
    case PATH_AUDIENCES.SUBMITTER:
      return "the person who triggered this";
    case PATH_AUDIENCES.CUSTOM:
      return "custom recipients";
    case PATH_AUDIENCES.SCOPE_WHO:
    default:
      return "the people in Scope";
  }
}

/**
 * Small description under the bold title — who / what / approval.
 */
export function describePathStep(step = {}) {
  if (step.enabled === false) return "Turned off";
  const type = String(step.type ?? PATH_STEP_TYPES.CREATE_DRAFT);
  const manual = stepIsManual(step);
  const modeLabel = manual ? "Manual" : "Auto";

  if (type === PATH_STEP_TYPES.CREATE_DRAFT) {
    return manual
      ? "Manual · Opens Work in Needs you for your review"
      : "Auto · Prepares Work without pinging Needs you";
  }
  if (type === PATH_STEP_TYPES.SEND_EMAIL) {
    const to = audiencePhrase(step.audience);
    const subject = String(step.subject ?? "").trim();
    const mode = manual ? "Needs you before send" : "Sends when this runs";
    return subject
      ? `${modeLabel} · Email ${to} · “${subject}” · ${mode}`
      : `${modeLabel} · Email ${to} · ${mode}`;
  }
  if (type === PATH_STEP_TYPES.SEND_SMS) {
    const to = audiencePhrase(step.audience);
    const body = String(step.body ?? "").trim();
    const mode = manual ? "Needs you before send" : "Sends when this runs";
    if (body) {
      const clipped = body.length > 42 ? `${body.slice(0, 41)}…` : body;
      return `${modeLabel} · Text ${to} · “${clipped}” · ${mode}`;
    }
    return `${modeLabel} · Text ${to} · ${mode}`;
  }
  if (type === PATH_STEP_TYPES.ADD_TO_PIPELINE) {
    const pipeline = String(step.pipelineLabel ?? "follow-up").trim() || "follow-up";
    return manual
      ? `Manual · Ask you before adding a card to “${pipeline}”`
      : `Auto · Creates a card in “${pipeline}”`;
  }
  if (type === PATH_STEP_TYPES.NOTIFY_TEAM) {
    const subject = String(step.subject ?? "").trim();
    const base = subject
      ? `Alerts your business team · “${subject}”`
      : "Alerts your business team";
    return `${modeLabel} · ${base}`;
  }
  return defaultLabelForType(type);
}

/**
 * Build a sensible default path from operating-contract scope (Who / Channels).
 * Always starts with create_draft (never silent send), then channel actions.
 */
export function buildDefaultAutomationPath({ contract = {}, schema = null } = {}) {
  const answers = contract?.scope?.answers ?? {};
  const where = answerText(answers.where).toLowerCase();
  const wantsEmail = !where || /email|e-mail/.test(where);
  const wantsSms = /sms|text/.test(where);
  const rules = answerText(answers.constraints);

  const steps = [
    normalizePathStep({
      id: "step_draft",
      type: PATH_STEP_TYPES.CREATE_DRAFT,
      label: "Create draft",
      briefHint: "",
      order: 0,
    }, 0),
  ];

  if (wantsEmail) {
    steps.push(normalizePathStep({
      id: "step_email_audience",
      type: PATH_STEP_TYPES.SEND_EMAIL,
      label: "Send email",
      audience: PATH_AUDIENCES.SCOPE_WHO,
      subject: "",
      body: rules ? `(Follow: ${rules})` : "",
      requiresApproval: true,
      order: steps.length,
    }, steps.length));
  }

  if (wantsSms) {
    steps.push(normalizePathStep({
      id: "step_sms_audience",
      type: PATH_STEP_TYPES.SEND_SMS,
      label: "Send SMS",
      audience: PATH_AUDIENCES.SCOPE_WHO,
      body: "",
      requiresApproval: true,
      order: steps.length,
    }, steps.length));
  }

  // Always offer a team notify + pipeline step pattern (owner can disable).
  steps.push(normalizePathStep({
    id: "step_notify_team",
    type: PATH_STEP_TYPES.NOTIFY_TEAM,
    label: "Notify team",
    channel: "email",
    subject: "Specialty run needs review",
    body: "",
    enabled: false,
    order: steps.length,
  }, steps.length));

  steps.push(normalizePathStep({
    id: "step_pipeline",
    type: PATH_STEP_TYPES.ADD_TO_PIPELINE,
    label: "Add to pipeline",
    pipelineLabel: "Needs contact",
    enabled: false,
    order: steps.length,
  }, steps.length));

  return deepFreeze({
    version: 1,
    schemaId: schema?.schemaId ?? contract?.schemaId ?? null,
    steps,
  });
}

/**
 * Normalize full automationPath; seed default if missing/empty.
 */
export function normalizeAutomationPath(path = null, { contract = {}, schema = null } = {}) {
  if (path && typeof path === "object" && Array.isArray(path.steps) && path.steps.length > 0) {
    const steps = path.steps
      .map((step, index) => normalizePathStep(step, index))
      .sort((a, b) => Number(a.order) - Number(b.order))
      .map((step, index) => normalizePathStep({ ...step, order: index }, index));
    return deepFreeze({
      version: 1,
      schemaId: path.schemaId ?? schema?.schemaId ?? contract?.schemaId ?? null,
      customized: Boolean(path.customized),
      steps,
    });
  }
  return buildDefaultAutomationPath({ contract, schema });
}

/**
 * Presentation for Zapier-like UI: trigger node + ordered action nodes.
 */
export function presentAutomationPath({ contract = {}, schema = null } = {}) {
  const path = normalizeAutomationPath(contract.automationPath, { contract, schema });
  const triggerMode = String(contract?.trigger?.mode ?? "manual_or_events");
  const eventTypes = asArray(contract?.trigger?.eventTypes);

  const startCopy = presentTriggerStartCopy({ trigger: contract?.trigger ?? { mode: triggerMode, eventTypes } });
  const triggerNode = deepFreeze({
    id: "trigger",
    kind: "trigger",
    label: startCopy.title,
    summary: startCopy.summary,
    mode: triggerMode,
    eventTypes,
    schedule: contract?.trigger?.schedule ?? null,
  });

  const actionNodes = path.steps.map((step) => deepFreeze({
    ...step,
    kind: "action",
    tone: step.enabled === false ? "muted" : stepTypeTone(step.type),
    displayTitle: simpleStepTitle(step.type),
    displaySummary: describePathStep(step),
  }));

  return deepFreeze({
    trigger: triggerNode,
    steps: actionNodes,
    path,
  });
}

function stepTypeTone(type) {
  switch (String(type)) {
    case PATH_STEP_TYPES.SEND_EMAIL:
      return "email";
    case PATH_STEP_TYPES.SEND_SMS:
      return "sms";
    case PATH_STEP_TYPES.ADD_TO_PIPELINE:
      return "pipeline";
    case PATH_STEP_TYPES.NOTIFY_TEAM:
      return "team";
    default:
      return "draft";
  }
}

export function createEmptyPathStep(type = PATH_STEP_TYPES.SEND_EMAIL) {
  return normalizePathStep({ type, label: defaultLabelForType(type) }, 0);
}
