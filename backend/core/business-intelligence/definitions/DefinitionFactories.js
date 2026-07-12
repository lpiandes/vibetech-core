import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`BusinessIntelligenceDefinition: ${message}`);
}

const BASE_REQUIRED = [
  "definitionId",
  "version",
  "title",
  "description",
  "category",
];

export function createObservationDefinition(input = {}) {
  for (const key of BASE_REQUIRED) {
    if (input[key] == null) fail(`${key} required.`);
  }
  return deepFreeze({
    kind: "observation",
    definitionId: String(input.definitionId),
    version: String(input.version),
    title: String(input.title),
    description: String(input.description),
    category: String(input.category),
    availability: deepFreeze({
      defaultEnabled: input.availability?.defaultEnabled !== false,
      blueprintIds: deepFreeze((input.availability?.blueprintIds ?? []).map(String)),
      industryPackageIds: deepFreeze((input.availability?.industryPackageIds ?? []).map(String)),
      requiredCapabilities: deepFreeze((input.availability?.requiredCapabilities ?? []).map(String)),
      requiredData: deepFreeze((input.availability?.requiredData ?? []).map(String)),
    }),
    requiredPermission: String(input.requiredPermission ?? "business.manage"),
    evidenceSelectors: deepFreeze(input.evidenceSelectors ?? []),
    evaluatorId: String(input.evaluatorId ?? input.definitionId),
    identityFields: deepFreeze((input.identityFields ?? ["subjectKey"]).map(String)),
    thresholds: deepFreeze(input.thresholds ?? {}),
    recheckTriggers: deepFreeze((input.recheckTriggers ?? ["evaluation"]).map(String)),
    packagePresentation: deepFreeze(input.packagePresentation ?? {}),
  });
}

export function createInsightDefinition(input = {}) {
  for (const key of BASE_REQUIRED) {
    if (input[key] == null) fail(`${key} required.`);
  }
  if (!input.requiredObservationDefinitionIds?.length) {
    fail("requiredObservationDefinitionIds required.");
  }
  return deepFreeze({
    kind: "insight",
    definitionId: String(input.definitionId),
    version: String(input.version),
    title: String(input.title),
    description: String(input.description),
    category: String(input.category),
    requiredObservationDefinitionIds: deepFreeze(input.requiredObservationDefinitionIds.map(String)),
    severity: String(input.severity ?? "medium"),
    explanationTemplate: String(input.explanationTemplate ?? input.description),
    availability: deepFreeze({
      defaultEnabled: input.availability?.defaultEnabled !== false,
      industryPackageIds: deepFreeze((input.availability?.industryPackageIds ?? []).map(String)),
    }),
    resolutionRuleId: input.resolutionRuleId ? String(input.resolutionRuleId) : null,
    packagePresentation: deepFreeze(input.packagePresentation ?? {}),
  });
}

export function createRecommendationDefinition(input = {}) {
  for (const key of BASE_REQUIRED) {
    if (input[key] == null) fail(`${key} required.`);
  }
  if (!input.sourceInsightDefinitionIds?.length) {
    fail("sourceInsightDefinitionIds required.");
  }
  if (!input.recommendedActions?.length) {
    fail("recommendedActions required.");
  }
  return deepFreeze({
    kind: "recommendation",
    definitionId: String(input.definitionId),
    version: String(input.version),
    title: String(input.title),
    description: String(input.description),
    category: String(input.category),
    sourceInsightDefinitionIds: deepFreeze(input.sourceInsightDefinitionIds.map(String)),
    recommendedActions: deepFreeze(input.recommendedActions.map((action) => deepFreeze({
      actionId: String(action.actionId ?? action.kind),
      kind: String(action.kind),
      label: String(action.label ?? action.kind),
      workTemplate: action.workTemplate ?? null,
      architectCapabilityId: action.architectCapabilityId ?? null,
      requiresApproval: action.requiresApproval !== false,
    }))),
    approvedConversions: deepFreeze((input.approvedConversions ?? [
      "create_work",
      "create_architect_change_proposal",
      "open_record",
      "request_more_information",
      "dismiss",
    ]).map(String)),
    deduplication: deepFreeze({
      identityFields: deepFreeze((input.deduplication?.identityFields ?? ["subjectKey"]).map(String)),
      suppressUntilStateChanges: input.deduplication?.suppressUntilStateChanges !== false,
      cooldownHours: Number(input.deduplication?.cooldownHours ?? 24),
    }),
    availability: deepFreeze({
      defaultEnabled: input.availability?.defaultEnabled !== false,
      industryPackageIds: deepFreeze((input.availability?.industryPackageIds ?? []).map(String)),
    }),
    packagePresentation: deepFreeze(input.packagePresentation ?? {}),
  });
}
