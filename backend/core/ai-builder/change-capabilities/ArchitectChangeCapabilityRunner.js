import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createBuilderChangeRequest } from "../BuilderChangeRequest.js";
import { buildVisualBusinessOSProposal } from "../VisualBusinessOSProposal.js";
import { createMutationOperation, createMutationPlan } from "./MutationPlan.js";
import { MutationPlanExecutor } from "./MutationPlanExecutor.js";
import { extractInformationFromText, buildMutationPlanFromTemplate } from "./buildMutationPlanFromTemplate.js";
import { getDefaultArchitectChangeCapabilityRegistry } from "./ArchitectChangeCapabilityRegistry.js";

/**
 * Orchestrates match → missing info → mutation plan → spec apply → impact.
 * Does not install; AiBuilderService remains the façade for dry-run/approve/install.
 */
export class ArchitectChangeCapabilityRunner {
  constructor({
    registry = null,
    executor = new MutationPlanExecutor(),
  } = {}) {
    this.registry = registry ?? getDefaultArchitectChangeCapabilityRegistry();
    this.executor = executor;
  }

  run({
    session,
    specification,
    text,
    priorValues = null,
    actorPermissions = ["business.manage"],
    selectCapabilityId = null,
    blueprintId = null,
    industryPackageId = null,
  } = {}) {
    const mergedPrior = {
      ...(session?.metadata?.pendingChange?.values ?? {}),
      ...(priorValues ?? {}),
    };

    let match;
    if (selectCapabilityId) {
      const capability = this.registry.get(selectCapabilityId);
      if (!capability) {
        return deepFreeze({
          ok: false,
          status: "unsupported",
          summary: String(text ?? ""),
          reason: "unknown_capability_selection",
          recommendation: "Choose a supported change.",
        });
      }
      match = {
        status: "matched",
        capabilityId: capability.capabilityId,
        legacyKind: capability.legacyKindAliases?.[0] ?? null,
        confidence: 1,
        evidence: ["user_selection"],
        capability,
        summary: String(text ?? ""),
      };
    } else {
      match = this.registry.match(text, { blueprintId, industryPackageId });
    }

    if (match.status === "ambiguous") {
      return deepFreeze({
        ok: false,
        status: "ambiguous",
        summary: match.summary,
        message: match.message,
        candidates: match.candidates,
        request: createBuilderChangeRequest({
          sessionId: session.sessionId,
          businessId: session.businessId,
          text,
          interpreted: {
            kind: "ambiguous",
            status: "ambiguous",
            candidates: match.candidates,
            confidence: 0.5,
          },
        }),
      });
    }

    if (match.status === "unsupported") {
      return deepFreeze({
        ok: false,
        status: "unsupported",
        summary: match.summary,
        reason: match.reason,
        recommendation: match.recommendation,
        gapHint: match.gapHint,
        candidates: match.candidates ?? [],
        request: createBuilderChangeRequest({
          sessionId: session.sessionId,
          businessId: session.businessId,
          text,
          interpreted: {
            kind: "generic_change",
            status: "unsupported",
            confidence: 0.2,
            text,
          },
        }),
      });
    }

    const capability = match.capability ?? this.registry.get(match.capabilityId);
    const extracted = capability.collectMissingInformation
      ? capability.collectMissingInformation({ text, priorValues: mergedPrior, capability })
      : extractInformationFromText({
        text,
        schema: capability.requiredInformationSchema,
        priorValues: mergedPrior,
      });

    if (extracted.missing?.length) {
      return deepFreeze({
        ok: false,
        status: "needs_information",
        capabilityId: capability.capabilityId,
        legacyKind: capability.legacyKindAliases?.[0] ?? null,
        summary: match.summary,
        missing: extracted.missing,
        values: extracted.values,
        questions: extracted.missing.map((field) => field.prompt),
        request: createBuilderChangeRequest({
          sessionId: session.sessionId,
          businessId: session.businessId,
          text,
          interpreted: {
            kind: capability.legacyKindAliases?.[0] ?? capability.capabilityId,
            capabilityId: capability.capabilityId,
            status: "needs_information",
            values: extracted.values,
            missing: extracted.missing,
            confidence: match.confidence,
          },
        }),
      });
    }

    const plan = buildMutationPlanFromTemplate({
      capability,
      values: extracted.values,
      text,
      businessId: session.businessId,
      createMutationPlan,
      createMutationOperation,
    });

    const applied = this.executor.applyToSpecification({
      specification,
      plan,
      actorPermissions,
      actorBusinessId: session.businessId,
    });

    if (!applied.ok) {
      return deepFreeze({
        ok: false,
        status: "failed",
        reason: applied.reason,
        message: applied.message ?? applied.reason,
        plan,
        request: createBuilderChangeRequest({
          sessionId: session.sessionId,
          businessId: session.businessId,
          text,
          interpreted: {
            kind: capability.legacyKindAliases?.[0] ?? capability.capabilityId,
            capabilityId: capability.capabilityId,
            status: "failed",
            confidence: match.confidence,
          },
        }),
      });
    }

    const warnings = evaluateWarnings(capability, {
      specification,
      nextSpecification: applied.nextSpecification,
      values: extracted.values,
      text,
    });

    const impact = {
      kind: capability.legacyKindAliases?.[0] ?? capability.capabilityId,
      capabilityId: capability.capabilityId,
      requestedChange: text,
      affectedAreas: capability.affectedCanonicalAreas,
      explanation: plan.summary
        ?? `This would apply ${capability.title}. Nothing is installed until you review launch readiness and approve.`,
      risk: capability.affectedCanonicalAreas.includes("permissions") ? "medium" : "low",
      warnings,
      specificationDiff: null,
      requiresDryRun: true,
      requiresApproval: true,
      mutationPlanId: plan.planId,
      mutationPlanHash: plan.contentHash,
    };

    const preview = buildVisualBusinessOSProposal({
      session,
      specification: applied.nextSpecification,
    });

    const interpreted = {
      kind: capability.legacyKindAliases?.[0] ?? capability.capabilityId,
      capabilityId: capability.capabilityId,
      status: "matched",
      confidence: match.confidence,
      evidence: match.evidence,
      values: extracted.values,
      text,
      // Preserve legacy fields used by older tests/callers
      ...extracted.values,
      from: extracted.values.from,
      to: extracted.values.to,
      label: extracted.values.label,
    };

    return deepFreeze({
      ok: true,
      status: "matched",
      capabilityId: capability.capabilityId,
      legacyKind: capability.legacyKindAliases?.[0] ?? null,
      request: createBuilderChangeRequest({
        sessionId: session.sessionId,
        businessId: session.businessId,
        text,
        interpreted,
      }),
      mutationPlan: plan,
      impact,
      warnings,
      preview,
      nextSpecification: applied.nextSpecification,
      sideEffects: applied.sideEffects,
      requiresDryRun: true,
      requiresApproval: true,
      previousHash: applied.previousHash,
    });
  }
}

function evaluateWarnings(capability, ctx) {
  const warnings = [];
  for (const rule of capability.warningRules ?? []) {
    if (rule.when === "always") warnings.push(rule.message);
  }
  if (typeof capability.evaluateWarnings === "function") {
    const extra = capability.evaluateWarnings(ctx) ?? [];
    for (const message of extra) warnings.push(String(message));
  }
  return deepFreeze(warnings);
}
