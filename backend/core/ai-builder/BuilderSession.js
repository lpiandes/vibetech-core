import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { randomUUID } from "node:crypto";

export const BUILDER_SESSION_STAGES = Object.freeze([
  "created",
  "discovering",
  "researching",
  "interviewing",
  "assembling",
  "proposal_ready",
  "awaiting_review",
  "dry_run_ready",
  "awaiting_approval",
  "installing",
  "installed",
  "blocked",
  "failed",
  "archived",
]);

export const BUILDER_SESSION_MODES = Object.freeze([
  "new_business",
  "configure_existing_business",
  "expand_existing_business",
  "fix_business_problem",
  "internal_vibetech_build",
  "client_self_service",
]);

function fail(message) {
  throw new Error(`BuilderSession: ${message}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function freezeObject(value, fallback = {}) {
  return deepFreeze(value && typeof value === "object" && !Array.isArray(value) ? { ...value } : { ...fallback });
}

function freezeArray(value) {
  return deepFreeze(asArray(value).map((entry) => (
    entry && typeof entry === "object" ? deepFreeze({ ...entry }) : entry
  )));
}

/**
 * Durable AI Builder session — declarative discovery/assembly state.
 */
export function createBuilderSession({
  sessionId = `abs_${randomUUID().slice(0, 12)}`,
  businessId = null,
  actorId = null,
  mode = "client_self_service",
  currentStage = "created",
  businessSummary = {},
  websiteUrls = [],
  uploadedArtifactIds = [],
  questions = [],
  answers = [],
  evidence = [],
  assumptions = [],
  unresolvedQuestions = [],
  recommendations = [],
  selectedBlueprints = [],
  selectedComponents = [],
  capabilityGaps = [],
  conversation = [],
  specificationId = null,
  specificationContentHash = null,
  installationPlanId = null,
  installationPlanHash = null,
  progress = {},
  appearance = {},
  metadata = {},
  createdAt = new Date().toISOString(),
  updatedAt = null,
} = {}) {
  if (!BUILDER_SESSION_MODES.includes(String(mode))) fail(`unsupported mode: ${mode}`);
  if (!BUILDER_SESSION_STAGES.includes(String(currentStage))) fail(`unsupported stage: ${currentStage}`);

  return deepFreeze({
    sessionId: String(sessionId),
    businessId: businessId == null ? null : String(businessId),
    actorId: actorId == null ? null : String(actorId),
    mode: String(mode),
    currentStage: String(currentStage),
    businessSummary: freezeObject(businessSummary),
    websiteUrls: freezeArray(websiteUrls),
    uploadedArtifactIds: freezeArray(uploadedArtifactIds),
    questions: freezeArray(questions),
    answers: freezeArray(answers),
    evidence: freezeArray(evidence),
    assumptions: freezeArray(assumptions),
    unresolvedQuestions: freezeArray(unresolvedQuestions),
    recommendations: freezeArray(recommendations),
    selectedBlueprints: freezeArray(selectedBlueprints),
    selectedComponents: freezeArray(selectedComponents),
    capabilityGaps: freezeArray(capabilityGaps),
    conversation: freezeArray(conversation),
    specificationId: specificationId == null ? null : String(specificationId),
    specificationContentHash: specificationContentHash == null ? null : String(specificationContentHash),
    installationPlanId: installationPlanId == null ? null : String(installationPlanId),
    installationPlanHash: installationPlanHash == null ? null : String(installationPlanHash),
    progress: freezeObject(progress, {
      percent: 0,
      label: "Getting started",
      readyForProposal: false,
    }),
    appearance: freezeObject(appearance, {
      accentColor: "#0F766E",
      logo: null,
      businessName: null,
      dashboardDensity: "comfortable",
    }),
    metadata: freezeObject(metadata),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt ?? createdAt),
  });
}

export function withBuilderSessionPatch(session, patch = {}, { updatedAt = new Date().toISOString() } = {}) {
  return createBuilderSession({
    ...session,
    ...patch,
    updatedAt,
  });
}
