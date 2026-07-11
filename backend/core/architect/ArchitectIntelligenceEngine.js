import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createArchitectStageResult } from "./ArchitectStageResult.js";
import { ARCHITECT_PIPELINE_STAGES, summarizePipeline } from "./ArchitectPipeline.js";
import { BusinessDnaGenerator } from "./BusinessDnaGenerator.js";
import {
  BusinessAnalysisEngine,
  BlueprintMatchingStage,
  ComponentMatchingStage,
  EmployeeGenerationStage,
  ObjectGenerationStage,
  WorkflowGenerationStage,
  NavigationGenerationStage,
  DashboardGenerationStage,
  KnowledgeGenerationStage,
  IntegrationGenerationStage,
  GapAnalysisStage,
  BusinessOsAssemblyStage,
  PreviewGenerationStage,
} from "./ArchitectMatchingStages.js";
import { ContinuousImprovementPlanner } from "./ContinuousImprovementPlanner.js";
import { BusinessDiscoveryEngine } from "../ai-builder/BusinessDiscoveryEngine.js";
import { BusinessWebsiteResearchService } from "../ai-builder/BusinessWebsiteResearchService.js";
import {
  extractBuilderArtifactEvidence,
  createBuilderArtifactMappingProposal,
} from "../ai-builder/BuilderArtifactClassifier.js";
import { createBuilderSession } from "../ai-builder/BuilderSession.js";

/**
 * VIBETech Architect Intelligence Engine.
 * Business Systems Architect — not a chatbot.
 * Reuses discovery/research/matching/assembly engines; does not rewrite OS/compiler/installer.
 */
export class ArchitectIntelligenceEngine {
  constructor({
    discoveryEngine = new BusinessDiscoveryEngine(),
    researchService = new BusinessWebsiteResearchService(),
    dnaGenerator = new BusinessDnaGenerator(),
    analysisEngine = new BusinessAnalysisEngine(),
    blueprintMatching = new BlueprintMatchingStage(),
    componentMatching = new ComponentMatchingStage(),
    employeeGeneration = new EmployeeGenerationStage(),
    objectGeneration = new ObjectGenerationStage(),
    workflowGeneration = new WorkflowGenerationStage(),
    navigationGeneration = new NavigationGenerationStage(),
    dashboardGeneration = new DashboardGenerationStage(),
    knowledgeGeneration = new KnowledgeGenerationStage(),
    integrationGeneration = new IntegrationGenerationStage(),
    gapAnalysis = new GapAnalysisStage(),
    osAssembly = new BusinessOsAssemblyStage(),
    previewGeneration = new PreviewGenerationStage(),
    improvementPlanner = new ContinuousImprovementPlanner(),
    nowISO = () => new Date().toISOString(),
  } = {}) {
    this.discoveryEngine = discoveryEngine;
    this.researchService = researchService;
    this.dnaGenerator = dnaGenerator;
    this.analysisEngine = analysisEngine;
    this.blueprintMatching = blueprintMatching;
    this.componentMatching = componentMatching;
    this.employeeGeneration = employeeGeneration;
    this.objectGeneration = objectGeneration;
    this.workflowGeneration = workflowGeneration;
    this.navigationGeneration = navigationGeneration;
    this.dashboardGeneration = dashboardGeneration;
    this.knowledgeGeneration = knowledgeGeneration;
    this.integrationGeneration = integrationGeneration;
    this.gapAnalysis = gapAnalysis;
    this.osAssembly = osAssembly;
    this.previewGeneration = previewGeneration;
    this.improvementPlanner = improvementPlanner;
    this.nowISO = nowISO;
  }

  get stages() {
    return ARCHITECT_PIPELINE_STAGES;
  }

  async run(input = {}) {
    const ctx = await this.#buildContext(input);
    const early = [];

    early.push(await this.#stageBusinessDiscovery(ctx));
    early.push(await this.#stageWebsiteIntelligence(ctx));
    early.push(this.#stageDocumentIntelligence(ctx));
    early.push(this.#stageBusinessUnderstanding(ctx));

    const dnaStage = this.dnaGenerator.generate({
      businessSummary: ctx.businessSummary,
      evidence: ctx.evidence,
      websiteFindings: ctx.websiteFindings,
      documents: ctx.documents,
      businessId: ctx.businessId,
      sourceSessionId: ctx.session?.sessionId ?? null,
      nowISO: this.nowISO(),
    });
    early.push(dnaStage);
    ctx.dna = dnaStage.outputs.dna;

    early.push(this.analysisEngine.analyze({ dna: ctx.dna }));

    const blueprint = this.blueprintMatching.match({
      dna: ctx.dna,
      installedSpecification: ctx.installedSpecification,
      businessSummary: ctx.businessSummary,
    });
    early.push(blueprint);

    const components = this.componentMatching.match({
      dna: ctx.dna,
      businessSummary: ctx.businessSummary,
    });
    early.push(components);

    const employees = this.employeeGeneration.generate({
      dna: ctx.dna,
      businessSummary: ctx.businessSummary,
    });
    early.push(employees);

    const objects = this.objectGeneration.generate({
      dna: ctx.dna,
      businessSummary: ctx.businessSummary,
      businessId: ctx.businessId ?? null,
    });
    early.push(objects);

    const workflows = this.workflowGeneration.generate({
      dna: ctx.dna,
      businessSummary: ctx.businessSummary,
      businessId: ctx.businessId ?? null,
      organization: employees.outputs?.organization ?? null,
    });
    early.push(workflows);

    // Assemble once from reusable assets, then derive navigation/dashboard/etc.
    const osStage = this.osAssembly.assemble({
      session: ctx.session,
      dna: ctx.dna,
      nowISO: this.nowISO(),
    });
    ctx.specification = osStage.outputs.specification;
    ctx.assemblyPlan = osStage.outputs.assemblyPlan;

    const navigation = this.navigationGeneration.generate({
      specification: ctx.specification,
      dna: ctx.dna,
      businessId: ctx.businessId ?? "preview",
    });
    const dashboard = this.dashboardGeneration.generate({
      dna: ctx.dna,
      specification: ctx.specification,
      businessSummary: ctx.businessSummary,
      businessId: ctx.businessId ?? null,
    });
    const knowledge = this.knowledgeGeneration.generate({ dna: ctx.dna });
    const integrations = this.integrationGeneration.generate({
      dna: ctx.dna,
      businessSummary: ctx.businessSummary,
      businessId: ctx.businessId ?? null,
    });
    const gaps = this.gapAnalysis.analyze({
      dna: ctx.dna,
      businessSummary: ctx.businessSummary,
      recommendations: [
        ...(blueprint.outputs?.recommendations ?? []),
        ...(employees.outputs?.employees ?? []),
        ...(objects.outputs?.objects ?? []),
        ...(workflows.outputs?.workflows ?? []),
      ],
    });
    const preview = this.previewGeneration.generate({
      session: ctx.session,
      specification: ctx.specification,
      assemblyPlan: ctx.assemblyPlan,
    });
    const improvement = await this.improvementPlanner.plan({
      prompt: ctx.improvementPrompt ?? "Plan future improvements after install",
      installedSpecification: ctx.installedSpecification ?? ctx.specification,
      dna: ctx.dna,
    });

    const ordered = orderStages([
      ...early,
      navigation,
      dashboard,
      knowledge,
      integrations,
      gaps,
      osStage,
      preview,
      improvement,
    ]);

    return deepFreeze({
      ok: ordered.every((entry) => entry.ok !== false),
      role: "business_systems_architect",
      pipeline: ARCHITECT_PIPELINE_STAGES,
      stages: ordered,
      summary: summarizePipeline(ordered),
      businessDna: ctx.dna,
      specification: ctx.specification,
      assemblyPlan: ctx.assemblyPlan,
      proposal: preview.outputs?.proposal ?? null,
      consultantNotes: buildConsultantNotes(ordered, ctx.dna),
    });
  }

  async improve({ prompt, installedSpecification, dna = null, businessSummary = null }) {
    return this.improvementPlanner.plan({
      prompt,
      installedSpecification,
      dna: dna ?? (businessSummary
        ? this.dnaGenerator.generate({ businessSummary }).outputs.dna
        : null),
    });
  }

  async #buildContext(input) {
    const businessSummary = { ...(input.businessSummary ?? {}) };
    if (input.description && !businessSummary.description) {
      businessSummary.description = input.description;
    }
    if (input.businessName && !businessSummary.businessName) {
      businessSummary.businessName = input.businessName;
    }
    if (input.industry && !businessSummary.industry) {
      businessSummary.industry = input.industry;
    }

    let session = input.session ?? null;
    if (!session) {
      session = createBuilderSession({
        businessId: input.businessId ?? null,
        mode: input.mode ?? "new_business",
        currentStage: "assembling",
        businessSummary,
        websiteUrls: input.websiteUrl ? [input.websiteUrl] : [],
        evidence: input.evidence ?? [],
        answers: input.answers ?? [],
      });
    }

    return {
      businessId: input.businessId ?? session.businessId,
      businessSummary: { ...session.businessSummary, ...businessSummary },
      session: {
        ...session,
        businessSummary: { ...session.businessSummary, ...businessSummary },
      },
      websiteUrl: input.websiteUrl ?? session.websiteUrls?.[0] ?? null,
      websiteFindings: input.websiteFindings ?? null,
      documents: input.documents ?? [],
      evidence: [...(session.evidence ?? []), ...(input.evidence ?? [])],
      installedSpecification: input.installedSpecification ?? null,
      improvementPrompt: input.improvementPrompt ?? null,
      answers: input.answers ?? session.answers ?? [],
      dna: null,
      specification: null,
      assemblyPlan: null,
    };
  }

  async #stageBusinessDiscovery(ctx) {
    let summary = ctx.businessSummary;
    let unresolved = [];
    let nextQuestions = [];
    let confidence = "medium";

    if (ctx.session && (ctx.answers?.length || summary.description)) {
      // Apply description as initial discovery if present.
      if (summary.description && !(ctx.answers ?? []).some((entry) => entry.questionId === "q_tell_us")) {
        const applied = await this.discoveryEngine.applyAnswer(ctx.session, {
          questionId: "q_tell_us",
          answer: summary.description,
          nowISO: this.nowISO(),
        });
        summary = applied.businessSummary;
        unresolved = applied.unresolvedQuestions;
        nextQuestions = applied.nextQuestions;
        confidence = applied.progress?.readyForProposal ? "high" : "medium";
        ctx.businessSummary = summary;
        ctx.session = { ...ctx.session, businessSummary: summary, answers: applied.answers };
      } else {
        nextQuestions = this.discoveryEngine.nextQuestions(ctx.session, { limit: 4 });
        unresolved = nextQuestions.filter((entry) => entry.required).map((entry) => ({
          questionId: entry.questionId,
          prompt: entry.prompt,
          why: entry.why,
        }));
      }
    } else {
      const initial = this.discoveryEngine.initialPrompt();
      nextQuestions = [{ questionId: "q_tell_us", prompt: initial.text, why: initial.why, required: true }];
      unresolved = nextQuestions;
      confidence = "low";
    }

    return createArchitectStageResult({
      stageId: "business_discovery",
      inputs: { hasDescription: Boolean(summary.description) },
      outputs: {
        businessSummary: summary,
        nextQuestions,
        whatWeKnow: {
          name: summary.businessName ?? null,
          industry: summary.industry ?? null,
          services: summary.services ?? [],
          customers: summary.customerTypes ?? summary.customers ?? [],
        },
      },
      confidence,
      unresolvedQuestions: unresolved,
      recommendations: nextQuestions.slice(0, 1).map((entry) => ({
        kind: "ask",
        label: entry.prompt,
        why: entry.why ?? "Ask only the next most useful question.",
      })),
      explanation: "Discover the business conversationally — never dump a giant form.",
    });
  }

  async #stageWebsiteIntelligence(ctx) {
    if (ctx.websiteFindings) {
      return createArchitectStageResult({
        stageId: "website_intelligence",
        inputs: { websiteUrl: ctx.websiteUrl },
        outputs: { findings: ctx.websiteFindings, confirmationRequired: true },
        confidence: ctx.websiteFindings.confidence ?? "medium",
        recommendations: [{
          kind: "confirm",
          label: "Confirm website findings before treating them as truth",
          why: "Research is evidence, not installation authority.",
        }],
        explanation: "Website intelligence informs DNA; it never installs capabilities.",
      });
    }
    if (!ctx.websiteUrl) {
      return createArchitectStageResult({
        stageId: "website_intelligence",
        inputs: {},
        outputs: { skipped: true },
        confidence: "unknown",
        unresolvedQuestions: [{
          questionId: "website_optional",
          prompt: "Optional: provide a public website for research",
        }],
        explanation: "Website research is optional and bounded.",
      });
    }

    const research = await this.researchService.research({
      websiteUrl: ctx.websiteUrl,
      approvedUrls: [ctx.websiteUrl],
      nowISO: this.nowISO(),
      manualFallbackText: ctx.manualWebsiteText ?? null,
    });
    if (!research.ok) {
      return createArchitectStageResult({
        stageId: "website_intelligence",
        ok: true,
        inputs: { websiteUrl: ctx.websiteUrl },
        outputs: { failed: true, fallbackAvailable: true, reason: research.reason },
        confidence: "low",
        recommendations: [{
          kind: "fallback",
          label: "Continue with manual notes",
          why: research.message ?? "Public research failed safely.",
        }],
        explanation: "Failed website research must not block Architect progress.",
      });
    }
    ctx.websiteFindings = research.report?.findings ?? research.report ?? null;
    ctx.evidence.push(research.evidence);
    return createArchitectStageResult({
      stageId: "website_intelligence",
      inputs: { websiteUrl: ctx.websiteUrl },
      outputs: {
        report: research.report,
        findings: ctx.websiteFindings,
        confirmationRequired: true,
        canInstallCapabilities: false,
      },
      confidence: research.report?.confidence ?? "medium",
      evidence: [research.evidence],
      recommendations: [{
        kind: "confirm",
        label: "Confirm or reject findings",
        why: "Never silently treat scraped text as confirmed truth.",
      }],
      explanation: "Website intelligence is evidence-backed and confirmation-gated.",
    });
  }

  #stageDocumentIntelligence(ctx) {
    const documents = (ctx.documents ?? []).map((doc) => {
      const extracted = extractBuilderArtifactEvidence({
        artifactId: doc.artifactId ?? `doc_${doc.filename}`,
        filename: doc.filename,
        mimeType: doc.mimeType,
        notes: doc.notes,
        textPreview: doc.textPreview,
      });
      const mapping = createBuilderArtifactMappingProposal(extracted, { confirmed: false });
      return { extracted, mapping, mutatesCanonicalData: false };
    });
    return createArchitectStageResult({
      stageId: "document_intelligence",
      inputs: { documentCount: documents.length },
      outputs: { documents },
      confidence: documents.length ? "medium" : "unknown",
      recommendations: documents.map((doc) => ({
        kind: "classify",
        label: doc.extracted.filename,
        why: `Appears to be ${doc.extracted.classification}; planned use: ${doc.mapping.action ?? doc.mapping.destination}`,
      })),
      explanation: "Document intake classifies and proposes mapping — no canonical mutation.",
    });
  }

  #stageBusinessUnderstanding(ctx) {
    const questions = [
      "What does this business actually do?",
      "How do they make money?",
      "What departments exist?",
      "Who performs work?",
      "What repetitive work exists?",
      "Who approves decisions?",
      "What software are they replacing?",
      "What dashboards and KPIs matter?",
      "What integrations and terminology matter?",
    ];
    const answered = {
      whatTheyDo: Boolean(ctx.businessSummary.description || ctx.websiteFindings?.services?.length),
      industry: Boolean(ctx.businessSummary.industry),
      roles: Boolean(ctx.businessSummary.roles?.length),
      approvals: Boolean(ctx.businessSummary.approvalNeeds?.length),
      software: Boolean(ctx.businessSummary.currentSoftware?.length),
    };
    const unresolved = questions.filter((prompt) => {
      if (/make money|actually do/.test(prompt)) return !answered.whatTheyDo;
      if (/departments|performs work/.test(prompt)) return !answered.roles;
      if (/approves/.test(prompt)) return !answered.approvals;
      if (/software/.test(prompt)) return !answered.software;
      return false;
    }).map((prompt, index) => ({ questionId: `understand_${index}`, prompt }));

    return createArchitectStageResult({
      stageId: "business_understanding",
      inputs: answered,
      outputs: {
        understandingChecklist: questions,
        answered,
      },
      confidence: Object.values(answered).filter(Boolean).length >= 3 ? "medium" : "low",
      unresolvedQuestions: unresolved,
      recommendations: [{
        kind: "consultant",
        label: "Prefer simple reusable structure over complex custom systems",
        why: "Senior architects reduce unnecessary complexity.",
      }],
      explanation: "Understanding synthesizes discovery, website, and documents before DNA.",
    });
  }
}

function orderStages(stageResults) {
  const byId = new Map(stageResults.map((entry) => [entry.stageId, entry]));
  return ARCHITECT_PIPELINE_STAGES.map((stageId) => byId.get(stageId)).filter(Boolean);
}

function buildConsultantNotes(stages, dna) {
  const notes = [
    "Act as a senior business systems consultant — reuse first, invent last.",
    "Challenge unnecessary complexity; prefer fewer primary workspaces.",
  ];
  const gaps = stages.find((entry) => entry.stageId === "gap_analysis")?.outputs?.gaps ?? [];
  if (gaps.some((gap) => gap.architectClass === "unsupported")) {
    notes.push("Be honest about unsupported capabilities — do not fake readiness.");
  }
  if ((dna?.confidence?.overall ?? "medium") === "low") {
    notes.push("Confidence is low — ask the next best question before installing.");
  }
  return notes;
}

export { ARCHITECT_PIPELINE_STAGES };
