import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createBuilderAssumption({
  assumptionId,
  text,
  confidence = 0.5,
  source = "default",
  reversible = true,
  accepted = null,
} = {}) {
  if (!assumptionId) throw new Error("BuilderAssumption: assumptionId required.");
  return deepFreeze({
    assumptionId: String(assumptionId),
    text: String(text),
    confidence: Number(confidence),
    source: String(source),
    reversible: reversible !== false,
    accepted: accepted == null ? null : Boolean(accepted),
  });
}
