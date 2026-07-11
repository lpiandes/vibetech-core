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
import {
  createBuilderProposalState,
  readProposalStateFromSession,
  withProposalStateMetadata,
} from "./BuilderProposalState.js";
import { BusinessOSCompiler } from "../business-os/BusinessOSCompiler.js";
import { BusinessOSInstaller } from "../business-os/BusinessOSInstaller.js";
import { BusinessOSInstallationRepository } from "../business-os/BusinessOSInstallationRepository.js";
import {
  createBusinessOSInstallationApproval,
} from "../business-os/BusinessOSInstallationApproval.js";
import { DeterministicBuilderIntelligenceProvider } from "./BuilderIntelligenceProvider.js";
import { BuilderSpecificationChangePlanner } from "./BuilderSpecificationChangePlanner.js";
import {
  createBuilderConversationMessage,
  appendConversation,
} from "./BuilderConversation.js";
import {
  clientSafeProposalView,
  discoveryStageProgress,
  quickRepliesForQuestion,
  sessionListCard,
} from "./BuilderUxPresentation.js";
import { buildDryRunChecklist } from "./BuilderDryRunChecklist.js";
import { buildBuilderPortalPreview } from "./BuilderPortalPreview.js";

/**
 * End-to-end AI Builder façade used by API routes.
 *
 * Authoritative proposal/plan/dry-run/approval state is persisted on the Builder
 * session (and mirrored into BusinessOSInstallationRepository). this.proposals
 * is only a rebuildable process-local cache.
 */
export class AiBuilderService {
  constructor({
    repository = new BuilderSessionRepository(),
    sessionService = null,
    assemblyPlanner = new BuilderAssemblyPlanner(),
    assembler = new BuilderSpecificationAssembler(),
    researchService = new BusinessWebsiteResearchService(),
    compiler = new BusinessOSCompiler(),
    installationRepository = new BusinessOSInstallationRepository(),
    installer = null,
    intelligence = new DeterministicBuilderIntelligenceProvider(),
    changePlanner = new BuilderSpecificationChangePlanner(),
    platformStore = null,
    nowISO = () => new Date().toISOString(),
  } = {}) {
    this.repository = repository;
    this.sessionService = sessionService ?? new BuilderSessionService({ repository, intelligence, nowISO });
    this.assemblyPlanner = assemblyPlanner;
    this.assembler = assembler;
    this.researchService = researchService;
    this.compiler = compiler;
    this.installationRepository = installationRepository;
    this.installer = installer ?? new BusinessOSInstaller({ repository: installationRepository });
    this.intelligence = intelligence;
    this.changePlanner = changePlanner;
    this.platformStore = platformStore ?? repository?.platformStore ?? null;
    this.nowISO = nowISO;
    /** @type {Map<string, object>} rebuildable cache only */
    this.proposals = new Map();
  }

  async startSession(input = {}) {
    let businessId = input.businessId ?? null;
    if ((!businessId || String(businessId).startsWith("draft_")) && this.platformStore?.createBusiness) {
      const created = await this.platformStore.createBusiness({
        name: String(input.businessName ?? "New Business").trim() || "New Business",
      });
      businessId = String(created.id);
    }
    return this.sessionService.startSession({ ...input, businessId });
  }

  getSession(sessionId) {
    return this.sessionService.getSession(sessionId);
  }

  answer(input) {
    return this.sessionService.answer(input);
  }

  async listSessions({ businessId = null } = {}) {
    const sessions = businessId
      ? await this.sessionService.listForBusiness(businessId)
      : await this.sessionService.listAll();
    const sorted = [...sessions].sort((left, right) => (
      String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""))
    ));
    return deepFreeze({
      ok: true,
      sessions: sorted.map(sessionListCard),
    });
  }

  async getWorkspace(sessionId) {
    const session = await this.requireSession(sessionId);
    const stored = await this.loadProposalState(session);
    const proposal = stored?.specification
      ? clientSafeProposalView(this.buildPreview(session, stored))
      : null;
    const nextQuestion = session.questions?.[0] ?? null;
    const journey = discoveryStageProgress({
      answers: session.answers,
      questions: session.questions,
      progress: session.progress,
      businessSummary: session.businessSummary,
    });
    return deepFreeze({
      ok: true,
      session,
      proposal,
      stored: stored
        ? {
            hasSpecification: Boolean(stored.specification),
            hasPlan: Boolean(stored.plan),
            hasDryRun: Boolean(stored.dryRunResult),
            hasApproval: Boolean(stored.approval),
            changePending: Boolean(stored.change),
          }
        : null,
      journey,
      nextQuestion,
      quickReplies: quickRepliesForQuestion(nextQuestion),
      researchFindings: latestResearchFindings(session),
      uploads: latestUploads(session),
    });
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
    return deepFreeze({ ok: true, session: updated, report: result.report, requiresConfirmation: true });
  }

  async confirmResearch({ sessionId, accepted = true, edits = {} }) {
    const session = await this.requireSession(sessionId);
    const findings = latestResearchFindings(session);
    if (!findings) {
      return deepFreeze({ ok: false, reason: "research_required", message: "Research a website first." });
    }
    const confirmed = {
      ...findings,
      ...edits,
      confirmationStatus: accepted ? "confirmed" : "rejected",
      confirmedAt: this.nowISO(),
    };
    const evidence = session.evidence.map((entry) => {
      if (entry.kind !== "website" && entry.kind !== "website_research" && entry.source !== "fixture" && entry.source !== "manual_fallback") {
        return entry;
      }
      return {
        ...entry,
        payload: {
          ...(entry.payload ?? {}),
          confirmationStatus: confirmed.confirmationStatus,
          confirmedFindings: accepted ? confirmed : null,
        },
      };
    });
    let businessSummary = session.businessSummary;
    if (accepted) {
      businessSummary = {
        ...businessSummary,
        businessName: edits.companyIdentity ?? confirmed.companyIdentity ?? businessSummary.businessName,
        services: unique([...(businessSummary.services ?? []), ...(confirmed.services ?? [])]),
        customerTypes: unique([...(businessSummary.customerTypes ?? []), ...(confirmed.customerTypes ?? [])]),
        locations: unique([...(businessSummary.locations ?? []), ...(confirmed.locations ?? [])]),
      };
    }
    const updated = withBuilderSessionPatch(session, {
      evidence,
      businessSummary,
      metadata: {
        ...session.metadata,
        researchConfirmation: confirmed.confirmationStatus,
      },
    });
    await this.repository.save(updated);
    return deepFreeze({ ok: true, session: updated, confirmation: confirmed });
  }

  async updateAppearance({ sessionId, accentColor = null, logoUrl = null, businessName = null, navigationOverrides = null }) {
    const session = await this.requireSession(sessionId);
    const appearance = {
      ...session.appearance,
      ...(accentColor ? { accentColor } : {}),
      ...(logoUrl != null ? { logoUrl } : {}),
      ...(businessName ? { businessName } : {}),
      ...(navigationOverrides ? { navigationOverrides } : {}),
    };
    const updated = withBuilderSessionPatch(session, { appearance });
    await this.repository.save(updated);
    return deepFreeze({ ok: true, session: updated, appearance });
  }

  async portalPreview({ sessionId, membershipRole = "OWNER" }) {
    const session = await this.requireSession(sessionId);
    const stored = await this.loadProposalState(session);
    if (!stored?.specification) return deepFreeze({ ok: false, reason: "proposal_required" });
    return buildBuilderPortalPreview({
      specification: stored.specification,
      businessId: session.businessId ?? "preview",
      membershipRole,
      appearance: session.appearance,
      navigationOverrides: session.appearance?.navigationOverrides ?? null,
    });
  }

  async upload({
    sessionId,
    filename,
    mimeType = "",
    notes = "",
    textPreview = "",
    contentBase64 = null,
    storage = null,
  }) {
    const session = await this.requireSession(sessionId);
    const artifactId = `art_${filename}`.slice(0, 64);
    let storageKey = null;
    let bytesStored = false;

    if (contentBase64 || textPreview) {
      try {
        const { createKnowledgeStorageProvider } = await import(
          "../platform/knowledge/createKnowledgeStorageProvider.js"
        );
        const objectStorage = storage ?? createKnowledgeStorageProvider();
        const buffer = contentBase64
          ? Buffer.from(String(contentBase64), "base64")
          : Buffer.from(String(textPreview), "utf8");
        storageKey = `architect_${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}_${artifactId}`;
        await objectStorage.putObject({
          businessId: session.businessId ?? "architect-draft",
          storageKey,
          buffer,
        });
        bytesStored = true;
      } catch (err) {
        // Discovery can continue with text evidence; durable bytes are best-effort when storage is misconfigured.
        storageKey = null;
        bytesStored = false;
        if (process.env.NODE_ENV === "production" && contentBase64) {
          throw new Error(`upload_failed: ${err instanceof Error ? err.message : "storage unavailable"}`);
        }
      }
    }

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
      payload: { extracted, mapping, storageKey, bytesStored },
      mutatesCanonicalData: false,
    });
    const updated = withBuilderSessionPatch(session, {
      uploadedArtifactIds: [...session.uploadedArtifactIds, artifactId],
      evidence: [...session.evidence, evidence],
    });
    await this.repository.save(updated);
    return deepFreeze({ ok: true, session: updated, extracted, mapping, storageKey, bytesStored });
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

    const proposalState = createBuilderProposalState({
      specification: assembled.specification,
      assemblyPlan,
      updatedAt: this.nowISO(),
    });
    const updated = await this.persistProposalState(session, proposalState, {
      currentStage: "proposal_ready",
      selectedBlueprints: assemblyPlan.selectedBlueprints,
      selectedComponents: assemblyPlan.selectedComponents,
      capabilityGaps: assemblyPlan.capabilityGaps,
      assumptions: [...session.assumptions, ...assemblyPlan.assumptions],
      specificationId: assembled.specification.specificationId,
      specificationContentHash: assembled.specification.contentHash,
      installationPlanId: null,
      installationPlanHash: null,
    });

    this.installationRepository.saveSpecification({
      ...assembled.specification,
      businessId: session.businessId ?? assembled.specification.businessId,
    });

    return deepFreeze({
      ok: true,
      session: updated,
      specification: assembled.specification,
      assemblyPlan,
      proposal: clientSafeProposalView(this.buildPreview(updated, proposalState)),
    });
  }

  async chat({ sessionId, text }) {
    const session = await this.requireSession(sessionId);
    const interpreted = await this.intelligence.interpretChangeRequest({ text });
    const stored = await this.loadProposalState(session);
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

    const proposalState = createBuilderProposalState({
      ...stored,
      specification: planned.nextSpecification,
      plan: null,
      dryRunResult: null,
      approval: null,
      change: planned,
      updatedAt: this.nowISO(),
    });

    const updated = await this.persistProposalState(session, proposalState, {
      conversation: withAssistant,
      currentStage: "awaiting_review",
      specificationId: planned.nextSpecification.specificationId,
      specificationContentHash: planned.nextSpecification.contentHash,
      installationPlanId: null,
      installationPlanHash: null,
    });

    this.installationRepository.saveSpecification({
      ...planned.nextSpecification,
      businessId: session.businessId ?? planned.nextSpecification.businessId,
    });

    return deepFreeze({
      ok: true,
      session: updated,
      proposal: clientSafeProposalView(this.buildPreview(updated, proposalState)),
      specification: planned.nextSpecification,
      changeImpact: {
        kind: interpreted.kind,
        label: interpreted.kind.replace(/_/g, " "),
        requiresDryRun: true,
        requiresApproval: true,
        previousHash: planned.previousHash,
        nextHash: planned.nextSpecification.contentHash,
        explanation: `This would ${interpreted.kind.replace(/_/g, " ")}. Nothing is installed until you dry run and approve.`,
        risk: "medium",
        affectedAreas: ["proposal", "navigation", "permissions", "workforce"].filter(Boolean),
      },
    });
  }

  async dryRun({ sessionId }) {
    const session = await this.requireSession(sessionId);
    const stored = await this.loadProposalState(session);
    if (!stored?.specification) return deepFreeze({ ok: false, reason: "proposal_required" });

    const compiled = this.compiler.compile(stored.specification, { nowISO: this.nowISO() });
    if (!compiled.ok) return compiled;

    const businessId = await this.ensurePlatformBusinessId(session, stored);
    const dry = this.installer.dryRun({
      specification: { ...stored.specification, businessId },
      plan: compiled.plan,
      businessId,
      nowISO: this.nowISO(),
    });

    const proposalState = createBuilderProposalState({
      ...stored,
      plan: compiled.plan,
      dryRunResult: dry,
      approval: null,
      updatedAt: this.nowISO(),
    });

    const updated = await this.persistProposalState(session, proposalState, {
      currentStage: dry.ok ? "dry_run_ready" : "blocked",
      installationPlanId: compiled.plan.planId,
      installationPlanHash: compiled.plan.planHash,
      businessId,
    });

    return deepFreeze({
      ok: dry.ok,
      session: updated,
      plan: compiled.plan,
      dryRunResult: dry,
      checklist: buildDryRunChecklist({
        plan: compiled.plan,
        dryRunResult: dry,
        specification: stored.specification,
      }),
      progressSteps: [
        "Creating your workspaces",
        "Configuring roles",
        "Installing digital employees",
        "Preparing dashboards",
        "Checking integrations",
      ],
      approvalInvalidated: false,
    });
  }

  async approve({ sessionId, actorId = null }) {
    const session = await this.requireSession(sessionId);
    const stored = await this.loadProposalState(session);
    if (!stored?.specification || !stored?.plan || !stored?.dryRunResult?.ok) {
      return deepFreeze({ ok: false, reason: "dry_run_required" });
    }

    const businessId = session.businessId ?? `draft_${session.sessionId}`;
    const approval = createBusinessOSInstallationApproval({
      approvalId: `appr_${session.sessionId}_${stored.specification.contentHash.slice(0, 8)}`,
      businessId,
      specificationId: stored.specification.specificationId,
      specificationVersion: stored.specification.version,
      specificationContentHash: stored.specification.contentHash,
      planId: stored.plan.planId,
      planHash: stored.plan.planHash,
      approvedByUserId: actorId ?? session.actorId ?? "builder_actor",
      approvedAt: this.nowISO(),
    });

    this.installationRepository.saveApproval(approval);

    const proposalState = createBuilderProposalState({
      ...stored,
      approval,
      updatedAt: this.nowISO(),
    });
    const updated = await this.persistProposalState(session, proposalState, {
      currentStage: "awaiting_approval",
      businessId,
    });

    return deepFreeze({ ok: true, session: updated, approval });
  }

  async install({
    sessionId,
    approved = false,
    actorId = null,
    failAtOperationId = null,
  }) {
    const session = await this.requireSession(sessionId);
    let stored = await this.loadProposalState(session);
    if (!stored?.specification || !stored?.plan || !stored?.dryRunResult) {
      return deepFreeze({ ok: false, reason: "dry_run_required" });
    }

    if (!stored.approval) {
      if (!approved) return deepFreeze({ ok: false, reason: "approval_required" });
      const approvedResult = await this.approve({ sessionId, actorId });
      if (!approvedResult.ok) return approvedResult;
      stored = await this.loadProposalState(await this.requireSession(sessionId));
    }

    const businessId = await this.ensurePlatformBusinessId(session, stored);
    this.hydrateInstallationRepository(businessId, stored);

    const installing = withBuilderSessionPatch(session, { currentStage: "installing" });
    await this.repository.save(installing);

    const installed = this.installer.install({
      specification: { ...stored.specification, businessId },
      plan: stored.plan,
      businessId,
      dryRunResult: stored.dryRunResult,
      approval: stored.approval,
      actorUserId: actorId ?? session.actorId,
      nowISO: this.nowISO(),
      failAtOperationId,
    });

    const proposalState = createBuilderProposalState({
      ...stored,
      installation: installed.installation ?? stored.installation,
      updatedAt: this.nowISO(),
    });

    const updated = await this.persistProposalState(installing, proposalState, {
      currentStage: installed.ok ? "installed" : "failed",
      businessId,
    });

    return deepFreeze({
      ok: installed.ok,
      session: updated,
      installation: installed,
      openHref: installed.ok ? `/b/${businessId}/home` : null,
    });
  }

  async resumeInstall({ sessionId, actorId = null, failAtOperationId = null }) {
    const session = await this.requireSession(sessionId);
    const stored = await this.loadProposalState(session);
    if (!stored?.approval) {
      return deepFreeze({ ok: false, reason: "approval_required" });
    }
    return this.install({
      sessionId,
      approved: true,
      actorId: actorId ?? session.actorId,
      failAtOperationId,
    });
  }

  async getProposal(sessionId) {
    const session = await this.requireSession(sessionId);
    const stored = await this.loadProposalState(session);
    if (!stored?.specification) {
      return deepFreeze({ ok: false, reason: "proposal_required" });
    }
    return deepFreeze({
      ok: true,
      session,
      specification: stored.specification,
      assemblyPlan: stored.assemblyPlan,
      plan: stored.plan,
      dryRunResult: stored.dryRunResult,
      approval: stored.approval,
      installation: stored.installation,
      proposal: this.buildPreview(session, stored),
    });
  }

  async seedProposalState({ sessionId, specification, assemblyPlan = null, extraMetadata = {} }) {
    const session = await this.requireSession(sessionId);
    const proposalState = createBuilderProposalState({
      specification,
      assemblyPlan: assemblyPlan ?? { selectedBlueprints: [], selectedComponents: [], capabilityGaps: [] },
      updatedAt: this.nowISO(),
    });
    const updated = await this.persistProposalState(session, proposalState, {
      currentStage: session.currentStage,
      specificationId: specification.specificationId,
      specificationContentHash: specification.contentHash,
      metadata: {
        ...session.metadata,
        ...extraMetadata,
      },
    });
    this.installationRepository.saveSpecification({
      ...specification,
      businessId: session.businessId ?? specification.businessId,
    });
    return deepFreeze({ ok: true, session: updated, proposalState });
  }

  buildPreview(session, proposalState) {
    if (!proposalState?.specification) return null;
    return buildVisualBusinessOSProposal({
      session,
      specification: proposalState.specification,
      assemblyPlan: proposalState.assemblyPlan,
      businessId: session.businessId ?? "preview",
    });
  }

  async loadProposalState(session) {
    const sessionId = session.sessionId;
    if (this.proposals.has(sessionId)) {
      return createBuilderProposalState(this.proposals.get(sessionId));
    }
    const durable = readProposalStateFromSession(session);
    if (durable) {
      this.proposals.set(sessionId, durable);
      this.hydrateInstallationRepository(session.businessId ?? `draft_${sessionId}`, durable);
      return durable;
    }
    return null;
  }

  async persistProposalState(session, proposalState, patch = {}) {
    const nextState = createBuilderProposalState(proposalState);
    const metadataPatch = patch.metadata
      ? withProposalStateMetadata({ metadata: patch.metadata }, nextState)
      : withProposalStateMetadata(session, nextState);
    const { metadata: _ignored, ...rest } = patch;
    const updated = withBuilderSessionPatch(session, {
      ...rest,
      metadata: metadataPatch,
    });
    await this.repository.save(updated);
    this.proposals.set(updated.sessionId, nextState);
    return updated;
  }

  hydrateInstallationRepository(businessId, proposalState) {
    if (!proposalState) return;
    if (proposalState.specification) {
      this.installationRepository.saveSpecification({
        ...proposalState.specification,
        businessId: businessId ?? proposalState.specification.businessId,
      });
    }
    if (proposalState.dryRunResult) {
      this.installationRepository.saveDryRun(proposalState.dryRunResult);
    }
    if (proposalState.approval) {
      this.installationRepository.saveApproval(proposalState.approval);
    }
    if (proposalState.installation) {
      this.installationRepository.saveInstallation(proposalState.installation);
      for (const checkpoint of proposalState.installation.actionCheckpoints ?? []) {
        this.installationRepository.saveOperationCheckpoint(businessId, checkpoint);
      }
    }
  }

  /**
   * Ensure install lands on a real platform business UUID (required for invites/memberships).
   */
  async ensurePlatformBusinessId(session, stored) {
    const existingId = session.businessId && !String(session.businessId).startsWith("draft_")
      ? String(session.businessId)
      : null;
    const name = String(
      session.businessName
        ?? stored?.specification?.businessName
        ?? stored?.specification?.name
        ?? "New Business",
    ).trim() || "New Business";

    if (this.platformStore?.getBusinessById && this.platformStore?.createBusiness) {
      if (existingId) {
        const row = await this.platformStore.getBusinessById(existingId);
        if (row) return existingId;
        const created = await this.platformStore.createBusiness({ id: existingId, name });
        return String(created.id);
      }
      const created = await this.platformStore.createBusiness({ name });
      return String(created.id);
    }

    return existingId ?? `draft_${session.sessionId}`;
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

function latestResearchFindings(session) {
  const evidence = [...(session?.evidence ?? [])].reverse().find((entry) => (
    entry.kind === "website"
    || entry.kind === "website_research"
    || entry.source === "website"
    || entry.source === "fixture"
    || entry.source === "manual_fallback"
    || entry.payload?.findings
  ));
  if (!evidence) return null;
  const report = evidence.payload?.report ?? evidence.payload ?? {};
  const findings = report.findings ?? evidence.payload?.findings ?? {};
  return {
    companyIdentity: findings.companyIdentity ?? null,
    services: findings.services ?? [],
    locations: findings.locations ?? [],
    terminology: findings.terminology ?? [],
    teamMembers: findings.teamMembers ?? [],
    contactMethods: findings.contactMethods ?? [],
    customerTypes: findings.customerTypes ?? [],
    confidence: findings.confidence ?? report.confidence ?? "medium",
    sourceUrl: report.sourceUrl ?? evidence.sourceUrl ?? null,
    confirmationStatus: evidence.payload?.confirmationStatus ?? "pending",
  };
}

function latestUploads(session) {
  return (session?.evidence ?? [])
    .filter((entry) => entry.kind === "upload" || entry.source === "upload")
    .map((entry) => ({
      artifactId: entry.payload?.extracted?.artifactId ?? entry.evidenceId,
      filename: entry.label,
      classification: entry.payload?.extracted?.classification ?? "unknown",
      plannedUse: entry.payload?.mapping?.action ?? entry.payload?.mapping?.destination ?? "review",
      destination: entry.payload?.mapping?.destination ?? "review",
      confirmed: Boolean(entry.payload?.mapping?.confirmed),
      mutatesCanonicalData: entry.mutatesCanonicalData === true,
    }));
}
