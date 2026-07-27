import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BlueprintRecommendationEngine } from "./BlueprintRecommendationEngine.js";
import { ComponentRecommendationEngine } from "./ComponentRecommendationEngine.js";
import { EmployeeArchetypeRecommendationEngine } from "./EmployeeArchetypeRecommendationEngine.js";
import { CapabilityGapDetector } from "./CapabilityGapDetector.js";
import { createBuilderAssumption } from "./BuilderAssumption.js";
import {
  extractOwnerRequestedEmployees,
} from "./extractOwnerRequestedEmployees.js";
import { compileDesiredWorkflows } from "./compileDesiredWorkflows.js";
import {
  mergePackAndOwnerEmployeeRecommendations,
  packEmployeesForIndustry,
  resolveOperatingIndustry,
} from "./mapPackAiRolesToSelectedEmployees.js";
import {
  filterWorkflowsForPurchasedPackages,
  isFullOsPurchasedScope,
} from "../platform/packages/SalesPackageCatalog.js";

/**
 * Plans assembly from existing blueprints/components before any install.
 */
export class BuilderAssemblyPlanner {
  constructor({
    blueprintEngine = new BlueprintRecommendationEngine(),
    componentEngine = new ComponentRecommendationEngine(),
    employeeEngine = new EmployeeArchetypeRecommendationEngine(),
    gapDetector = new CapabilityGapDetector(),
  } = {}) {
    this.blueprintEngine = blueprintEngine;
    this.componentEngine = componentEngine;
    this.employeeEngine = employeeEngine;
    this.gapDetector = gapDetector;
  }

  plan({ session } = {}) {
    if (!session) throw new Error("BuilderAssemblyPlanner: session required.");
    const businessSummary = session.businessSummary ?? {};
    const evidence = session.evidence ?? [];
    const thinSku = !isFullOsPurchasedScope(businessSummary.purchasedPackages);
    const industry = resolveOperatingIndustry({
      industry: businessSummary.industry,
      businessName: businessSummary.businessName,
      allowNameHeuristics: !thinSku,
    }) ?? String(businessSummary.industry ?? "").toLowerCase().replace(/\s+/g, "_");

    const blueprints = this.blueprintEngine.recommend({ businessSummary, evidence });
    const components = this.componentEngine.recommend({ businessSummary });
    const ownerRequested = extractOwnerRequestedEmployees({
      answers: session.answers ?? [],
      conversation: session.conversation ?? [],
      businessSummary,
    });
    const desiredWorkflows = filterWorkflowsForPurchasedPackages(
      compileDesiredWorkflows({
        answers: session.answers ?? [],
        businessSummary,
      }),
      businessSummary.purchasedPackages ?? [],
    );
    const workflowEmployees = desiredWorkflows.map((workflow) => ({
      archetypeId: workflow.archetypeId,
      label: workflow.label,
      purpose: workflow.purpose,
      automationPath: workflow.automationPath,
      trigger: workflow.trigger,
      workflowText: workflow.workflowText,
    }));
    // Vertical packs install default AI workforce only for Full OS. Thin SKUs
    // keep owner-requested / workflow employees (filtered later at assemble).
    const packDefaults = thinSku ? [] : packEmployeesForIndustry(industry);
    const selectedEmployees = mergePackAndOwnerEmployeeRecommendations({
      industry: thinSku ? null : industry,
      ownerRequested: [...ownerRequested, ...workflowEmployees],
    });

    const gaps = this.gapDetector.detect({
      businessSummary,
      recommendations: [
        ...blueprints.recommendations,
        ...selectedEmployees,
      ],
    });

    const assumptions = [
      createBuilderAssumption({
        assumptionId: "assume_no_custom_code",
        text: "We will configure reusable VIBETech capabilities — not generate custom app code.",
        confidence: 0.99,
        source: "platform_policy",
      }),
      ...(blueprints.recommendations[0]?.assumptions ?? []).map((text, index) => createBuilderAssumption({
        assumptionId: `assume_bp_${index}`,
        text,
        confidence: 0.6,
        source: "blueprint",
      })),
      ...(packDefaults.length
        ? [createBuilderAssumption({
          assumptionId: "assume_pack_workforce",
          text: `This vertical installs a default AI team: ${packDefaults.map((entry) => entry.label).join(", ")}. You can edit or disable teammates after install.`,
          confidence: 0.95,
          source: "operating_pack",
        })]
        : []),
      ...(ownerRequested.length
        ? [createBuilderAssumption({
          assumptionId: "assume_owner_workforce",
          text: `Digital Workforce also includes what you asked for: ${ownerRequested.map((entry) => entry.label).join(", ")}.`,
          confidence: 0.9,
          source: "owner_request",
        })]
        : []),
      ...(desiredWorkflows.length
        ? [createBuilderAssumption({
          assumptionId: "assume_owner_workflows",
          text: `Automations from your processes: ${desiredWorkflows.map((entry) => entry.label).join(", ")}.`,
          confidence: 0.92,
          source: "owner_workflows",
        })]
        : []),
    ];

    const packLabels = packDefaults.map((entry) => entry.label);
    const ownerLabels = ownerRequested.map((entry) => entry.label);
    const workflowLabels = desiredWorkflows.map((entry) => entry.label);
    return deepFreeze({
      ok: true,
      selectedBlueprints: blueprints.recommendations.filter((entry) => entry.selected),
      selectedComponents: components.recommendations.filter((entry) => entry.selected),
      selectedEmployees,
      desiredWorkflows,
      capabilityGaps: [
        ...gaps.gaps,
      ],
      assumptions,
      explanation: {
        title: "What we recommend",
        summary: packLabels.length
          ? `We matched reusable blueprints and install the ${industry || "vertical"} AI team (${packLabels.join(", ")})${ownerLabels.length ? ` plus your extras (${ownerLabels.join(", ")})` : ""}${workflowLabels.length ? ` and process automations (${workflowLabels.join(", ")})` : ""}. Gaps stay visible — nothing unsupported will pretend to work.`
          : ownerLabels.length || workflowLabels.length
            ? `We matched reusable blueprints and put your requested digital teammates first (${[...ownerLabels, ...workflowLabels].join(", ")}). Gaps stay visible — nothing unsupported will pretend to work.`
            : "We matched reusable blueprints and components to what you described. Gaps stay visible — nothing unsupported will pretend to work.",
      },
    });
  }
}
