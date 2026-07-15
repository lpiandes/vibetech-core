import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BlueprintRecommendationEngine } from "./BlueprintRecommendationEngine.js";
import { ComponentRecommendationEngine } from "./ComponentRecommendationEngine.js";
import { EmployeeArchetypeRecommendationEngine } from "./EmployeeArchetypeRecommendationEngine.js";
import { CapabilityGapDetector } from "./CapabilityGapDetector.js";
import { createBuilderAssumption } from "./BuilderAssumption.js";
import {
  extractOwnerRequestedEmployees,
  toSelectedEmployeeRecommendations,
} from "./extractOwnerRequestedEmployees.js";

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
    const ownerRequested = extractOwnerRequestedEmployees({
      answers: session.answers ?? [],
      conversation: session.conversation ?? [],
      businessSummary,
    });
    const ownerEmployeeRecs = toSelectedEmployeeRecommendations(ownerRequested);

    const ownerArchetypes = new Set(ownerRequested.map((entry) => entry.archetypeId));
    const templateEmployees = employees.recommendations
      .filter((entry) => entry.selected)
      .filter((entry) => {
        const archetype = String(
          (entry.evidence ?? []).find((item) => String(item).startsWith("archetype:"))
          ?? entry.payload?.employee?.archetypeId
          ?? entry.payload?.archetype?.archetypeId
          ?? "",
        ).replace("archetype:", "");
        return archetype && !ownerArchetypes.has(archetype);
      });
    const selectedEmployees = ownerEmployeeRecs.length
      ? [...ownerEmployeeRecs, ...templateEmployees].slice(0, 8)
      : employees.recommendations.filter((entry) => entry.selected);

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
      ...(ownerRequested.length
        ? [createBuilderAssumption({
          assumptionId: "assume_owner_workforce",
          text: `Digital Workforce prioritizes what you asked for: ${ownerRequested.map((entry) => entry.label).join(", ")}.`,
          confidence: 0.9,
          source: "owner_request",
        })]
        : []),
    ];

    return deepFreeze({
      ok: true,
      selectedBlueprints: blueprints.recommendations.filter((entry) => entry.selected),
      selectedComponents: components.recommendations.filter((entry) => entry.selected),
      selectedEmployees,
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
        summary: ownerRequested.length
          ? `We matched reusable blueprints and put your requested digital teammates first (${ownerRequested.map((entry) => entry.label).join(", ")}). Gaps stay visible — nothing unsupported will pretend to work.`
          : "We matched reusable blueprints and components to what you described. Gaps stay visible — nothing unsupported will pretend to work.",
      },
    });
  }
}
