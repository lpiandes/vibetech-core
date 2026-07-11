import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { DISCOVERY_QUESTION_BANK } from "./BusinessDiscoveryQuestionPlanner.js";
import { discoveryStageProgress } from "./BuilderUxPresentation.js";

/**
 * Completeness scoring — never pretends unknown answers are resolved.
 */
export class BusinessDiscoveryCompleteness {
  evaluate({ answers = [], businessSummary = {} } = {}) {
    const required = DISCOVERY_QUESTION_BANK.filter((question) => question.required);
    const answeredIds = new Set(
      answers
        .filter((entry) => !entry.skipped && !entry.unknown && entry.answer != null && String(entry.answer).trim() !== "")
        .map((entry) => entry.questionId),
    );
    const unknownIds = answers.filter((entry) => entry.unknown).map((entry) => entry.questionId);
    const skippedIds = answers.filter((entry) => entry.skipped).map((entry) => entry.questionId);

    const requiredAnswered = required.filter((question) => answeredIds.has(question.questionId));
    const requiredMissing = required.filter((question) => !answeredIds.has(question.questionId));

    const hasIdentity = Boolean(businessSummary.businessName || businessSummary.description);
    const hasIndustry = Boolean(businessSummary.industry);
    const readyForProposal = requiredAnswered.length >= 5 && hasIdentity && hasIndustry;

    const percent = Math.round((requiredAnswered.length / Math.max(1, required.length)) * 100);
    const base = {
      percent,
      label: readyForProposal
        ? "Ready for a first proposal"
        : requiredMissing.length
          ? "A few important questions remain"
          : "Keep going",
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
      unknownQuestionIds: unknownIds,
      skippedQuestionIds: skippedIds,
      unresolvedCount: requiredMissing.length + unknownIds.length,
      journey,
      activeStageLabel: journey.activeStageLabel,
    });
  }
}
