import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";
import { ContinuousBusinessBuilderService } from "../../ai-builder/ContinuousBusinessBuilderService.js";
import { getDefaultBusinessIntelligenceDefinitionRegistry } from "../definitions/BusinessIntelligenceDefinitionRegistry.js";

/**
 * Convert an Intelligence Candidate into an Architect change proposal session.
 * Propose only — never installs.
 */
export class IntelligenceToArchitectChangeService {
  constructor({
    continuousBuilder = new ContinuousBusinessBuilderService(),
    registry = getDefaultBusinessIntelligenceDefinitionRegistry(),
  } = {}) {
    this.continuousBuilder = continuousBuilder;
    this.registry = registry;
  }

  async execute({
    stack,
    candidateId,
    businessId,
    actorUserId = null,
    installedSpecification,
    nowISO = new Date().toISOString(),
    platformStore = null,
  } = {}) {
    if (!stack?.intelligenceCandidateRuntime) {
      return {
        ok: false,
        reason: "runtime_unavailable",
        message: "Intelligence candidate runtime is not available.",
        installed: false,
      };
    }
    const runtime = stack.intelligenceCandidateRuntime;
    const candidate = runtime.getCandidate(candidateId);
    if (!candidate) {
      return {
        ok: false,
        reason: "candidate_not_found",
        message: "Intelligence candidate is no longer available.",
        installed: false,
      };
    }

    const changeAction = (candidate.recommendedActions ?? []).find((action) => (
      action.kind === "create_architect_change_proposal"
      || action.actionId === "propose_change"
    ));
    const capabilityId = changeAction?.architectCapabilityId ?? null;
    const recommendation = this.registry.getRecommendation(candidate.definitionId);

    const evidenceLines = (candidate.evidence ?? []).map((entry) => (
      `- ${entry.objectType}:${entry.objectId} — ${entry.explanation}`
    ));
    const missing = (candidate.missingEvidence ?? []).map((entry) => `- Missing: ${entry}`);
    const prompt = [
      `Intelligence candidate: ${candidate.title}`,
      candidate.explanation,
      "",
      "Evidence:",
      ...evidenceLines,
      ...(missing.length ? ["", "Missing evidence:", ...missing] : []),
      "",
      capabilityId
        ? `Propose a governed change using capability ${capabilityId}. Do not install.`
        : "Propose a governed operating-system change. Do not install.",
      recommendation?.description ? `Recommendation: ${recommendation.description}` : null,
    ].filter(Boolean).join("\n");

    const started = await this.continuousBuilder.startImprovement({
      businessId: businessId ?? candidate.businessId,
      actorId: actorUserId,
      installedSpecification,
      prompt,
      intelligenceCandidateId: candidate.id,
      extraMetadata: {
        intelligenceCandidateId: candidate.id,
        definitionId: candidate.definitionId,
        architectCapabilityId: capabilityId,
        evidenceRefs: (candidate.evidence ?? []).map((entry) => ({
          objectType: entry.objectType,
          objectId: entry.objectId,
        })),
        candidateSnapshot: {
          id: candidate.id,
          title: candidate.title,
          summary: candidate.summary,
          explanation: candidate.explanation,
          confidenceReason: candidate.confidenceReason,
          severity: candidate.severity,
          status: candidate.status,
          evidence: candidate.evidence,
          missingEvidence: candidate.missingEvidence,
          ownerRef: candidate.ownerRef,
          recommendedActions: candidate.recommendedActions,
          dismissalReason: candidate.dismissalReason,
          convertedWorkId: candidate.convertedWorkId,
          relatedObjectRefs: candidate.relatedObjectRefs,
        },
        proposeOnly: true,
        neverInstallAutomatically: true,
      },
    });

    if (!started.ok) {
      return {
        ...started,
        installed: false,
        snapshotKinds: [],
      };
    }

    const sessionId = started.session?.sessionId ?? null;
    const updated = runtime.transition(candidate.id, {
      status: "CONVERTED_TO_CHANGE_PROPOSAL",
      architectSessionId: sessionId,
    }, { nowISO });

    void platformStore?.recordAuditEvent?.({
      actorUserId,
      businessId: candidate.businessId,
      action: "intelligence.candidate_converted_to_change_proposal",
      targetType: "intelligence_candidate",
      targetId: candidate.id,
      metadata: { architectSessionId: sessionId, capabilityId, installed: false },
    })?.catch?.(() => null);

    return deepFreeze({
      ok: true,
      installed: false,
      proposed: true,
      session: started.session,
      openHref: started.openHref,
      candidate: updated,
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
      message: "Architect change proposal seeded. Approval and install remain separate human steps.",
    });
  }
}
