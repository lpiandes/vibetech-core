import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  DISCOVERY_QUESTION_BANK,
  questionMatchesIndustry,
  resolveDiscoveryIndustry,
  resolvePackIndustry,
} from "./BusinessDiscoveryQuestionPlanner.js";
import { discoveryStageProgress } from "./BuilderUxPresentation.js";
import {
  isFullOsPurchasedScope,
  questionMatchesPackageAsk,
} from "../platform/packages/SalesPackageCatalog.js";

/** All universal + industry-pack required questions must be answered before propose. */
export const DISCOVERY_MIN_REQUIRED_ANSWERS = 17;
/** When LLM/free-text covers many fields, allow a slightly lower required count. */
export const DISCOVERY_MIN_REQUIRED_ANSWERS_LLM_COVERED = 12;
/** Thin SKU floors when purchased packages narrow the required set. */
export const DISCOVERY_MIN_REQUIRED_ANSWERS_THIN_SKU = 4;
export const DISCOVERY_MIN_REQUIRED_ANSWERS_THIN_SKU_LLM = 3;
/** Hard cap on substantive discovery answers shown to owners. */
export const DISCOVERY_MAX_OWNER_ANSWERS = 28;

/**
 * Completeness scoring — never pretends unknown answers are resolved.
 * Proposal readiness requires every required question for the selected industry
 * (further narrowed by purchased sales packages when present).
 */
export class BusinessDiscoveryCompleteness {
  evaluate({ answers = [], businessSummary = {} } = {}) {
    const packIndustry = resolvePackIndustry(resolveDiscoveryIndustry({ answers, businessSummary }));
    const activeOtherQuestionIds = null;
    const purchasedPackages = businessSummary?.purchasedPackages ?? [];
    const packageAsk = Boolean(businessSummary?.packageAsk);
    const packageAskPackages = businessSummary?.packageAskPackages ?? null;
    const fullOs = isFullOsPurchasedScope(purchasedPackages);
    const required = DISCOVERY_QUESTION_BANK.filter((question) => {
      return question.required
        && questionMatchesIndustry(question, packIndustry, activeOtherQuestionIds)
        && questionMatchesPackageAsk(question, purchasedPackages, { packageAsk, packageAskPackages });
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

    const hasIdentity = Boolean(
      businessSummary.businessName
      || answeredIds.has("q_company_name")
      || answeredIds.has("q_tell_us")
      || (businessSummary.description && String(businessSummary.description).trim()),
    );
    const hasIndustry = Boolean(
      businessSummary.industry
      || answeredIds.has("q_industry"),
    );

    const llmCovered = Boolean(
      businessSummary.goals
      || businessSummary.desiredOutcomes
      || (Array.isArray(businessSummary.painPoints) && businessSummary.painPoints.length)
      || answers.some((entry) => entry.evidenceSource === "free_text_extraction" || entry.evidenceSource === "llm"),
    );

    let minRequired;
    if (fullOs) {
      minRequired = llmCovered
        ? DISCOVERY_MIN_REQUIRED_ANSWERS_LLM_COVERED
        : DISCOVERY_MIN_REQUIRED_ANSWERS;
    } else if (packageAsk) {
      // Package-add Ask only needs its focus set — never the thin-SKU floor of 4.
      minRequired = Math.max(0, required.length);
    } else {
      const thinFloor = llmCovered
        ? DISCOVERY_MIN_REQUIRED_ANSWERS_THIN_SKU_LLM
        : DISCOVERY_MIN_REQUIRED_ANSWERS_THIN_SKU;
      minRequired = Math.min(required.length, Math.max(thinFloor, llmCovered
        ? Math.ceil(required.length * 0.6)
        : required.length));
    }

    // Pack-specific requireds (dental/sports) must be answered even when LLM covers universals.
    const packRequiredMissing = packIndustry === "dental" || packIndustry === "sports"
      ? requiredMissing.filter((question) => {
        const when = question.whenIndustry ?? [];
        return when.includes(packIndustry);
      })
      : [];

    const depthMet = fullOs
      ? (
        requiredMissing.length === 0
        || (llmCovered
          && requiredAnswered.length >= minRequired
          && packRequiredMissing.length === 0)
      )
      : packageAsk
        ? requiredMissing.length === 0
        : (llmCovered
          ? requiredAnswered.length >= minRequired
          : (requiredMissing.length === 0 && requiredAnswered.length >= Math.min(minRequired, required.length)));
    // Package-add Ask already runs in an installed business — don't block completion on
    // re-proving identity/industry (that left owners stuck re-answering the last question).
    const readyForProposal = packageAsk
      ? (depthMet && substantiveAnswered <= DISCOVERY_MAX_OWNER_ANSWERS)
      : (
        depthMet
        && hasIdentity
        && (fullOs ? hasIndustry : (hasIndustry || substantiveAnswered >= 2))
        && substantiveAnswered <= DISCOVERY_MAX_OWNER_ANSWERS
      );

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
      questions: required.length ? required : DISCOVERY_QUESTION_BANK,
      progress: base,
      businessSummary,
    });

    return deepFreeze({
      ...base,
      requiredTotal: required.length,
      requiredAnswered: requiredAnswered.length,
      requiredMissing: requiredMissing.map((question) => question.questionId),
      substantiveAnswered,
      minRequiredAnswers: minRequired,
      maxOwnerAnswers: DISCOVERY_MAX_OWNER_ANSWERS,
      unknownQuestionIds: unknownIds,
      skippedQuestionIds: skippedIds,
      unresolvedCount: requiredMissing.length + unknownIds.length,
      journey,
      activeStageLabel: journey.activeStageLabel,
      purchasedPackages,
      fullOsScope: fullOs,
    });
  }
}
