import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BuilderSessionService } from "./BuilderSessionService.js";
import { BuilderSessionRepository } from "./BuilderSessionRepository.js";
import { BuilderAssemblyPlanner } from "./BuilderAssemblyPlanner.js";
import { BuilderSpecificationAssembler } from "./BuilderSpecificationAssembler.js";
import { buildVisualBusinessOSProposal } from "./VisualBusinessOSProposal.js";
import { BusinessWebsiteResearchService } from "./BusinessWebsiteResearchService.js";
import {
  extractBuilderArtifactEvidence,
  createBuilderArtifactMappingProposal,
} from "./BuilderArtifactClassifier.js";
import { createBuilderEvidence } from "./BuilderEvidence.js";
import { withBuilderSessionPatch } from "./BuilderSession.js";
import { BusinessOSCompiler } from "../business-os/BusinessOSCompiler.js";
import { BusinessOSInstaller } from "../business-os/BusinessOSInstaller.js";
import {
  createBusinessOSInstallationApproval,
} from "../business-os/BusinessOSInstallationApproval.js";
import { DeterministicBuilderIntelligenceProvider } from "./BuilderIntelligenceProvider.js";
import { BuilderSpecificationChangePlanner } from "./BuilderSpecificationChangePlanner.js";
import {
  createBuilderConversationMessage,
  appendConversation,
} from "./BuilderConversation.js";

/**
 * End-to-end AI Builder façade used by API routes.
 */
export class AiBuilderService {
  constructor({
    repository = new BuilderSessionRepository(),
    sessionService = null,
    assemblyPlanner = new BuilderAssemblyPlanner(),
    assembler = new BuilderSpecificationAssembler(),
    researchService = new BusinessWebsiteResearchService(),
    compiler = new BusinessOSCompiler(),
    installer = new BusinessOSInstaller(),
    intelligence = new DeterministicBuilderIntelligenceProvider(),
    changePlanner = new BuilderSpecificationChangePlanner(),
    nowISO = () => new Date().toISOString(),
  } = {}) {
    this.repository = repository;
    this.sessionService = sessionService ?? new BuilderSessionService({ repository, intelligence, nowISO });
    this.assemblyPlanner = assemblyPlanner;
    this.assembler = assembler;
    this.researchService = researchService;
    this.compiler = compiler;
    this.installer = installer;
    this.intelligence = intelligence;
    this.changePlanner = changePlanner;
    this.nowISO = nowISO;
    this.proposals = new Map();
  }

  startSession(input) {
    return this.sessionService.startSession(input);
  }

  getSession(sessionId) {
    return this.sessionService.getSession(sessionId);
  }

  answer(input) {
    return this.sessionService.answer(input);
  }

  async research({ sessionId, websiteUrl = null, manualFallbackText = null }) {
    const session = await this.requireSession(sessionId);
    const result = await this.researchService.research({
      websiteUrl: websiteUrl ?? session.websiteUrls[0],
      approvedUrls: session.websiteUrls.length ? session.websiteUrls : (websiteUrl ? [websiteUrl] : []),
      manualFallbackText,
      nowISO: this.nowISO(),
    });
    if (!result.ok) return result;

    const findings = result.report.findings;
    const businessSummary = {
      ...session.businessSummary,
      businessName: session.businessSummary.businessName ?? findings.companyIdentity,
      industry: session.businessSummary.industry
        ?? findings.industrySignals?.[0]
        ?? session.businessSummary.industry,
      services: unique([...(session.businessSummary.services ?? []), ...(findings.services ?? [])]),
      customerTypes: unique([...(session.businessSummary.customerTypes ?? []), ...(findings.customerTypes ?? [])]),
    };
    const updated = withBuilderSessionPatch(session, {
      currentStage: "researching",
      websiteUrls: unique([...session.websiteUrls, websiteUrl].filter(Boolean)),
      evidence: [...session.evidence, result.evidence],
      businessSummary,
    });
    await this.repository.save(updated);
    return deepFreeze({ ok: true, session: updated, report: result.report });
  }

  async upload({ sessionId, filename, mimeType = "", notes = "", textPreview = "" }) {
    const session = await this.requireSession(sessionId);
    const artifactId = `art_${filename}`.slice(0, 64);
    const extracted = extractBuilderArtifactEvidence({
      artifactId,
      filename,
      mimeType,
      notes,
      textPreview,
    });
    const mapping = createBuilderArtifactMappingProposal(extracted, { confirmed: false });
    const evidence = createBuilderEvidence({
      evidenceId: `ev_${artifactId}`,
      kind: "upload",
      label: filename,
      source: "upload",
      payload: { extracted, mapping },
      mutatesCanonicalData: false,
    });
    const updated = withBuilderSessionPatch(session, {
      uploadedArtifactIds: [...session.uploadedArtifactIds, artifactId],
      evidence: [...session.evidence, evidence],
    });
    await this.repository.save(updated);
    return deepFreeze({ ok: true, session: updated, extracted, mapping });
  }

  async propose({ sessionId }) {
    const session = await this.requireSession(sessionId);
    const assemblyPlan = this.assemblyPlanner.plan({ session });
    const assembled = this.assembler.assemble({
      session,
      assemblyPlan,
      nowISO: this.nowISO(),
    });
    if (!assembled.ok) return assembled;

    const proposal = buildVisualBusinessOSProposal({
      session,
      specification: assembled.specification,
      assemblyPlan,
      businessId: session.businessId ?? "preview",
    });

    const updated = withBuilderSessionPatch(session, {
      currentStage: "proposal_ready",
      selectedBlueprints: assemblyPlan.selectedBlueprints,
      selectedComponents: assemblyPlan.selectedComponents,
      capabilityGaps: assemblyPlan.capabilityGaps,
      assumptions: [...session.assumptions, ...assemblyPlan.assumptions],
      specificationId: assembled.specification.specificationId,
      specificationContentHash: assembled.specification.contentHash,
    });
    await this.repository.save(updated);
    this.proposals.set(sessionId, {
      specification: assembled.specification,
      assemblyPlan,
      proposal,
    });

    return deepFreeze({
      ok: true,
      session: updated,
      specification: assembled.specification,
      assemblyPlan,
      proposal,
    });
  }

  async chat({ sessionId, text }) {
    const session = await this.requireSession(sessionId);
    const interpreted = await this.intelligence.interpretChangeRequest({ text });
    const stored = this.proposals.get(sessionId);
    if (!stored?.specification) {
      return deepFreeze({
        ok: false,
        reason: "proposal_required",
        message: "Propose an operating system before requesting changes.",
      });
    }

    const planned = this.changePlanner.apply({
      specification: stored.specification,
      change: { ...interpreted, text },
    });

    const proposal = buildVisualBusinessOSProposal({
      session,
      specification: planned.nextSpecification,
      assemblyPlan: stored.assemblyPlan,
    });

    const conversation = appendConversation(session.conversation, createBuilderConversationMessage({
      messageId: `msg_user_change_${Date.now()}`,
      role: "user",
      text,
    }));
    const withAssistant = appendConversation(conversation, createBuilderConversationMessage({
      messageId: `msg_assistant_change_${Date.now()}`,
      role: "assistant",
      text: `Proposed change: ${interpreted.kind.replace(/_/g, " ")}. Dry run and approval are required before install.`,
    }));

    const updated = withBuilderSessionPatch(session, {
      conversation: withAssistant,
      currentStage: "awaiting_review",
      specificationId: planned.nextSpecification.specificationId,
      specificationContentHash: planned.nextSpecification.contentHash,
      installationPlanId: null,
      installationPlanHash: null,
    });
    await this.repository.save(updated);
    this.proposals.set(sessionId, {
      specification: planned.nextSpecification,
      assemblyPlan: stored.assemblyPlan,
      proposal,
      change: planned,
    });

    return deepFreeze({
      ok: true,
      session: updated,
      proposal,
      specification: planned.nextSpecification,
      changeImpact: {
        kind: interpreted.kind,
        requiresDryRun: true,
        requiresApproval: true,
        previousHash: planned.previousHash,
        nextHash: planned.nextSpecification.contentHash,
      },
    });
  }

  async dryRun({ sessionId }) {
    const session = await this.requireSession(sessionId);
    const stored = this.proposals.get(sessionId);
    if (!stored?.specification) return deepFreeze({ ok: false, reason: "proposal_required" });

    const compiled = this.compiler.compile(stored.specification, { nowISO: this.nowISO() });
    if (!compiled.ok) return compiled;

    const businessId = session.businessId ?? `draft_${session.sessionId}`;
    const dry = this.installer.dryRun({
      specification: { ...stored.specification, businessId },
      plan: compiled.plan,
      businessId,
      nowISO: this.nowISO(),
    });

    const updated = withBuilderSessionPatch(session, {
      currentStage: dry.ok ? "dry_run_ready" : "blocked",
      installationPlanId: compiled.plan.planId,
      installationPlanHash: compiled.plan.planHash,
      businessId,
    });
    await this.repository.save(updated);
    this.proposals.set(sessionId, { ...stored, plan: compiled.plan, dryRunResult: dry });

    return deepFreeze({
      ok: dry.ok,
      session: updated,
      plan: compiled.plan,
      dryRunResult: dry,
      progressSteps: [
        "Creating your workspaces",
        "Configuring roles",
        "Installing digital employees",
        "Preparing dashboards",
        "Checking integrations",
      ],
    });
  }

  async install({ sessionId, approved = false, actorId = null }) {
    const session = await this.requireSession(sessionId);
    const stored = this.proposals.get(sessionId);
    if (!stored?.specification || !stored?.plan || !stored?.dryRunResult) {
      return deepFreeze({ ok: false, reason: "dry_run_required" });
    }
    if (!approved) return deepFreeze({ ok: false, reason: "approval_required" });

    const businessId = session.businessId ?? `draft_${session.sessionId}`;
    const approval = createBusinessOSInstallationApproval({
      approvalId: `appr_${session.sessionId}`,
      businessId,
      specificationId: stored.specification.specificationId,
      specificationVersion: stored.specification.version,
      specificationContentHash: stored.specification.contentHash,
      planId: stored.plan.planId,
      planHash: stored.plan.planHash,
      approvedByUserId: actorId ?? session.actorId ?? "builder_actor",
      approvedAt: this.nowISO(),
    });

    const installing = withBuilderSessionPatch(session, { currentStage: "installing" });
    await this.repository.save(installing);

    const installed = this.installer.install({
      specification: { ...stored.specification, businessId },
      plan: stored.plan,
      businessId,
      dryRunResult: stored.dryRunResult,
      approval,
      actorUserId: actorId ?? session.actorId,
      nowISO: this.nowISO(),
    });

    const updated = withBuilderSessionPatch(installing, {
      currentStage: installed.ok ? "installed" : "failed",
      businessId,
    });
    await this.repository.save(updated);

    return deepFreeze({
      ok: installed.ok,
      session: updated,
      installation: installed,
      openHref: installed.ok ? `/b/${businessId}/home` : null,
    });
  }

  async requireSession(sessionId) {
    const session = await this.repository.get(sessionId);
    if (!session) throw new Error("Builder session not found.");
    return session;
  }
}

function unique(items) {
  return [...new Set(items.map((entry) => String(entry)).filter(Boolean))];
}
