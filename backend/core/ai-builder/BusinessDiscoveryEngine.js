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
      text: "Describe your business and what you want or need from VIBETech.",
      why: "Start with the big picture — what you do and what success looks like. We’ll ask specialized follow-ups from there.",
    });
  }

  nextQuestions(session, { limit = 3 } = {}) {
    return this.planner.plan({
      answers: session.answers,
      evidence: session.evidence,
      businessSummary: session.businessSummary,
      limit,
    });
  }

  /**
   * Package-Ask / interview: prefer LLM-rewritten prompts from the scoped bank.
   */
  async nextQuestionsAsync(session, { limit = 3 } = {}) {
    return this.#resolveNextQuestions(session, {
      answers: session.answers,
      businessSummary: session.businessSummary,
      limit,
    });
  }

  /**
   * Prefer LLM-specialized follow-ups (bank IDs only); fall back to deterministic planner.
   */
  async #resolveNextQuestions(sessionLike, { answers, businessSummary, limit = 3 } = {}) {
    const planned = this.planner.plan({
      answers,
      evidence: sessionLike?.evidence ?? [],
      businessSummary,
      limit: Math.max(limit, 8),
    });
    // Package-Ask must stay deterministic — LLM rewrites reintroduce the full bank prompt.
    if (businessSummary?.packageAsk || !this.intelligence?.proposeNextDiscoveryQuestions || planned.length === 0) {
      return planned.slice(0, limit);
    }
    try {
      const proposed = await this.intelligence.proposeNextDiscoveryQuestions({
        session: { ...sessionLike, answers, businessSummary },
        remainingBank: planned,
        answered: answers,
        limit,
      });
      if (Array.isArray(proposed) && proposed.length > 0) {
        return proposed.slice(0, limit);
      }
    } catch {
      /* deterministic fallback */
    }
    return planned.slice(0, limit);
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

    // Once discovery has enough evidence, do not queue another question behind
    // the recommendation transition. This prevents a question from flashing
    // briefly while the client moves to assembly.
    const nextQuestions = progress.readyForProposal
      ? []
      : await this.#resolveNextQuestions(session, {
        answers,
        businessSummary,
        limit: 3,
      });

    return deepFreeze({
      answers,
      businessSummary,
      assumptions,
      unresolvedQuestions,
      progress,
      summary,
      conversation,
      nextQuestions,
    });
  }

  /**
   * Free-form consultant turn: extract signals, mark inferred questions answered,
   * keep only non-inferable questions in the backlog.
   */
  async applyFreeText(session, { text, nowISO = new Date().toISOString() } = {}) {
    let extracted = this.interpreter.extractFromFreeText(text);
    if (this.intelligence?.extractFromFreeText) {
      try {
        const llmExtract = await this.intelligence.extractFromFreeText({ text, session });
        if (llmExtract?.fields && typeof llmExtract.fields === "object") {
          extracted = {
            ...extracted,
            fields: { ...extracted.fields, ...llmExtract.fields },
            answeredQuestionIds: Array.from(new Set([
              ...(extracted.answeredQuestionIds ?? []),
              ...(Array.isArray(llmExtract.answeredQuestionIds) ? llmExtract.answeredQuestionIds : []),
            ])),
            note: llmExtract.note ?? extracted.note,
            source: "llm+deterministic",
          };
        }
      } catch {
        /* keep deterministic extraction */
      }
    }
    const businessSummary = {
      ...session.businessSummary,
      ...extracted.fields,
    };

    const answers = [...session.answers];
    for (const questionId of extracted.answeredQuestionIds) {
      const record = createBuilderAnswer({
        questionId,
        answer: extracted.fields.businessName
          && questionId === "q_company_name"
          ? extracted.fields.businessName
          : text,
        skipped: false,
        unknown: false,
        confidence: 0.7,
        answeredAt: nowISO,
        evidenceSource: "free_text_extraction",
      });
      const idx = answers.findIndex((entry) => entry.questionId === questionId);
      if (idx >= 0) answers[idx] = record;
      else answers.push(record);
    }

    const progress = this.completeness.evaluate({ answers, businessSummary });
    const summary = buildBusinessDiscoverySummary({
      businessSummary,
      completeness: progress,
      assumptions: session.assumptions,
    });

    let conversation = appendConversation(session.conversation, createBuilderConversationMessage({
      messageId: `msg_user_free_${Date.parse(nowISO)}`,
      role: "user",
      text: String(text),
      at: nowISO,
    }));
    const nextQuestions = progress.readyForProposal
      ? []
      : await this.#resolveNextQuestions(session, {
        answers,
        businessSummary,
        limit: 3,
      });
    conversation = appendConversation(conversation, createBuilderConversationMessage({
      messageId: `msg_assistant_free_${Date.parse(nowISO)}`,
      role: "assistant",
      text: nextQuestions[0]?.prompt
        ?? "I have enough to recommend how your business should run when you’re ready.",
      at: nowISO,
      relatedQuestionId: nextQuestions[0]?.questionId ?? null,
      metadata: nextQuestions[0] ? { why: nextQuestions[0].why } : {},
    }));

    return deepFreeze({
      answers,
      businessSummary,
      assumptions: session.assumptions,
      unresolvedQuestions: session.unresolvedQuestions,
      progress,
      summary,
      conversation,
      nextQuestions,
      extracted,
    });
  }
}
