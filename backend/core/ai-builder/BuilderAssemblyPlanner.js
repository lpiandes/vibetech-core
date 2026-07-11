import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BlueprintRecommendationEngine } from "./BlueprintRecommendationEngine.js";
import { ComponentRecommendationEngine } from "./ComponentRecommendationEngine.js";
import { EmployeeArchetypeRecommendationEngine } from "./EmployeeArchetypeRecommendationEngine.js";
import { CapabilityGapDetector } from "./CapabilityGapDetector.js";
import { createBuilderAssumption } from "./BuilderAssumption.js";

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

    const blueprints = this.blueprintEngine.recommend({ businessSummary, evidence });
    const components = this.componentEngine.recommend({ businessSummary });
    const employees = this.employeeEngine.recommend({ businessSummary });
    const gaps = this.gapDetector.detect({
      businessSummary,
      recommendations: [
        ...blueprints.recommendations,
        ...employees.recommendations,
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
    ];

    return deepFreeze({
      ok: true,
      selectedBlueprints: blueprints.recommendations.filter((entry) => entry.selected),
      selectedComponents: components.recommendations.filter((entry) => entry.selected),
      selectedEmployees: employees.recommendations.filter((entry) => entry.selected),
      capabilityGaps: [
        ...gaps.gaps,
        ...(employees.gaps ?? []).map((gap, index) => ({
          gapId: `emp_gap_${index}`,
          ...gap,
          status: "open",
          evidence: [],
        })),
      ],
      assumptions,
      explanation: {
        title: "What we recommend",
        summary: "We matched reusable blueprints and components to what you described. Gaps stay visible — nothing unsupported will pretend to work.",
      },
    });
  }
}
