import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BusinessDiscoveryQuestionPlanner } from "./BusinessDiscoveryQuestionPlanner.js";
import { BusinessDiscoveryAnswerInterpreter } from "./BusinessDiscoveryAnswerInterpreter.js";
import { BusinessDiscoveryCompleteness } from "./BusinessDiscoveryCompleteness.js";
import { buildBusinessDiscoverySummary } from "./BusinessDiscoverySummary.js";
import { createBuilderAnswer } from "./BuilderQuestion.js";
import { createBuilderAssumption } from "./BuilderAssumption.js";
import { createBuilderConversationMessage, appendConversation } from "./BuilderConversation.js";

/**
 * Adaptive discovery engine. Works without a paid AI API.
 */
export class BusinessDiscoveryEngine {
  constructor({
    planner = new BusinessDiscoveryQuestionPlanner(),
    interpreter = new BusinessDiscoveryAnswerInterpreter(),
    completeness = new BusinessDiscoveryCompleteness(),
    intelligence = null,
  } = {}) {
    this.planner = planner;
    this.interpreter = interpreter;
    this.completeness = completeness;
    this.intelligence = intelligence;
  }

  initialPrompt() {
    return deepFreeze({
      text: "Tell us about your business.",
      why: "A short description is enough to start. We will ask only what still matters.",
    });
  }

  nextQuestions(session, { limit = 3 } = {}) {
    return this.planner.plan({
      answers: session.answers,
      evidence: session.evidence,
      limit,
    });
  }

  async applyAnswer(session, {
    questionId,
    answer,
    skipped = false,
    unknown = false,
    nowISO = new Date().toISOString(),
  }) {
    let interpreted = this.interpreter.interpret({ questionId, answer, skipped, unknown });
    if (this.intelligence?.refineAnswer) {
      interpreted = await this.intelligence.refineAnswer({
        questionId,
        answer,
        interpreted,
        session,
      }) ?? interpreted;
    }

    const record = createBuilderAnswer({
      questionId,
      answer: skipped ? null : answer,
      skipped,
      unknown: unknown || interpreted.unknown,
      confidence: unknown || skipped ? 0 : 0.85,
      answeredAt: nowISO,
    });

    const answers = [
      ...session.answers.filter((entry) => entry.questionId !== questionId),
      record,
    ];
    const businessSummary = {
      ...session.businessSummary,
      ...interpreted.fields,
    };

    const assumptions = [...session.assumptions];
    if (interpreted.unknown) {
      assumptions.push(createBuilderAssumption({
        assumptionId: `assume_unknown_${questionId}`,
        text: `Left unresolved: ${questionId}`,
        confidence: 0.2,
        source: "unknown_answer",
      }));
    }

    const unresolvedQuestions = [
      ...session.unresolvedQuestions.filter((id) => id !== questionId),
      ...interpreted.unresolved,
    ];

    const progress = this.completeness.evaluate({ answers, businessSummary });
    const summary = buildBusinessDiscoverySummary({
      businessSummary,
      completeness: progress,
      assumptions,
    });

    const conversation = appendConversation(session.conversation, createBuilderConversationMessage({
      messageId: `msg_user_${questionId}_${Date.parse(nowISO)}`,
      role: "user",
      text: skipped ? "(skipped)" : unknown ? "I don't know" : String(answer),
      at: nowISO,
      relatedQuestionId: questionId,
    }));

    return deepFreeze({
      answers,
      businessSummary,
      assumptions,
      unresolvedQuestions,
      progress,
      summary,
      conversation,
      nextQuestions: this.planner.plan({ answers, evidence: session.evidence, limit: 3 }),
    });
  }
}
