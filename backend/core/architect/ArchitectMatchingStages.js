import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createArchitectStageResult } from "./ArchitectStageResult.js";
import { resolveReusePreference } from "../platform/constitution/BlueprintResolutionOrder.js";
import { BlueprintRecommendationEngine } from "../ai-builder/BlueprintRecommendationEngine.js";
import { ComponentRecommendationEngine } from "../ai-builder/ComponentRecommendationEngine.js";
import { EmployeeArchetypeRecommendationEngine } from "../ai-builder/EmployeeArchetypeRecommendationEngine.js";
import { ObjectRecommendationEngine } from "../ai-builder/ObjectRecommendationEngine.js";
import { WorkflowRecommendationEngine } from "../ai-builder/WorkflowRecommendationEngine.js";
import { IntegrationRecommendationEngine } from "../ai-builder/IntegrationRecommendationEngine.js";
import { CapabilityGapDetector } from "../ai-builder/CapabilityGapDetector.js";
import { DashboardRecommendationEngine } from "../ai-builder/DashboardRecommendationEngine.js";
import { buildBusinessOSNavigation } from "../business-os/BusinessOSNavigationBuilder.js";
import { BuilderSpecificationAssembler } from "../ai-builder/BuilderSpecificationAssembler.js";
import { BuilderAssemblyPlanner } from "../ai-builder/BuilderAssemblyPlanner.js";
import { buildVisualBusinessOSProposal } from "../ai-builder/VisualBusinessOSProposal.js";
import { createIntelligenceFinding } from "../platform/contracts/BusinessIntelligenceContracts.js";

/**
 * Consultant-style analysis of Business DNA — challenge complexity, surface tradeoffs.
 */
export class BusinessAnalysisEngine {
  analyze({ dna } = {}) {
    if (!dna) throw new Error("BusinessAnalysisEngine: dna required.");
    const findings = [];
    const recommendations = [];
    const unresolvedQuestions = [...(dna.unresolvedQuestions ?? [])];

    findings.push(createIntelligenceFinding({
      findingId: "find_what_they_do",
      claim: dna.company?.whatTheyDo ?? dna.company?.description ?? "Business activity still being clarified.",
      confidence: dna.company?.whatTheyDo ? "medium" : "low",
      evidenceIds: [],
    }));
    findings.push(createIntelligenceFinding({
      findingId: "find_revenue",
      claim: dna.company?.howTheyMakeMoney ?? "Revenue model not yet explicit.",
      confidence: dna.company?.howTheyMakeMoney ? "medium" : "low",
    }));
    findings.push(createIntelligenceFinding({
      findingId: "find_departments",
      claim: dna.departments.length
        ? `Departments inferred: ${dna.departments.map((entry) => entry.label).join(", ")}`
        : "Departments unclear — keep structure simple until roles are known.",
      confidence: dna.departments.length ? "medium" : "low",
    }));

    if ((dna.workflows?.length ?? 0) > 6) {
      recommendations.push({
        kind: "simplify",
        label: "Start with fewer workflows",
        why: "Too many workflows at once creates noise. Launch the highest-frequency loops first.",
        tradeoff: "Coverage vs clarity",
      });
    } else {
      recommendations.push({
        kind: "focus",
        label: "Prioritize repetitive work and approvals",
        why: "Those produce the fastest operating leverage for a Business OS.",
      });
    }

    if (!dna.approvals?.length) {
      unresolvedQuestions.push({
        questionId: "q_approvals",
        prompt: "Which actions always need human approval?",
        why: "Approval boundaries keep customer communication safe.",
      });
    }

    return createArchitectStageResult({
      stageId: "business_analysis",
      inputs: { dnaId: dna.dnaId },
      outputs: {
        findings,
        whatTheyDo: dna.company?.whatTheyDo ?? null,
        howTheyMakeMoney: dna.company?.howTheyMakeMoney ?? null,
        departments: dna.departments,
        repetitiveWork: dna.recurringWork,
        approvals: dna.approvals,
        kpis: dna.kpis,
        terminologyCandidates: dna.terminology,
      },
      confidence: dna.confidence?.overall ?? "medium",
      evidence: [],
      unresolvedQuestions,
      recommendations,
      explanation: "Analyze the company like a senior systems consultant before recommending Blueprints.",
    });
  }
}

export class BlueprintMatchingStage {
  constructor({ engine = new BlueprintRecommendationEngine() } = {}) {
    this.engine = engine;
  }

  match({ dna, installedSpecification = null, businessSummary = null } = {}) {
    const summary = businessSummary ?? {
      industry: dna?.company?.industry,
      businessName: dna?.company?.name,
      services: dna?.services?.map((entry) => entry.label),
    };
    const recommended = this.engine.recommend({ businessSummary: summary, evidence: [] });
    const selected = recommended.recommendations.find((entry) => entry.selected) ?? recommended.recommendations[0];

    const reuse = resolveReusePreference({
      hasInstalledConfiguration: Boolean(installedSpecification),
      hasBusinessTemplate: false,
      hasGoldBlueprint: /gold/i.test(selected?.recommendationId ?? selected?.label ?? ""),
      hasIndustryBlueprint: Boolean(selected) && !/universal/i.test(selected?.recommendationId ?? ""),
      hasReusableComponent: false,
      hasEmployeeArchetype: false,
    });

    return createArchitectStageResult({
      stageId: "blueprint_matching",
      inputs: { industry: summary.industry ?? null, hasInstalled: Boolean(installedSpecification) },
      outputs: {
        reuseOrder: reuse.order,
        selectedReuseSource: reuse.selected,
        recommendations: recommended.recommendations,
        selectedBlueprint: selected ?? null,
      },
      confidence: selected?.confidence ?? 0.55,
      evidence: selected?.evidence ?? [],
      unresolvedQuestions: selected ? [] : [{ questionId: "q_industry", prompt: "Confirm industry for Blueprint matching." }],
      recommendations: [{
        kind: "reuse",
        label: reuse.explanation,
        why: "Never duplicate capabilities that already exist higher in the reuse order.",
      }],
      explanation: "Match reusable Blueprints before inventing anything new.",
    });
  }
}

export class ComponentMatchingStage {
  constructor({ engine = new ComponentRecommendationEngine() } = {}) {
    this.engine = engine;
  }

  match({ dna, businessSummary = null } = {}) {
    const summary = businessSummary ?? { industry: dna?.company?.industry, services: dna?.services };
    const result = this.engine.recommend({ businessSummary: summary });
    return createArchitectStageResult({
      stageId: "component_matching",
      inputs: { industry: summary.industry ?? null },
      outputs: { recommendations: result.recommendations },
      confidence: result.recommendations[0]?.confidence ?? "medium",
      evidence: [],
      unresolvedQuestions: [],
      recommendations: result.recommendations,
      explanation: "Prefer reusable components over custom modules.",
    });
  }
}

export class EmployeeGenerationStage {
  constructor({ engine = new EmployeeArchetypeRecommendationEngine() } = {}) {
    this.engine = engine;
  }

  generate({ dna, businessSummary = null } = {}) {
    const summary = businessSummary ?? {
      industry: dna?.company?.industry,
      roles: dna?.team?.map((entry) => entry.label),
      repetitiveWork: dna?.recurringWork,
    };
    const result = this.engine.recommend({ businessSummary: summary, dna });
    const organization = result.organization ?? null;
    return createArchitectStageResult({
      stageId: "employee_generation",
      inputs: { teamSignals: summary.roles ?? [], industry: summary.industry ?? null },
      outputs: {
        employees: result.recommendations,
        organization,
        businessOsMapping: result.businessOsMapping ?? null,
        gaps: result.gaps ?? [],
        workforceRecommendations: result.allRecommendations ?? result.recommendations,
      },
      confidence: result.recommendations.length ? "medium" : "low",
      evidence: organization
        ? [`departments:${organization.departments?.length ?? 0}`, `ai_employees:${organization.aiEmployees?.length ?? 0}`]
        : [],
      unresolvedQuestions: [],
      recommendations: result.allRecommendations ?? result.recommendations,
      explanation: "Assemble departments, roles, and reusable AI employee archetypes — never invent hidden one-off agents.",
    });
  }
}

export class ObjectGenerationStage {
  constructor({ engine = new ObjectRecommendationEngine() } = {}) {
    this.engine = engine;
  }

  generate({ dna, businessSummary = null, businessId = null } = {}) {
    const summary = businessSummary ?? {
      industry: dna?.company?.industry,
      description: dna?.company?.whatTheyDo ?? dna?.company?.description,
    };
    const result = this.engine.recommend({ businessSummary: summary, dna, businessId });
    const dataModel = result.dataModel ?? null;
    return createArchitectStageResult({
      stageId: "object_generation",
      inputs: { industry: summary.industry ?? null, businessId },
      outputs: {
        objects: result.recommendations,
        dataModel,
        businessOsMapping: result.businessOsMapping ?? null,
        gaps: result.gaps ?? [],
        dataFormsRecommendations: result.allRecommendations ?? result.recommendations,
      },
      confidence: result.recommendations.length ? "medium" : "low",
      evidence: dataModel
        ? [
          `objects:${dataModel.objects?.length ?? 0}`,
          `forms:${dataModel.forms?.length ?? 0}`,
          `views:${dataModel.views?.length ?? 0}`,
          `relationships:${dataModel.relationships?.length ?? 0}`,
        ]
        : [],
      unresolvedQuestions: [],
      recommendations: result.allRecommendations ?? result.recommendations,
      explanation: "Assemble business objects, fields, forms, views, and search from reusable object archetypes — never invent one-off schemas.",
    });
  }
}

export class WorkflowGenerationStage {
  constructor({ engine = new WorkflowRecommendationEngine() } = {}) {
    this.engine = engine;
  }

  generate({ dna, businessSummary = null, businessId = null, organization = null } = {}) {
    const summary = businessSummary ?? {
      industry: dna?.company?.industry,
      description: dna?.company?.whatTheyDo ?? dna?.company?.description,
    };
    const result = this.engine.recommend({
      businessSummary: summary,
      dna,
      businessId,
      organization,
    });
    const workflowModel = result.workflowModel ?? null;
    const legacyWorkflows = (workflowModel?.workflows ?? []).map((entry) => ({
      workflowId: entry.workflowId,
      label: entry.label,
      kind: entry.kind ?? "operations",
      approvalRequired: Boolean(entry.approvals?.length),
    }));

    // Preserve DNA-only signal when engine returned nothing unexpected.
    const unresolvedQuestions = legacyWorkflows.length ? [] : [{
      questionId: "q_repetitive_work",
      prompt: "What repetitive work takes the most time?",
    }];

    return createArchitectStageResult({
      stageId: "workflow_generation",
      inputs: {
        dnaWorkflowCount: dna?.workflows?.length ?? 0,
        industry: summary.industry ?? null,
        businessId,
      },
      outputs: {
        workflows: legacyWorkflows.length ? legacyWorkflows : result.recommendations,
        workflowModel,
        businessOsMapping: result.businessOsMapping ?? null,
        gaps: result.gaps ?? [],
        workflowRecommendations: result.allRecommendations ?? result.recommendations,
      },
      confidence: legacyWorkflows.length || result.recommendations.length ? "medium" : "low",
      evidence: workflowModel
        ? [
          `workflows:${workflowModel.workflows?.length ?? 0}`,
          `approvals:${workflowModel.metrics?.approvalGated ?? 0}`,
          `escalations:${workflowModel.metrics?.withEscalations ?? 0}`,
        ]
        : [],
      unresolvedQuestions,
      recommendations: result.allRecommendations ?? result.recommendations,
      explanation: "Assemble workflows from reusable archetypes — stages, triggers, approvals, and escalations — never invent one-off runtimes.",
    });
  }
}

export class NavigationGenerationStage {
  generate({ specification = null, dna = null, businessId = "preview" } = {}) {
    if (!specification?.modules) {
      return createArchitectStageResult({
        stageId: "navigation_generation",
        ok: false,
        inputs: {},
        outputs: {},
        confidence: "unknown",
        unresolvedQuestions: [{ questionId: "spec_required", prompt: "Assemble Business OS before navigation." }],
        explanation: "Navigation requires an assembled specification.",
      });
    }
    const navigation = buildBusinessOSNavigation({
      modules: specification.modules,
      navigation: { ...(specification.navigation ?? {}), maximumPrimaryItems: 7 },
      businessId,
    });
    return createArchitectStageResult({
      stageId: "navigation_generation",
      inputs: { moduleCount: specification.modules.length, terminology: dna?.terminology ?? {} },
      outputs: {
        primary: navigation.primaryItems.filter((item) => item.moduleId !== "more").map((item) => ({
          moduleId: item.moduleId,
          label: item.label,
        })),
        overflow: navigation.overflowItems.map((item) => item.label),
        maximumPrimaryItems: 7,
      },
      confidence: "high",
      recommendations: [{
        kind: "simplify",
        label: "Keep primary navigation near seven items",
        why: "More tabs create an admin dashboard feel — employees get lost.",
      }],
      explanation: "Navigation is derived from important business objects, not every employee or task.",
    });
  }
}

export class DashboardGenerationStage {
  constructor({ engine = new DashboardRecommendationEngine() } = {}) {
    this.engine = engine;
  }

  generate({ dna, specification = null, businessSummary = null, businessId = null, evidence = {} } = {}) {
    const summary = businessSummary ?? {
      industry: dna?.company?.industry,
      businessName: dna?.company?.name,
    };
    const result = this.engine.recommend({
      businessSummary: summary,
      modules: specification?.modules ?? [],
      dna,
      evidence,
      businessId,
    });
    return createArchitectStageResult({
      stageId: "dashboard_generation",
      inputs: { industry: summary.industry ?? null, businessId },
      outputs: {
        dashboard: result.dashboard,
        analyticsModel: result.analyticsModel ?? null,
        businessOsMapping: result.businessOsMapping ?? null,
        analyticsRecommendations: result.recommendations ?? [],
      },
      confidence: "medium",
      evidence: result.analyticsModel
        ? [
          `metrics:${result.analyticsModel.metrics?.length ?? 0}`,
          `alerts:${result.analyticsModel.alerts?.length ?? 0}`,
        ]
        : [],
      recommendations: result.recommendations?.length
        ? result.recommendations.slice(0, 8)
        : [{
          kind: "honesty",
          label: "Never fabricate metrics",
          why: "Empty states must stay truthful until canonical data exists.",
        }],
      explanation: "Dashboards and KPIs come from reusable metric definitions and real evidence — never fabricated series.",
    });
  }
}

export class KnowledgeGenerationStage {
  generate({ dna } = {}) {
    const requirements = [
      ...(dna?.policies ?? []).map((entry) => ({ category: "policy", label: entry.label, required: true })),
      ...(dna?.workflows ?? []).slice(0, 3).map((entry) => ({
        category: "sop",
        label: `${entry.label} SOP`,
        required: false,
      })),
      { category: "terminology", label: "Business terminology guide", required: false },
    ];
    return createArchitectStageResult({
      stageId: "knowledge_generation",
      inputs: { policyCount: dna?.policies?.length ?? 0 },
      outputs: { knowledgeRequirements: requirements },
      confidence: requirements.length ? "medium" : "low",
      recommendations: requirements.slice(0, 3),
      explanation: "Knowledge requirements support digital employees and approvals — they do not mutate records.",
    });
  }
}

export class IntegrationGenerationStage {
  constructor({ engine = new IntegrationRecommendationEngine() } = {}) {
    this.engine = engine;
  }

  generate({ dna, businessSummary = null, businessId = null } = {}) {
    const summary = businessSummary ?? {
      industry: dna?.company?.industry,
      integrations: dna?.integrations?.map((entry) => entry.label),
      description: dna?.company?.whatTheyDo ?? dna?.company?.description,
    };
    const result = this.engine.recommend({
      businessSummary: summary,
      dna,
      businessId,
    });
    const integrationModel = result.integrationModel ?? null;
    const legacyIntegrations = (integrationModel?.connections ?? []).map((entry) => ({
      label: entry.label,
      status: entry.health?.statusId === "connected" ? "connected" : "needs_setup",
      providerId: entry.providerId,
    }));

    return createArchitectStageResult({
      stageId: "integration_generation",
      inputs: {
        integrationSignals: dna?.integrations?.length ?? 0,
        industry: summary.industry ?? null,
        businessId,
      },
      outputs: {
        integrations: legacyIntegrations.length
          ? legacyIntegrations
          : [{ label: "Email / inbox", status: "needs_setup" }],
        integrationModel,
        businessOsMapping: result.businessOsMapping ?? null,
        gaps: result.gaps ?? [],
        integrationRecommendations: result.allRecommendations ?? result.recommendations,
      },
      confidence: legacyIntegrations.length || result.recommendations.length ? "medium" : "low",
      evidence: integrationModel
        ? [
          `providers:${integrationModel.connections?.length ?? 0}`,
          `detected:${integrationModel.detectedSoftware?.length ?? 0}`,
        ]
        : [],
      unresolvedQuestions: [],
      recommendations: result.allRecommendations ?? result.recommendations,
      explanation: "Integrations are reusable providers mapped to capabilities — never silently connected, never one-off connectors.",
    });
  }
}

export class GapAnalysisStage {
  constructor({ detector = new CapabilityGapDetector() } = {}) {
    this.detector = detector;
  }

  analyze({ dna, recommendations = [], businessSummary = null } = {}) {
    const summary = businessSummary ?? {
      industry: dna?.company?.industry,
      integrationNeeds: dna?.integrations?.map((entry) => entry.label),
      painPoints: dna?.constraints?.map((entry) => entry.label),
    };
    const detected = this.detector.detect({ businessSummary: summary, recommendations });
    const classified = (detected.gaps ?? []).map((gap) => ({
      ...gap,
      architectClass: classifyGap(gap),
      why: explainGap(gap),
    }));
    return createArchitectStageResult({
      stageId: "gap_analysis",
      inputs: { recommendationCount: recommendations.length },
      outputs: { gaps: classified },
      confidence: "high",
      recommendations: classified.map((gap) => ({
        kind: gap.architectClass,
        label: gap.label,
        why: gap.why,
      })),
      explanation: "Gaps stay visible. Unsupported capabilities never pretend to work.",
    });
  }
}

export class BusinessOsAssemblyStage {
  constructor({
    planner = new BuilderAssemblyPlanner(),
    assembler = new BuilderSpecificationAssembler(),
  } = {}) {
    this.planner = planner;
    this.assembler = assembler;
  }

  assemble({ session, dna = null, nowISO = new Date().toISOString() } = {}) {
    if (!session) throw new Error("BusinessOsAssemblyStage: session required.");
    const assemblyPlan = this.planner.plan({ session });
    const assembled = this.assembler.assemble({ session, assemblyPlan, nowISO });
    return createArchitectStageResult({
      stageId: "business_os_generation",
      ok: assembled.ok,
      inputs: {
        sessionId: session.sessionId,
        dnaId: dna?.dnaId ?? null,
        industry: session.businessSummary?.industry ?? dna?.company?.industry ?? null,
      },
      outputs: {
        assemblyPlan,
        specification: assembled.specification,
        source: assembled.source,
      },
      confidence: assembled.ok ? "medium" : "low",
      evidence: [],
      unresolvedQuestions: assembled.specification?.unresolvedRequirements ?? [],
      recommendations: assemblyPlan.selectedBlueprints ?? [],
      explanation: "Business OS is compiled from understanding and reusable assets — never vertical runtimes.",
    });
  }
}

export class PreviewGenerationStage {
  generate({ session, specification, assemblyPlan } = {}) {
    if (!specification) {
      return createArchitectStageResult({
        stageId: "preview_generation",
        ok: false,
        confidence: "unknown",
        unresolvedQuestions: [{ questionId: "spec_required", prompt: "Generate Business OS first." }],
      });
    }
    const proposal = buildVisualBusinessOSProposal({
      session,
      specification,
      assemblyPlan,
      businessId: session?.businessId ?? "preview",
    });
    return createArchitectStageResult({
      stageId: "preview_generation",
      inputs: { specificationId: specification.specificationId },
      outputs: { proposal },
      confidence: "high",
      recommendations: [{
        kind: "governance",
        label: "Dry run and approve before install",
        why: "Preview is not installation.",
      }],
      explanation: "Preview explains the OS in plain language without raw schema.",
    });
  }
}

function classifyGap(gap) {
  const kind = String(gap.kind ?? "");
  if (kind === "configurable_with_existing_component") return "configuration";
  if (kind === "reusable_component_needed") return "component";
  if (kind === "provider_integration_needed") return "platform_capability";
  if (kind === "industry_blueprint_extension") return "blueprint_improvement";
  if (kind === "prohibited" || kind === "unsupported") return "unsupported";
  if (kind === "deferred") return "unsupported";
  if (/employee/i.test(gap.label ?? "")) return "employee";
  if (/workflow/i.test(gap.label ?? "")) return "workflow";
  return kind || "platform_capability";
}

function explainGap(gap) {
  switch (classifyGap(gap)) {
    case "configuration":
      return "Existing components can cover this with configuration — no new code.";
    case "component":
      return "A reusable component is needed before this can be installed safely.";
    case "employee":
      return "Propose a reusable employee archetype rather than a one-off agent.";
    case "workflow":
      return "Model as a governed workflow on universal Work primitives.";
    case "blueprint_improvement":
      return "Extend an industry Blueprint so other businesses can reuse it.";
    case "platform_capability":
      return "Requires a platform capability or integration setup path.";
    case "unsupported":
      return "Not supported yet — keep visible as a gap or deferral.";
    default:
      return gap.requestedOutcome ?? "Needs explicit Architect decision.";
  }
}

export { deepFreeze };
