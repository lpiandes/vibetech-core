import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { DISCOVERY_QUESTION_BANK, detectOtherIndustrySignal, questionMatchesIndustry, resolveDiscoveryIndustry, resolvePackIndustry, OTHER_INDUSTRY_SIGNAL_QUESTIONS } from "./BusinessDiscoveryQuestionPlanner.js";
import { discoveryStageProgress } from "./BuilderUxPresentation.js";

/** All universal + industry-pack required questions must be answered before propose. */
export const DISCOVERY_MIN_REQUIRED_ANSWERS = 16;
/** Hard cap on substantive discovery answers shown to owners. */
export const DISCOVERY_MAX_OWNER_ANSWERS = 28;

/**
 * Completeness scoring — never pretends unknown answers are resolved.
 * Proposal readiness requires every required question for the selected industry.
 */
export class BusinessDiscoveryCompleteness {
  evaluate({ answers = [], businessSummary = {} } = {}) {
    const industry = resolveDiscoveryIndustry({ answers, businessSummary });
    const packIndustry = resolvePackIndustry(industry);
    const otherSignal = packIndustry === "other"
      ? detectOtherIndustrySignal({ answers, businessSummary })
      : null;
    const activeOtherQuestionIds = packIndustry === "other"
      ? new Set(OTHER_INDUSTRY_SIGNAL_QUESTIONS[otherSignal] ?? OTHER_INDUSTRY_SIGNAL_QUESTIONS.default)
      : null;
    const required = DISCOVERY_QUESTION_BANK.filter((question) => {
      if (!question.required) return false;
      return questionMatchesIndustry(question, packIndustry, activeOtherQuestionIds);
    });
    const answeredIds = new Set(
      answers
        .filter((entry) => !entry.skipped && !entry.unknown && entry.answer != null && String(entry.answer).trim() !== "")
        .map((entry) => entry.questionId),
    );
    const unknownIds = answers.filter((entry) => entry.unknown).map((entry) => entry.questionId);
    const skippedIds = answers.filter((entry) => entry.skipped).map((entry) => entry.questionId);

    const requiredAnswered = required.filter((question) => answeredIds.has(question.questionId));
    const requiredMissing = required.filter((question) => !answeredIds.has(question.questionId));
    const substantiveAnswered = answers.filter((entry) => (
      !entry.skipped
      && !entry.unknown
      && entry.answer != null
      && String(entry.answer).trim() !== ""
    )).length;

    const hasIdentity = Boolean(businessSummary.businessName || businessSummary.description);
    const hasIndustry = Boolean(businessSummary.industry);
    const depthMet = requiredMissing.length === 0 && requiredAnswered.length >= DISCOVERY_MIN_REQUIRED_ANSWERS;
    const readyForProposal = depthMet
      && hasIdentity
      && hasIndustry
      && substantiveAnswered <= DISCOVERY_MAX_OWNER_ANSWERS;

    const percent = Math.min(
      100,
      Math.round((requiredAnswered.length / Math.max(1, required.length)) * 100),
    );
    const base = {
      percent,
      label: readyForProposal
        ? "Ready for a first proposal"
        : requiredMissing.length
          ? "A few important questions remain"
          : "Keep going — we need a clearer picture",
      readyForProposal,
    };
    const journey = discoveryStageProgress({
      answers,
      questions: DISCOVERY_QUESTION_BANK,
      progress: base,
      businessSummary,
    });

    return deepFreeze({
      ...base,
      requiredTotal: required.length,
      requiredAnswered: requiredAnswered.length,
      requiredMissing: requiredMissing.map((question) => question.questionId),
      substantiveAnswered,
      minRequiredAnswers: DISCOVERY_MIN_REQUIRED_ANSWERS,
      maxOwnerAnswers: DISCOVERY_MAX_OWNER_ANSWERS,
      unknownQuestionIds: unknownIds,
      skippedQuestionIds: skippedIds,
      unresolvedCount: requiredMissing.length + unknownIds.length,
      journey,
      activeStageLabel: journey.activeStageLabel,
    });
  }
}
