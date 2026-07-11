import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderGap } from "./BuilderGap.js";
import { getDefaultBusinessOSCapabilityRegistry } from "../business-os/BusinessOSCapabilityRegistry.js";

/**
 * Honest capability gap detection — never pretends unsupported needs work.
 */
export class CapabilityGapDetector {
  constructor({ capabilityRegistry = getDefaultBusinessOSCapabilityRegistry() } = {}) {
    this.capabilityRegistry = capabilityRegistry;
  }

  detect({ businessSummary = {}, recommendations = [] } = {}) {
    const gaps = [];
    const needs = [
      ...(businessSummary.integrationNeeds ?? []).map((item) => ({ id: String(item).toLowerCase(), label: item })),
      ...(recommendations.flatMap((entry) => entry.missingCapabilities ?? []).map((id) => ({ id, label: id }))),
    ];

    // Common honest deferrals
    const deferredHints = ["sms", "payroll", "accounting", "insurance_billing", "treatment_plan_runtime"];
    for (const hint of deferredHints) {
      const blob = JSON.stringify(businessSummary).toLowerCase();
      if (blob.includes(hint) || needs.some((entry) => entry.id.includes(hint))) {
        gaps.push(createBuilderGap({
          gapId: `gap_${hint}`,
          kind: hint.includes("payroll") || hint.includes("accounting") ? "prohibited" : "deferred",
          label: hint.replace(/_/g, " "),
          requestedOutcome: `Support ${hint.replace(/_/g, " ")}`,
        }));
      }
    }

    for (const need of needs) {
      const classified = this.capabilityRegistry.classifyRequirement?.({ capabilityId: need.id })
        ?? this.capabilityRegistry.resolve?.(need.id);
      if (!classified) {
        gaps.push(createBuilderGap({
          gapId: `gap_unknown_${need.id}`.slice(0, 80),
          kind: "reusable_component_needed",
          label: need.label,
          requestedOutcome: need.label,
        }));
        continue;
      }
      if (classified.prohibited || classified.availability === "prohibited") {
        gaps.push(createBuilderGap({
          gapId: `gap_prohibited_${need.id}`,
          kind: "prohibited",
          label: need.label,
          requestedOutcome: need.label,
        }));
      } else if (classified.deferred || classified.availability === "deferred") {
        gaps.push(createBuilderGap({
          gapId: `gap_deferred_${need.id}`,
          kind: "deferred",
          label: need.label,
          requestedOutcome: need.label,
        }));
      } else if (classified.proposalRequired || classified.availability === "missing_reusable_capability") {
        gaps.push(createBuilderGap({
          gapId: `gap_needed_${need.id}`,
          kind: "reusable_component_needed",
          label: need.label,
          requestedOutcome: need.label,
        }));
      } else if (classified.availability === "missing_setup" || classified.availability === "supported_with_configuration") {
        gaps.push(createBuilderGap({
          gapId: `gap_setup_${need.id}`,
          kind: "provider_integration_needed",
          label: need.label,
          requestedOutcome: need.label,
        }));
      } else if (classified.availability === "supported") {
        gaps.push(createBuilderGap({
          gapId: `gap_ok_${need.id}`,
          kind: "configurable_with_existing_component",
          label: need.label,
          requestedOutcome: need.label,
          status: "covered",
        }));
      }
    }

    // Deduplicate by gapId
    const byId = new Map(gaps.map((gap) => [gap.gapId, gap]));
    return deepFreeze({ ok: true, gaps: [...byId.values()] });
  }
}
