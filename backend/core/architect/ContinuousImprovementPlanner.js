import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createArchitectStageResult } from "./ArchitectStageResult.js";
import { BuilderSpecificationChangePlanner } from "../ai-builder/BuilderSpecificationChangePlanner.js";
import { DeterministicBuilderIntelligenceProvider } from "../ai-builder/BuilderIntelligenceProvider.js";

/**
 * Continuous improvement — modify only affected parts of the Business OS.
 * Never regenerate everything from scratch.
 */
export class ContinuousImprovementPlanner {
  constructor({
    changePlanner = new BuilderSpecificationChangePlanner(),
    intelligence = new DeterministicBuilderIntelligenceProvider(),
  } = {}) {
    this.changePlanner = changePlanner;
    this.intelligence = intelligence;
  }

  async plan({
    prompt,
    installedSpecification,
    dna = null,
  } = {}) {
    if (!installedSpecification) {
      return createArchitectStageResult({
        stageId: "continuous_improvement_planning",
        ok: false,
        confidence: "unknown",
        unresolvedQuestions: [{
          questionId: "installed_required",
          prompt: "Install a Business OS before requesting improvements.",
        }],
        explanation: "Improvement requires an installed baseline.",
      });
    }

    const interpreted = await this.intelligence.interpretChangeRequest({ text: prompt });
    const affected = inferAffectedAreas(interpreted.kind, prompt);
    const planned = this.changePlanner.apply({
      specification: installedSpecification,
      change: { ...interpreted, text: prompt },
    });

    return createArchitectStageResult({
      stageId: "continuous_improvement_planning",
      inputs: {
        prompt,
        baselineSpecificationId: installedSpecification.specificationId,
        baselineVersion: installedSpecification.version ?? installedSpecification.specificationVersion,
        dnaId: dna?.dnaId ?? null,
      },
      outputs: {
        changeKind: interpreted.kind,
        affectedAreas: affected,
        previousHash: planned.previousHash,
        nextSpecification: planned.nextSpecification,
        requiresDryRun: true,
        requiresApproval: true,
        regenerateEverything: false,
      },
      confidence: interpreted.confidence ?? "medium",
      recommendations: [{
        kind: "incremental",
        label: `Only update: ${affected.join(", ")}`,
        why: "Business evolution should patch the installed OS — not rebuild from zero.",
      }, {
        kind: "governance",
        label: "Preview → Dry run → Approve → Install",
        why: "No silent mutation of permissions or modules.",
      }],
      explanation: consultantAdvice(interpreted.kind, prompt),
    });
  }
}

function inferAffectedAreas(kind, prompt = "") {
  const text = `${kind} ${prompt}`.toLowerCase();
  const areas = new Set();
  if (/rename|terminology|patient|customer|label/.test(text)) areas.add("terminology");
  if (/module|workspace|scheduling|inventory|scout|billing/.test(text)) areas.add("modules");
  if (/employee|workforce|marketing|coach/.test(text)) areas.add("digital_workforce");
  if (/role|manager|permission|access|billing/.test(text)) areas.add("roles_access");
  if (/workflow|intake|approval|refund/.test(text)) areas.add("workflows");
  if (/newsletter|campaign/.test(text)) areas.add("campaigns");
  if (/office|location|department|hire|payroll|rental/.test(text)) areas.add("business_dna");
  if (/report|dashboard|kpi/.test(text)) areas.add("dashboards");
  if (/integration|payroll|software/.test(text)) areas.add("integrations");
  if (!areas.size) areas.add("specification");
  return [...areas];
}

function consultantAdvice(kind, prompt) {
  if (/payroll/i.test(prompt)) {
    return "Payroll is usually a platform gap or prohibited autonomous domain — recommend setup/deferral rather than inventing payroll execution.";
  }
  if (/another office|new location/i.test(prompt)) {
    return "Another office usually extends locations, roles, and reporting — not a brand-new Business OS.";
  }
  if (/rental/i.test(prompt)) {
    return "New offerings should extend services/modules from reusable components when possible.";
  }
  return `Incremental change (${String(kind).replace(/_/g, " ")}) against the installed specification. Challenge unnecessary complexity and keep reuse first.`;
}

export { deepFreeze };
