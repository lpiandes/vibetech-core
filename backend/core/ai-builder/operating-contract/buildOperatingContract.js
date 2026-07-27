import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  resolveOperatingContractSchema,
  TRIGGER_MODES,
} from "./OperatingContractSchemas.js";
import {
  normalizeAutomationPath,
  presentAutomationPath,
  buildDefaultAutomationPath,
} from "./automationPath.js";

function asArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value)].filter(Boolean);
}

function truthyAnswer(value) {
  if (value == null) return false;
  if (typeof value === "object" && !Array.isArray(value)) {
    const text = String(value.value ?? value.text ?? "").trim();
    const na = Boolean(value.notApplicable);
    return na ? Boolean(String(value.reason ?? "").trim()) : Boolean(text);
  }
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim().length > 0;
}

function normalizeAnswer(value) {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return {
      value: value.value ?? value.text ?? "",
      notApplicable: Boolean(value.notApplicable),
      reason: String(value.reason ?? ""),
    };
  }
  if (Array.isArray(value)) {
    return { value: value.map(String).join(", "), notApplicable: false, reason: "" };
  }
  return { value: String(value ?? ""), notApplicable: false, reason: "" };
}

function answerDisplay(answer) {
  const norm = normalizeAnswer(answer);
  if (norm.notApplicable) return norm.reason ? `N/A — ${norm.reason}` : "N/A";
  return String(norm.value ?? "").trim();
}

/**
 * Seed scope answers from discovery business summary when present.
 */
export function seedScopeFromDiscovery(schema, discoverySummary = {}) {
  const summary = discoverySummary && typeof discoverySummary === "object" ? discoverySummary : {};
  const answers = {};
  const teams = String(summary.teamsAndPrograms ?? summary.teams ?? "").trim();
  const schedule = String(summary.scheduleCoordination ?? summary.schedule ?? "").trim();
  const opponents = String(summary.opponentsAndFacilities ?? summary.facilities ?? "").trim();
  const parentComms = String(summary.parentCommunications ?? summary.familyComms ?? "").trim();
  const recall = String(summary.recallProcess ?? summary.dentalRecall ?? "").trim();

  for (const field of schema.scopeFields ?? []) {
    const key = field.key;
    let seeded = "";
    if (key === "audience" && teams) seeded = teams;
    else if (key === "audience" && parentComms) seeded = parentComms;
    else if (key === "audience" && recall) seeded = recall;
    else if (key === "when" && schedule) seeded = schedule;
    else if (key === "when" && recall) seeded = recall;
    else if (key === "where" && opponents) seeded = opponents;
    else if (key === "where" && schedule) seeded = schedule;
    if (seeded) answers[key] = normalizeAnswer(seeded);
  }
  return answers;
}

/**
 * Compute completeness for required scope fields.
 */
export function validateOperatingContractCompleteness(contract = {}, schema = null) {
  const fields = Array.isArray(schema?.scopeFields) ? schema.scopeFields : [];
  const requiredKeys = fields.filter((f) => f.required !== false).map((f) => f.key);
  const answers = contract?.scope?.answers ?? {};
  const missingKeys = requiredKeys.filter((key) => !truthyAnswer(answers[key]));
  return deepFreeze({
    requiredKeys,
    missingKeys,
    complete: missingKeys.length === 0,
  });
}

/**
 * Build a full operating contract for an employee (seed or refresh completeness).
 */
export function buildOperatingContract({
  employee = {},
  industry = null,
  discoverySummary = null,
  existing = null,
  nowISO = null,
  actorId = null,
} = {}) {
  const schema = resolveOperatingContractSchema({ employee, industry });
  const prior = existing?.operatingContract ?? employee.operatingContract ?? existing ?? null;

  const trigger = {
    mode: String(prior?.trigger?.mode ?? schema.triggerDefaults.mode ?? "manual_or_events"),
    eventTypes: asArray(prior?.trigger?.eventTypes ?? schema.triggerDefaults.eventTypes),
    schedule: prior?.trigger?.schedule ?? schema.triggerDefaults.schedule ?? null,
    summary: String(prior?.trigger?.summary ?? schema.triggerDefaults.summary ?? "").trim(),
  };
  if (!TRIGGER_MODES.some((m) => m.id === trigger.mode)) {
    trigger.mode = "manual_or_events";
  }

  const executes = {
    workTypes: asArray(prior?.executes?.workTypes ?? schema.executesDefaults.workTypes),
    summary: String(prior?.executes?.summary ?? schema.executesDefaults.summary ?? "").trim(),
  };

  const priorTemplate = prior?.messageTemplate && typeof prior.messageTemplate === "object"
    ? prior.messageTemplate
    : {};
  const messageTemplate = {
    emailSubject: String(priorTemplate.emailSubject ?? "").trim(),
    emailBody: String(priorTemplate.emailBody ?? "").trim(),
    smsBody: String(priorTemplate.smsBody ?? "").trim(),
    channels: asArray(priorTemplate.channels),
  };

  const rules = {
    customerFacingRequiresApproval: prior?.rules?.customerFacingRequiresApproval
      ?? employee.communicationPermissions?.customerFacingRequiresApproval
      ?? true,
    approvalRequirements: asArray(
      prior?.rules?.approvalRequirements
      ?? employee.approvalRequirements
      ?? ["human_approval"],
    ),
    prohibitedActions: asArray(
      prior?.rules?.prohibitedActions
      ?? employee.prohibitedActions
      ?? ["autonomous_customer_send"],
    ),
    connectionDependencies: asArray(
      prior?.rules?.connectionDependencies
      ?? employee.connectionDependencies
      ?? ["business_email"],
    ),
  };

  const seeded = seedScopeFromDiscovery(schema, discoverySummary);
  const priorAnswers = prior?.scope?.answers && typeof prior.scope.answers === "object"
    ? prior.scope.answers
    : {};
  const answers = {};
  for (const field of schema.scopeFields ?? []) {
    if (priorAnswers[field.key] != null) {
      answers[field.key] = normalizeAnswer(priorAnswers[field.key]);
    } else if (seeded[field.key]) {
      answers[field.key] = seeded[field.key];
    } else {
      answers[field.key] = normalizeAnswer("");
    }
  }

  const draft = {
    version: 1,
    schemaId: schema.schemaId,
    trigger,
    executes,
    rules,
    scope: { answers },
    messageTemplate,
    automationPath: normalizeAutomationPath(prior?.automationPath, {
      contract: { schemaId: schema.schemaId, scope: { answers }, trigger },
      schema,
    }),
    updatedAt: prior?.updatedAt ?? null,
    updatedBy: prior?.updatedBy ?? null,
  };

  if (nowISO) {
    draft.updatedAt = nowISO;
    draft.updatedBy = actorId ?? prior?.updatedBy ?? null;
  }

  const completeness = validateOperatingContractCompleteness(draft, schema);
  draft.scope.completeness = completeness;

  return deepFreeze({
    contract: draft,
    schema,
    completeness,
  });
}

/**
 * Merge owner PATCH into an existing contract; recompute completeness.
 */
export function applyOperatingContractPatch({
  employee = {},
  industry = null,
  patch = {},
  actorId = null,
  nowISO = null,
} = {}) {
  const built = buildOperatingContract({ employee, industry, existing: employee });
  const current = { ...built.contract };
  const schema = built.schema;

  if (patch.trigger && typeof patch.trigger === "object") {
    current.trigger = {
      ...current.trigger,
      ...patch.trigger,
      eventTypes: patch.trigger.eventTypes != null
        ? asArray(patch.trigger.eventTypes)
        : current.trigger.eventTypes,
    };
  }
  if (patch.executes && typeof patch.executes === "object") {
    current.executes = {
      ...current.executes,
      ...patch.executes,
      workTypes: patch.executes.workTypes != null
        ? asArray(patch.executes.workTypes)
        : current.executes.workTypes,
    };
  }
  if (patch.rules && typeof patch.rules === "object") {
    current.rules = {
      ...current.rules,
      ...patch.rules,
      approvalRequirements: patch.rules.approvalRequirements != null
        ? asArray(patch.rules.approvalRequirements)
        : current.rules.approvalRequirements,
      prohibitedActions: patch.rules.prohibitedActions != null
        ? asArray(patch.rules.prohibitedActions)
        : current.rules.prohibitedActions,
      connectionDependencies: patch.rules.connectionDependencies != null
        ? asArray(patch.rules.connectionDependencies)
        : current.rules.connectionDependencies,
      customerFacingRequiresApproval: patch.rules.customerFacingRequiresApproval != null
        ? Boolean(patch.rules.customerFacingRequiresApproval)
        : current.rules.customerFacingRequiresApproval,
    };
  }
  if (patch.scope?.answers && typeof patch.scope.answers === "object") {
    const nextAnswers = { ...current.scope.answers };
    for (const [key, value] of Object.entries(patch.scope.answers)) {
      nextAnswers[key] = normalizeAnswer(value);
    }
    current.scope = { ...current.scope, answers: nextAnswers };
  }
  if (patch.messageTemplate && typeof patch.messageTemplate === "object") {
    current.messageTemplate = {
      ...(current.messageTemplate ?? {}),
      emailSubject: patch.messageTemplate.emailSubject != null
        ? String(patch.messageTemplate.emailSubject).trim()
        : String(current.messageTemplate?.emailSubject ?? ""),
      emailBody: patch.messageTemplate.emailBody != null
        ? String(patch.messageTemplate.emailBody).trim()
        : String(current.messageTemplate?.emailBody ?? ""),
      smsBody: patch.messageTemplate.smsBody != null
        ? String(patch.messageTemplate.smsBody).trim()
        : String(current.messageTemplate?.smsBody ?? ""),
      channels: patch.messageTemplate.channels != null
        ? asArray(patch.messageTemplate.channels)
        : asArray(current.messageTemplate?.channels),
    };
  }
  if (patch.automationPath != null) {
    const normalized = normalizeAutomationPath(patch.automationPath, {
      contract: current,
      schema,
    });
    current.automationPath = deepFreeze({
      ...normalized,
      customized: true,
    });
  } else if (patch.scope?.answers && !current.automationPath?.customized) {
    // Refresh default path when scope changes and owner never customized the path.
    current.automationPath = buildDefaultAutomationPath({ contract: current, schema });
  }
  if (patch.trigger?.schedule !== undefined) {
    current.trigger = {
      ...current.trigger,
      schedule: patch.trigger.schedule,
    };
  }

  current.version = 1;
  current.schemaId = schema.schemaId;
  current.updatedAt = nowISO ?? new Date().toISOString();
  current.updatedBy = actorId ?? current.updatedBy ?? null;

  const completeness = validateOperatingContractCompleteness(current, schema);
  current.scope = { ...current.scope, completeness };

  return deepFreeze({
    contract: current,
    schema,
    completeness,
  });
}

/**
 * Owner-facing presentation helpers for specialty UI / automations.
 */
export function presentOperatingContract(contract = {}, schema = null, readinessSnapshot = null) {
  const resolved = schema ?? resolveOperatingContractSchema({});
  const completeness = contract?.scope?.completeness
    ?? validateOperatingContractCompleteness(contract, resolved);
  const scopeRows = (resolved.scopeFields ?? []).map((field) => {
    const answer = contract?.scope?.answers?.[field.key];
    const display = answerDisplay(answer);
    const missing = completeness.missingKeys?.includes(field.key);
    return {
      key: field.key,
      label: field.label,
      universalKey: field.universalKey,
      input: field.input,
      required: field.required !== false,
      placeholder: field.placeholder,
      help: field.help,
      answer: normalizeAnswer(answer),
      display: display || (missing ? "Answer required" : ""),
      missing: Boolean(missing),
    };
  });

  const triggerModeLabel = TRIGGER_MODES.find((m) => m.id === contract?.trigger?.mode)?.label
    ?? contract?.trigger?.mode
    ?? "Manual or events";

  return deepFreeze({
    schemaId: resolved.schemaId,
    trigger: {
      ...contract?.trigger,
      modeLabel: triggerModeLabel,
    },
    executes: contract?.executes ?? {},
    rules: contract?.rules ?? {},
    messageTemplate: contract?.messageTemplate ?? {
      emailSubject: "",
      emailBody: "",
      smsBody: "",
      channels: [],
    },
    automationPath: presentAutomationPath({
      contract,
      schema: resolved,
      readinessSnapshot,
    }),
    scopeRows,
    completeness,
    statusLabel: completeness.complete
      ? "Contract complete"
      : `Needs setup: ${completeness.missingKeys.map(humanizeKey).join(", ") || "scope answers"}`,
  });
}

function humanizeKey(key) {
  return String(key ?? "").replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
}

/**
 * Build a pack-default automation stub from the operating contract.
 */
export function buildAutomationStubFromContract({
  employee = {},
  contract = null,
} = {}) {
  const employeeId = String(employee.employeeId ?? employee.id ?? "").trim();
  if (!employeeId) return null;
  const label = String(employee.label ?? employee.name ?? employeeId);
  const c = contract ?? employee.operatingContract ?? {};
  const mode = String(c.trigger?.mode ?? "manual_or_events");
  const eventTypes = asArray(c.trigger?.eventTypes);
  const primaryEvent = eventTypes[0] || "SPECIALTY_JOB_REQUESTED";

  return deepFreeze({
    automationId: `auto_contract_${employeeId}`,
    name: `${label} — ${c.trigger?.summary || "specialty work"}`,
    status: employee?.activateOnInstall === true || employee?.packDefault === true
      ? "ACTIVE"
      : "INACTIVE",
    employeeId,
    trigger: {
      type: mode === "manual" ? "manual" : "event",
      eventType: primaryEvent,
      eventTypes,
      mode,
    },
    actions: [
      {
        id: `act_create_${employeeId}`,
        actionType: "CREATE_WORK",
        requiresApproval: false,
        order: 1,
        parameters: {
          workType: asArray(c.executes?.workTypes)[0] || "specialty_draft",
          assignedTo: employeeId,
          title: `${label} work`,
          metadata: {
            employeeId,
            fromOperatingContract: true,
            scope: c.scope?.answers ?? {},
          },
        },
      },
    ],
    metadata: {
      employeeId,
      fromOperatingContract: true,
      schemaId: c.schemaId ?? null,
      triggerSummary: c.trigger?.summary ?? "",
      executesSummary: c.executes?.summary ?? "",
    },
  });
}

/**
 * Ensure employee has operatingContract + at least one automation stub.
 */
export function ensureEmployeeOperatingContract(employee = {}, {
  industry = null,
  discoverySummary = null,
} = {}) {
  const { contract, schema, completeness } = buildOperatingContract({
    employee,
    industry,
    discoverySummary,
  });
  const automations = Array.isArray(employee.automationDefinitions)
    ? [...employee.automationDefinitions]
    : [];
  const hasLinked = automations.some((auto) =>
    String(auto?.employeeId ?? auto?.metadata?.employeeId ?? "") === String(employee.employeeId ?? employee.id)
    || String(auto?.automationId ?? "").includes(String(employee.employeeId ?? "")),
  );
  if (!hasLinked) {
    const stub = buildAutomationStubFromContract({ employee, contract });
    if (stub) automations.push(stub);
  }

  return deepFreeze({
    ...employee,
    operatingContract: contract,
    communicationPermissions: {
      ...(employee.communicationPermissions ?? {}),
      customerFacingRequiresApproval: contract.rules.customerFacingRequiresApproval,
    },
    approvalRequirements: contract.rules.approvalRequirements,
    prohibitedActions: contract.rules.prohibitedActions,
    connectionDependencies: contract.rules.connectionDependencies,
    automationDefinitions: automations,
    _operatingContractMeta: { schemaId: schema.schemaId, completeness },
  });
}
