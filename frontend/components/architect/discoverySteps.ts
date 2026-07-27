import { DISCOVERY_QUESTION_BANK } from "../../../backend/core/ai-builder/BusinessDiscoveryQuestionPlanner.js";

export type DiscoveryAnswerRow = {
  questionId?: string;
  answer?: string | null;
  skipped?: boolean;
  unknown?: boolean;
};

export type DiscoveryQuestionRow = {
  questionId?: string;
  prompt?: string;
  text?: string;
  why?: string;
  answerType?: string;
  options?: string[];
  optionLabels?: Record<string, string>;
};

export type DiscoveryStep = {
  questionId: string;
  prompt: string;
  why: string;
  answer: string;
  isCurrent: boolean;
  answerType?: string;
  options?: string[];
  optionLabels?: Record<string, string>;
};

const META_BY_ID = Object.fromEntries(
  DISCOVERY_QUESTION_BANK.map((question: {
    questionId: string;
    prompt: string;
    why?: string;
    answerType?: string;
    options?: string[];
  }) => [
    question.questionId,
    {
      prompt: question.prompt,
      why: question.why ?? "",
      answerType: question.answerType,
      options: question.options ?? [],
    },
  ]),
);

export function buildDiscoverySteps(
  answers: DiscoveryAnswerRow[] = [],
  nextQuestion: DiscoveryQuestionRow | null = null,
): DiscoveryStep[] {
  const steps: DiscoveryStep[] = answers.map((entry) => {
    const questionId = String(entry.questionId ?? "");
    const meta = META_BY_ID[questionId];
    return {
      questionId,
      prompt: meta?.prompt ?? questionId,
      why: meta?.why ?? "",
      answer: entry.skipped || entry.unknown ? "" : String(entry.answer ?? ""),
      isCurrent: false,
      answerType: meta?.answerType,
      options: meta?.options,
    };
  });

  if (nextQuestion?.questionId) {
    const questionId = String(nextQuestion.questionId);
    const meta = META_BY_ID[questionId];
    steps.push({
      questionId,
      prompt: String(nextQuestion.prompt ?? nextQuestion.text ?? meta?.prompt ?? questionId),
      why: String(nextQuestion.why ?? meta?.why ?? ""),
      answer: "",
      isCurrent: true,
      answerType: nextQuestion.answerType ?? meta?.answerType,
      options: nextQuestion.options ?? meta?.options,
      optionLabels: nextQuestion.optionLabels,
    });
  }

  return steps;
}
