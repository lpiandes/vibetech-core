import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const BUILDER_GAP_KINDS = Object.freeze([
  "configurable_with_existing_component",
  "reusable_component_needed",
  "provider_integration_needed",
  "industry_blueprint_extension",
  "unsupported",
  "prohibited",
  "deferred",
]);

export function createBuilderGap({
  gapId,
  kind,
  label,
  requestedOutcome = "",
  evidence = [],
  status = "open",
} = {}) {
  if (!gapId) throw new Error("BuilderGap: gapId required.");
  if (!BUILDER_GAP_KINDS.includes(String(kind))) {
    throw new Error(`BuilderGap: unsupported kind: ${kind}`);
  }
  return deepFreeze({
    gapId: String(gapId),
    kind: String(kind),
    label: String(label),
    requestedOutcome: String(requestedOutcome),
    evidence: deepFreeze(Array.isArray(evidence) ? evidence : []),
    status: String(status),
  });
}
