/**
 * RuntimePipeline
 *
 * Sprint 4 (Runtime MVP) component:
 * - Thin orchestration layer that runs the existing runtime steps in order:
 *   SituationEvaluator -> DecisionResolver -> ActionPlanner
 * - Does NOT duplicate business logic.
 * - Does NOT introduce AI, providers, or execution.
 */

import { SituationEvaluator } from "./SituationEvaluator.js";
import { DecisionResolver } from "./DecisionResolver.js";
import { ActionPlanner } from "./ActionPlanner.js";

export class RuntimePipeline {
  /**
   * @param {object} params
   * @param {SituationEvaluator} [params.situationEvaluator]
   * @param {DecisionResolver} [params.decisionResolver]
   * @param {ActionPlanner} [params.actionPlanner]
   */
  constructor({
    situationEvaluator = new SituationEvaluator(),
    decisionResolver = new DecisionResolver(),
    actionPlanner = new ActionPlanner(),
  } = {}) {
    this.situationEvaluator = situationEvaluator;
    this.decisionResolver = decisionResolver;
    this.actionPlanner = actionPlanner;
  }

  /**
   * @param {any} input - runtime classification inputs for SituationEvaluator
   * @returns {Promise<{
   *   situation: string,
   *   decision: string,
   *   action: string,
   *   nextStep: string,
   *   requiresApproval: boolean,
   *   reason: string
   * }>}
   */
  async run(input) {
    const situationResult = this.situationEvaluator.evaluate(input);
    const decisionResult = this.decisionResolver.resolve(situationResult);
    const planResult = this.actionPlanner.plan(decisionResult);

    return {
      situation: situationResult.situation,
      decision: decisionResult.decision,
      action: planResult.action,
      nextStep: planResult.nextStep,
      requiresApproval: planResult.requiresApproval,
      reason: planResult.reason,
    };
  }
}

