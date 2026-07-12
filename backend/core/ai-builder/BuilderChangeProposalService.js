import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderChangeRequest } from "./BuilderChangeRequest.js";
import { BuilderChangeInterpreter } from "./BuilderChangeInterpreter.js";
import { BuilderChangeImpactAnalyzer } from "./BuilderChangeImpactAnalyzer.js";
import { BuilderSpecificationChangePlanner } from "./BuilderSpecificationChangePlanner.js";
import { buildVisualBusinessOSProposal } from "./VisualBusinessOSProposal.js";
import { ArchitectChangeCapabilityRunner } from "./change-capabilities/ArchitectChangeCapabilityRunner.js";
import {
  getDefaultArchitectChangeCapabilityRegistry,
} from "./change-capabilities/ArchitectChangeCapabilityRegistry.js";
import { registerDefaultArchitectChangeCapabilities } from "./change-capabilities/registerDefaultArchitectChangeCapabilities.js";

/**
 * Conversational change proposals — registry-driven, never silent mutation.
 */
export class BuilderChangeProposalService {
  constructor({
    interpreter = new BuilderChangeInterpreter(),
    impactAnalyzer = new BuilderChangeImpactAnalyzer(),
    changePlanner = new BuilderSpecificationChangePlanner(),
    runner = null,
    registry = null,
  } = {}) {
    this.interpreter = interpreter;
    this.impactAnalyzer = impactAnalyzer;
    this.changePlanner = changePlanner;
    const reg = registry ?? getDefaultArchitectChangeCapabilityRegistry();
    registerDefaultArchitectChangeCapabilities({ registry: reg });
    this.runner = runner ?? new ArchitectChangeCapabilityRunner({ registry: reg });
  }

  async propose({
    session,
    specification,
    text,
    priorValues = null,
    actorPermissions = ["business.manage"],
    selectCapabilityId = null,
  }) {
    const result = this.runner.run({
      session,
      specification,
      text,
      priorValues,
      actorPermissions,
      selectCapabilityId,
    });

    if (result.status === "needs_information" || result.status === "ambiguous" || result.status === "unsupported") {
      return deepFreeze({
        ok: false,
        ...result,
        requiresDryRun: false,
        requiresApproval: false,
      });
    }

    if (!result.ok) {
      return deepFreeze({
        ok: false,
        status: result.status ?? "failed",
        reason: result.reason,
        message: result.message,
        request: result.request,
      });
    }

    const impact = this.impactAnalyzer.analyze({
      previousSpecification: specification,
      nextSpecification: result.nextSpecification,
      change: {
        ...result.request.interpreted,
        text,
        kind: result.legacyKind ?? result.request.interpreted?.kind,
      },
    });

    return deepFreeze({
      ok: true,
      status: "matched",
      capabilityId: result.capabilityId,
      request: result.request,
      mutationPlan: result.mutationPlan,
      impact: {
        ...impact,
        capabilityId: result.capabilityId,
        warnings: result.warnings,
        explanation: result.impact?.explanation ?? impact.explanation,
        mutationPlanId: result.mutationPlan?.planId,
        mutationPlanHash: result.mutationPlan?.contentHash,
      },
      warnings: result.warnings,
      preview: result.preview ?? buildVisualBusinessOSProposal({
        session,
        specification: result.nextSpecification,
      }),
      nextSpecification: result.nextSpecification,
      sideEffects: result.sideEffects ?? [],
      requiresDryRun: true,
      requiresApproval: true,
    });
  }

  /**
   * Compatibility: interpret-only without applying.
   */
  async interpretOnly(text) {
    return this.interpreter.interpret(text);
  }
}
