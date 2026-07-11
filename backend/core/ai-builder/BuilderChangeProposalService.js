import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderChangeRequest } from "./BuilderChangeRequest.js";
import { BuilderChangeInterpreter } from "./BuilderChangeInterpreter.js";
import { BuilderChangeImpactAnalyzer } from "./BuilderChangeImpactAnalyzer.js";
import { BuilderSpecificationChangePlanner } from "./BuilderSpecificationChangePlanner.js";
import { buildVisualBusinessOSProposal } from "./VisualBusinessOSProposal.js";

/**
 * Conversational change proposals — never silent mutation.
 */
export class BuilderChangeProposalService {
  constructor({
    interpreter = new BuilderChangeInterpreter(),
    impactAnalyzer = new BuilderChangeImpactAnalyzer(),
    changePlanner = new BuilderSpecificationChangePlanner(),
  } = {}) {
    this.interpreter = interpreter;
    this.impactAnalyzer = impactAnalyzer;
    this.changePlanner = changePlanner;
  }

  async propose({ session, specification, text }) {
    const interpreted = await this.interpreter.interpret(text);
    const request = createBuilderChangeRequest({
      sessionId: session.sessionId,
      businessId: session.businessId,
      text,
      interpreted,
    });
    const planned = this.changePlanner.apply({
      specification,
      change: { ...interpreted, text },
    });
    const impact = this.impactAnalyzer.analyze({
      previousSpecification: specification,
      nextSpecification: planned.nextSpecification,
      change: { ...interpreted, text },
    });
    const preview = buildVisualBusinessOSProposal({
      session,
      specification: planned.nextSpecification,
    });

    return deepFreeze({
      ok: true,
      request,
      impact,
      preview,
      nextSpecification: planned.nextSpecification,
      requiresDryRun: true,
      requiresApproval: true,
    });
  }
}
