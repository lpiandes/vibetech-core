import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { MUTATION_OPERATION_TYPES } from "./MutationOperationTypes.js";

function fail(message) {
  throw new Error(`ArchitectChangeCapabilityDefinition: ${message}`);
}

const REQUIRED_KEYS = [
  "capabilityId",
  "version",
  "title",
  "description",
  "requestPatterns",
  "requiredPermissions",
  "requiredInformationSchema",
  "mutationPlanTemplate",
  "affectedCanonicalAreas",
  "approvalPolicy",
  "auditEventTypes",
];

/**
 * Declarative Architect change capability — data-first; custom hooks are exceptional.
 */
export function createArchitectChangeCapabilityDefinition(input = {}) {
  for (const key of REQUIRED_KEYS) {
    if (input[key] == null) fail(`${key} required.`);
  }
  if (!Array.isArray(input.requestPatterns) || input.requestPatterns.length === 0) {
    fail("requestPatterns must be a non-empty array.");
  }
  if (!Array.isArray(input.requiredPermissions) || input.requiredPermissions.length === 0) {
    fail("requiredPermissions required.");
  }
  if (!input.mutationPlanTemplate?.operations?.length && typeof input.buildMutationPlan !== "function") {
    fail("mutationPlanTemplate.operations or buildMutationPlan required.");
  }

  const templateOps = input.mutationPlanTemplate?.operations ?? [];
  for (const op of templateOps) {
    if (!MUTATION_OPERATION_TYPES.includes(String(op.operationType))) {
      fail(`mutationPlanTemplate uses unknown operationType: ${op.operationType}`);
    }
    if (op.allowsExternalCommunication === true && op.operationType !== "inviteMembership") {
      fail("only inviteMembership may set allowsExternalCommunication.");
    }
  }

  const approvalPolicy = {
    requiresDryRun: true,
    requiresHumanApproval: true,
    bindsContentHash: true,
    ...input.approvalPolicy,
  };
  if (!approvalPolicy.requiresDryRun || !approvalPolicy.requiresHumanApproval) {
    fail("approvalPolicy must require dry-run and human approval for OS mutations.");
  }

  return deepFreeze({
    capabilityId: String(input.capabilityId),
    version: String(input.version),
    title: String(input.title),
    description: String(input.description),
    requestPatterns: deepFreeze(input.requestPatterns.map((pattern) => deepFreeze({
      id: String(pattern.id ?? "default"),
      examples: deepFreeze((pattern.examples ?? []).map(String)),
      keywords: deepFreeze((pattern.keywords ?? []).map((k) => String(k).toLowerCase())),
      excludeKeywords: deepFreeze((pattern.excludeKeywords ?? []).map((k) => String(k).toLowerCase())),
      allKeywords: deepFreeze((pattern.allKeywords ?? []).map((k) => String(k).toLowerCase())),
      weight: Number(pattern.weight ?? 1),
    }))),
    matchPriority: Number(input.matchPriority ?? 100),
    requiredPermissions: deepFreeze(input.requiredPermissions.map(String)),
    requiredInformationSchema: deepFreeze({
      fields: deepFreeze((input.requiredInformationSchema.fields ?? []).map((field) => deepFreeze({
        id: String(field.id),
        label: String(field.label ?? field.id),
        required: field.required !== false,
        prompt: field.prompt ? String(field.prompt) : `What is the ${field.label ?? field.id}?`,
        extractFromText: field.extractFromText
          ? deepFreeze({
            regex: field.extractFromText.regex ? String(field.extractFromText.regex) : null,
            group: Number(field.extractFromText.group ?? 1),
            fallback: field.extractFromText.fallback ?? null,
            fromKeywords: deepFreeze((field.extractFromText.fromKeywords ?? []).map(String)),
          })
          : null,
      }))),
    }),
    proposalSchema: deepFreeze(input.proposalSchema ?? { type: "object" }),
    packageAvailability: deepFreeze({
      defaultEnabled: input.packageAvailability?.defaultEnabled !== false,
      blueprintIds: deepFreeze((input.packageAvailability?.blueprintIds ?? []).map(String)),
      industryPackageIds: deepFreeze((input.packageAvailability?.industryPackageIds ?? []).map(String)),
      prohibitedIf: deepFreeze((input.packageAvailability?.prohibitedIf ?? []).map(String)),
    }),
    mutationPlanTemplate: deepFreeze({
      summaryTemplate: input.mutationPlanTemplate.summaryTemplate
        ? String(input.mutationPlanTemplate.summaryTemplate)
        : null,
      operations: deepFreeze(templateOps.map((op) => deepFreeze({ ...op }))),
    }),
    // Optional complex hook — discouraged; packages should prefer templates.
    buildMutationPlan: typeof input.buildMutationPlan === "function" ? input.buildMutationPlan : null,
    collectMissingInformation: typeof input.collectMissingInformation === "function"
      ? input.collectMissingInformation
      : null,
    evaluateWarnings: typeof input.evaluateWarnings === "function" ? input.evaluateWarnings : null,
    affectedCanonicalAreas: deepFreeze(input.affectedCanonicalAreas.map(String)),
    approvalPolicy: deepFreeze(approvalPolicy),
    warningRules: deepFreeze((input.warningRules ?? []).map((rule) => deepFreeze({
      id: String(rule.id ?? "warning"),
      when: rule.when ? String(rule.when) : "always",
      message: String(rule.message),
    }))),
    auditEventTypes: deepFreeze({
      interpreted: String(input.auditEventTypes.interpreted ?? "architect.change_interpreted"),
      needsInformation: String(input.auditEventTypes.needsInformation ?? "architect.change_needs_information"),
      ambiguous: String(input.auditEventTypes.ambiguous ?? "architect.change_ambiguous"),
      unsupported: String(input.auditEventTypes.unsupported ?? "architect.change_unsupported"),
      proposed: String(input.auditEventTypes.proposed ?? "architect.change_proposed"),
      rejected: String(input.auditEventTypes.rejected ?? "architect.change_rejected"),
      approved: String(input.auditEventTypes.approved ?? "architect.change_approved"),
      executionStarted: String(input.auditEventTypes.executionStarted ?? "architect.change_execution_started"),
      executed: String(input.auditEventTypes.executed ?? "architect.change_executed"),
      failed: String(input.auditEventTypes.failed ?? "architect.change_failed"),
    }),
    uiPresentation: deepFreeze({
      category: String(input.uiPresentation?.category ?? "change"),
      iconKey: input.uiPresentation?.iconKey ? String(input.uiPresentation.iconKey) : null,
      summaryTemplate: String(input.uiPresentation?.summaryTemplate ?? input.title),
      confirmationHints: deepFreeze((input.uiPresentation?.confirmationHints ?? []).map(String)),
    }),
    legacyKindAliases: deepFreeze((input.legacyKindAliases ?? []).map(String)),
    failureBehavior: deepFreeze({
      idempotencyKeyFields: deepFreeze((input.failureBehavior?.idempotencyKeyFields ?? ["capabilityId", "text"]).map(String)),
      onFailure: String(input.failureBehavior?.onFailure ?? "leave_proposal"),
      allowsExternalCommunication: false,
    }),
  });
}

export function assertValidArchitectChangeCapabilityDefinition(definition) {
  return createArchitectChangeCapabilityDefinition(definition);
}
