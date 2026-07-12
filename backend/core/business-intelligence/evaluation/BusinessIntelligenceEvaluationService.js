import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getDefaultBusinessIntelligenceDefinitionRegistry } from "../definitions/BusinessIntelligenceDefinitionRegistry.js";
import { registerDefaultBusinessIntelligenceDefinitions } from "../registerDefaultBusinessIntelligenceDefinitions.js";
import { isOpenIntelligenceCandidate } from "../candidates/IntelligenceCandidate.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../persistence/RuntimeSnapshotKinds.js";
import { registerPropertyManagementIntelligenceDefinitions } from "../../../../industries/property-management/config/propertyManagementIntelligenceDefinitions.js";

/**
 * Runs observation → insight → recommendation → candidate upsert.
 * Does not create Work. Idempotent via deduplicationKey.
 */
export class BusinessIntelligenceEvaluationService {
  constructor({
    registry = null,
  } = {}) {
    this.registry = registry ?? getDefaultBusinessIntelligenceDefinitionRegistry();
    registerDefaultBusinessIntelligenceDefinitions({ registry: this.registry });
  }

  ensurePackageDefinitions(industryPackageId) {
    if (String(industryPackageId ?? "") === "pkg_property_management") {
      registerPropertyManagementIntelligenceDefinitions(this.registry);
    }
  }

  async evaluate({
    stack,
    businessId,
    nowISO = new Date().toISOString(),
    industryPackageId = null,
    thresholdsByDefinition = {},
    platformStore = null,
    actorUserId = null,
  } = {}) {
    if (!stack) throw new Error("BusinessIntelligenceEvaluationService: stack required.");
    if (!businessId) throw new Error("BusinessIntelligenceEvaluationService: businessId required.");
    if (!stack.intelligenceCandidateRuntime) {
      throw new Error("BusinessIntelligenceEvaluationService: intelligenceCandidateRuntime required.");
    }

    this.ensurePackageDefinitions(industryPackageId);

    const runtime = stack.intelligenceCandidateRuntime;
    const observations = [];
    const insights = [];
    const recommendations = [];
    const candidates = [];

    for (const observationDef of this.registry.listObservations({ industryPackageId })) {
      const evaluator = this.registry.getEvaluator(observationDef.evaluatorId);
      if (!evaluator) continue;
      const thresholds = {
        ...observationDef.thresholds,
        ...(thresholdsByDefinition[observationDef.definitionId] ?? {}),
      };
      let produced = [];
      try {
        produced = evaluator({
          stack,
          businessId,
          nowISO,
          thresholds,
          definition: observationDef,
        }) ?? [];
      } catch (err) {
        await this.audit(platformStore, {
          actorUserId,
          businessId,
          action: "intelligence.evaluation_failed",
          targetId: observationDef.definitionId,
          metadata: { message: err instanceof Error ? err.message : String(err) },
        });
        continue;
      }

      for (const obs of produced) {
        if (!obs.evidence?.length) continue;
        const observation = deepFreeze({
          observationId: `${observationDef.definitionId}:${obs.subjectKey}`,
          definitionId: observationDef.definitionId,
          ...obs,
        });
        observations.push(observation);
        await this.audit(platformStore, {
          actorUserId,
          businessId,
          action: "intelligence.observation_detected",
          targetId: observation.observationId,
          metadata: { definitionId: observationDef.definitionId },
        });

        const insightDef = this.registry.listInsights({ industryPackageId }).find((entry) => (
          entry.requiredObservationDefinitionIds.includes(observationDef.definitionId)
        ));
        if (!insightDef) continue;

        const insight = deepFreeze({
          insightId: `${insightDef.definitionId}:${obs.subjectKey}`,
          definitionId: insightDef.definitionId,
          title: insightDef.title,
          summary: obs.summary,
          explanation: String(insightDef.explanationTemplate)
            .replace(/\{\{summary\}\}/g, obs.summary)
            .replace(/\{\{explanation\}\}/g, obs.explanation),
          severity: obs.severity ?? insightDef.severity,
          confidence: obs.confidence,
          confidenceReason: obs.confidenceReason,
          evidence: obs.evidence,
          missingEvidence: obs.missingEvidence ?? [],
          observationIds: [observation.observationId],
        });
        insights.push(insight);
        await this.audit(platformStore, {
          actorUserId,
          businessId,
          action: "intelligence.insight_detected",
          targetId: insight.insightId,
          metadata: { definitionId: insightDef.definitionId },
        });

        const recommendationDef = this.registry.listRecommendations({ industryPackageId }).find((entry) => (
          entry.sourceInsightDefinitionIds.includes(insightDef.definitionId)
        ));
        if (!recommendationDef) continue;

        const recommendation = deepFreeze({
          recommendationId: `${recommendationDef.definitionId}:${obs.subjectKey}`,
          definitionId: recommendationDef.definitionId,
          title: recommendationDef.title,
          summary: `Recommended response: ${recommendationDef.description}`,
          explanation: insight.explanation,
          recommendedActions: recommendationDef.recommendedActions,
        });
        recommendations.push(recommendation);

        const existing = runtime.findByDeduplicationKey(
          `${recommendationDef.definitionId}:${obs.subjectKey}`,
        );
        if (existing?.status === "DISMISSED") {
          continue;
        }

        const reopen = existing?.status === "RESOLVED";
        const candidate = runtime.upsertCandidate({
          businessId,
          definitionId: recommendationDef.definitionId,
          observationIds: [observation.observationId],
          insightId: insight.insightId,
          recommendationId: recommendation.recommendationId,
          status: existing && isOpenIntelligenceCandidate(existing) ? existing.status : "DETECTED",
          title: observation.title,
          summary: observation.summary,
          explanation: insight.explanation,
          severity: insight.severity,
          confidence: insight.confidence,
          confidenceReason: insight.confidenceReason,
          evidence: observation.evidence,
          missingEvidence: observation.missingEvidence ?? [],
          recommendedActions: recommendation.recommendedActions,
          ownerRef: observation.ownerRef ?? null,
          relatedObjectRefs: observation.relatedObjectRefs ?? [],
          deduplicationKey: `${recommendationDef.definitionId}:${obs.subjectKey}`,
          source: observationDef._source ?? "business_intelligence",
          packageMetadata: {
            observationDefinitionId: observationDef.definitionId,
            insightDefinitionId: insightDef.definitionId,
            industryPackageId,
          },
          reopen,
        }, { nowISO });

        if (!existing) {
          await this.audit(platformStore, {
            actorUserId,
            businessId,
            action: "intelligence.candidate_detected",
            targetId: candidate.id,
            metadata: { definitionId: recommendationDef.definitionId, severity: candidate.severity },
          });
        } else {
          await this.audit(platformStore, {
            actorUserId,
            businessId,
            action: "intelligence.candidate_updated",
            targetId: candidate.id,
            metadata: { version: candidate.version },
          });
        }

        if (candidate.status === "DETECTED") {
          const surfaced = runtime.transition(candidate.id, {
            status: "SURFACED",
            surfacedAt: nowISO,
          }, { nowISO });
          await this.audit(platformStore, {
            actorUserId,
            businessId,
            action: "intelligence.candidate_surfaced",
            targetId: surfaced?.id ?? candidate.id,
            metadata: {},
          });
          candidates.push(surfaced ?? candidate);
        } else {
          candidates.push(candidate);
        }
      }
    }

    const activeKeys = new Set(candidates.map((entry) => entry.deduplicationKey));
    for (const open of runtime.getOpenCandidates()) {
      if (activeKeys.has(open.deduplicationKey)) continue;
      const resolved = runtime.transition(open.id, {
        status: "RESOLVED",
        resolvedAt: nowISO,
      }, { nowISO });
      if (resolved) {
        await this.audit(platformStore, {
          actorUserId,
          businessId,
          action: "intelligence.candidate_resolved",
          targetId: resolved.id,
          metadata: { reason: "condition_cleared" },
        });
      }
    }

    return deepFreeze({
      ok: true,
      businessId,
      generatedAt: nowISO,
      observations,
      insights,
      recommendations,
      candidates: runtime.getOpenCandidates(),
      snapshotKinds: [RUNTIME_SNAPSHOT_KINDS.INTELLIGENCE_CANDIDATE],
    });
  }

  async audit(platformStore, event) {
    if (!platformStore?.recordAuditEvent) return null;
    return platformStore.recordAuditEvent({
      actorUserId: event.actorUserId,
      businessId: event.businessId,
      action: event.action,
      targetType: "intelligence_candidate",
      targetId: event.targetId,
      metadata: event.metadata ?? {},
    }).catch(() => null);
  }
}
