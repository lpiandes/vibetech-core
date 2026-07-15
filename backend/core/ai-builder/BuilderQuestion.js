import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createBuilderQuestion({
  questionId,
  prompt,
  why = "",
  required = false,
  optional = true,
  topic = "general",
  allowSkip = true,
  allowUnknown = true,
  answerType = "text",
  options = [],
  whenIndustry = null,
} = {}) {
  if (!questionId) throw new Error("BuilderQuestion: questionId required.");
  return deepFreeze({
    questionId: String(questionId),
    prompt: String(prompt),
    why: String(why ?? ""),
    required: Boolean(required),
    optional: optional !== false,
    topic: String(topic),
    allowSkip: allowSkip !== false,
    allowUnknown: allowUnknown !== false,
    answerType: String(answerType),
    options: deepFreeze(Array.isArray(options) ? options : []),
    whenIndustry: whenIndustry == null
      ? null
      : deepFreeze((Array.isArray(whenIndustry) ? whenIndustry : [whenIndustry]).map(String)),
  });
}

export function createBuilderAnswer({
  questionId,
  answer,
  confidence = 0.7,
  skipped = false,
  unknown = false,
  evidenceSource = "conversation",
  answeredAt = new Date().toISOString(),
} = {}) {
  return deepFreeze({
    questionId: String(questionId),
    answer,
    confidence: Number(confidence),
    skipped: Boolean(skipped),
    unknown: Boolean(unknown),
    evidenceSource: String(evidenceSource),
    answeredAt: String(answeredAt),
  });
}
