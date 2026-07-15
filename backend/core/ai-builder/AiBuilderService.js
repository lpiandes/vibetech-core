import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BuilderSessionService } from "./BuilderSessionService.js";
import { BuilderSessionRepository } from "./BuilderSessionRepository.js";
import { BuilderAssemblyPlanner } from "./BuilderAssemblyPlanner.js";
import { BuilderSpecificationAssembler } from "./BuilderSpecificationAssembler.js";
import { buildVisualBusinessOSProposal } from "./VisualBusinessOSProposal.js";
import { BusinessWebsiteResearchService } from "./BusinessWebsiteResearchService.js";
import { mergePlanAdditions, parseOwnerPlanAdditions } from "./parseOwnerPlanAdditions.js";
import { applyPlanAdditionsToSpecification } from "./applyPlanAdditionsToSpecification.js";
import { normalizeWebsiteUrl } from "./WebsiteFetchPolicy.js";
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
import { BuilderChangeProposalService } from "./BuilderChangeProposalService.js";
import { isUsableBusinessName, resolveBusinessDisplayName } from "./businessIdentity.js";
import { withAutoAskTitle } from "./askConversationTitle.js";
import {
  createBuilderConversationMessage,
  appendConversation,
} from "./BuilderConversation.js";
import {
  buildIntelligenceCandidateArchitectBrief,
  formatArchitectCandidateReply,
} from "../business-intelligence/conversion/IntelligenceArchitectExplanation.js";
import { explainCandidateMemory } from "../business-intelligence/memory/BusinessMemoryTimeline.js";
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
    changeProposalService = null,
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
    this.changeProposalService = changeProposalService
      ?? new BuilderChangeProposalService({ changePlanner });
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

  async archiveStaleSessions(input = {}) {
    const archived = await this.sessionService.archiveStaleSessions(input);
    return deepFreeze({ ok: true, archivedCount: archived.length, sessions: archived });
  }

  /** Owner removes a past Ask conversation from history. */
  async archiveSession({ sessionId }) {
    const session = await this.repository.get(sessionId);
    if (!session) {
      return deepFreeze({ ok: true, alreadyGone: true, sessionId: String(sessionId) });
    }
    if (String(session.currentStage) === "archived") {
      return deepFreeze({ ok: true, session });
    }
    try {
      const updated = withBuilderSessionPatch(session, {
        currentStage: "archived",
        metadata: {
          ...(session.metadata ?? {}),
          archivedAt: this.nowISO(),
          archivedReason: "owner_removed",
        },
      }, { updatedAt: this.nowISO() });
      await this.repository.save(updated);
      this.proposals.delete(String(sessionId));
      return deepFreeze({ ok: true, session: updated });
    } catch (error) {
      // Never fail the owner delete path over lifecycle edge cases — force-archive via repository.
      const forced = {
        ...session,
        currentStage: "archived",
        metadata: {
          ...(session.metadata ?? {}),
          archivedAt: this.nowISO(),
          archivedReason: "owner_removed_forced",
          archiveError: error instanceof Error ? error.message : String(error),
        },
        updatedAt: this.nowISO(),
      };
      await this.repository.save(forced);
      this.proposals.delete(String(sessionId));
      return deepFreeze({ ok: true, session: forced, forced: true });
    }
  }

  async persistChatSession(session) {
    const titled = (() => {
      const next = withAutoAskTitle(session);
      if (next === session) return session;
      return withBuilderSessionPatch(session, {
        metadata: next.metadata,
      }, { updatedAt: this.nowISO() });
    })();
    await this.repository.save(titled);
    return titled;
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
    const incoming = websiteUrl ?? session.websiteUrls[0];
    const normalized = normalizeWebsiteUrl(incoming) || incoming;
    const result = await this.researchService.research({
      websiteUrl: normalized,
      approvedUrls: [
        ...session.websiteUrls,
        ...(normalized ? [normalized] : []),
        ...(incoming ? [incoming] : []),
      ].filter(Boolean),
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

  async updateAppearance({
    sessionId,
    accentColor = null,
    logoUrl = null,
    businessName = null,
    navigationOverrides = null,
    employeeOverrides = null,
    roleOverrides = null,
    sectionOverrides = null,
    planAdditions = null,
  }) {
    const session = await this.requireSession(sessionId);
    const appearance = {
      ...session.appearance,
      ...(accentColor ? { accentColor } : {}),
      ...(logoUrl != null ? { logoUrl } : {}),
      ...(businessName ? { businessName } : {}),
      ...(planAdditions ? {
        planAdditions: {
          modules: Array.isArray(planAdditions.modules) ? planAdditions.modules : (session.appearance?.planAdditions?.modules ?? []),
          employees: Array.isArray(planAdditions.employees) ? planAdditions.employees : (session.appearance?.planAdditions?.employees ?? []),
        },
      } : {}),
      ...(navigationOverrides ? {
        navigationOverrides: {
          ...(session.appearance?.navigationOverrides ?? {}),
          ...navigationOverrides,
          labels: {
            ...(session.appearance?.navigationOverrides?.labels ?? {}),
            ...(navigationOverrides.labels ?? {}),
          },
          hidden: {
            ...(session.appearance?.navigationOverrides?.hidden ?? {}),
            ...(navigationOverrides.hidden ?? {}),
          },
        },
      } : {}),
      ...(employeeOverrides ? {
        employeeOverrides: {
          ...(session.appearance?.employeeOverrides ?? {}),
          ...employeeOverrides,
          labels: {
            ...(session.appearance?.employeeOverrides?.labels ?? {}),
            ...(employeeOverrides.labels ?? {}),
          },
          purposes: {
            ...(session.appearance?.employeeOverrides?.purposes ?? {}),
            ...(employeeOverrides.purposes ?? {}),
          },
          hidden: {
            ...(session.appearance?.employeeOverrides?.hidden ?? {}),
            ...(employeeOverrides.hidden ?? {}),
          },
        },
      } : {}),
      ...(roleOverrides ? {
        roleOverrides: {
          ...(session.appearance?.roleOverrides ?? {}),
          ...roleOverrides,
          labels: {
            ...(session.appearance?.roleOverrides?.labels ?? {}),
            ...(roleOverrides.labels ?? {}),
          },
        },
      } : {}),
      ...(sectionOverrides ? {
        sectionOverrides: {
          ...(session.appearance?.sectionOverrides ?? {}),
          ...sectionOverrides,
        },
      } : {}),
    };
    const updated = withBuilderSessionPatch(session, { appearance });
    await this.repository.save(updated);
    const stored = await this.loadProposalState(updated);
    return deepFreeze({
      ok: true,
      session: updated,
      appearance,
      proposal: stored?.specification
        ? clientSafeProposalView(this.buildPreview(updated, stored))
        : null,
    });
  }

  /**
   * Owner "tell us what to change" — parse free-text adds + hide removals on the server
   * so the plan list updates even when the client can't import backend parsers.
   */
  async applyPlanChanges({
    sessionId,
    removeModuleIds = [],
    removeEmployeeIds = [],
    addRequest = "",
  }) {
    const session = await this.requireSession(sessionId);
    const removeModules = Array.isArray(removeModuleIds)
      ? removeModuleIds.map((id) => String(id)).filter(Boolean)
      : [];
    const removeEmployees = Array.isArray(removeEmployeeIds)
      ? removeEmployeeIds.map((id) => String(id)).filter(Boolean)
      : [];
    const parsed = parseOwnerPlanAdditions(addRequest);
    const existing = session.appearance?.planAdditions ?? { modules: [], employees: [] };
    let nextAdditions = mergePlanAdditions(existing, parsed);
    nextAdditions = {
      modules: nextAdditions.modules.filter((entry) => !removeModules.includes(String(entry?.id))),
      employees: nextAdditions.employees.filter((entry) => !removeEmployees.includes(String(entry?.id))),
    };

    const existingNav = session.appearance?.navigationOverrides ?? {};
    const existingEmp = session.appearance?.employeeOverrides ?? {};
    const hiddenModules = { ...(existingNav.hidden ?? {}) };
    for (const id of removeModules) hiddenModules[id] = true;
    const hiddenEmployees = { ...(existingEmp.hidden ?? {}) };
    for (const id of removeEmployees) hiddenEmployees[id] = true;

    return this.updateAppearance({
      sessionId,
      navigationOverrides: {
        ...existingNav,
        hidden: hiddenModules,
      },
      employeeOverrides: {
        ...existingEmp,
        hidden: hiddenEmployees,
      },
      planAdditions: nextAdditions,
    });
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
    const progress = this.sessionService.discoveryEngine.completeness.evaluate({
      answers: session.answers,
      businessSummary: session.businessSummary,
    });
    if (!progress.readyForProposal) {
      return deepFreeze({
        ok: false,
        reason: "discovery_incomplete",
        progress,
        message: "A few more questions are needed before a recommendation.",
        nextQuestions: this.sessionService.discoveryEngine.nextQuestions(session, { limit: 3 }),
      });
    }
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

  async chat({ sessionId, text, stack = null }) {
    const session = await this.requireSession(sessionId);
    const stored = await this.loadProposalState(session);

    const candidateSnapshot = session.metadata?.candidateSnapshot
      ?? stored?.metadata?.candidateSnapshot
      ?? null;
    const intelligenceCandidateId = session.metadata?.intelligenceCandidateId
      ?? candidateSnapshot?.id
      ?? null;
    if (intelligenceCandidateId && isIntelligenceAttentionQuestion(text)) {
      const candidate = candidateSnapshot
        ?? stack?.intelligenceCandidateRuntime?.getCandidate?.(intelligenceCandidateId)
        ?? null;
      const memory = explainCandidateMemory({
        candidate,
        workRuntime: stack?.workRuntime ?? null,
      });
      const brief = buildIntelligenceCandidateArchitectBrief({ candidate, stack, memory });
      const reply = formatArchitectCandidateReply(brief);
      const conversation = appendConversation(session.conversation, createBuilderConversationMessage({
        messageId: `msg_user_intel_${Date.now()}`,
        role: "user",
        text,
      }));
      const withAssistant = appendConversation(conversation, createBuilderConversationMessage({
        messageId: `msg_assistant_intel_${Date.now()}`,
        role: "assistant",
        text: reply,
      }));
      const updated = withBuilderSessionPatch(session, { conversation: withAssistant });
      const saved = await this.persistChatSession(updated);
      return deepFreeze({
        ok: true,
        session: saved,
        intelligenceExplanation: true,
        brief,
        message: reply,
        inventedFacts: false,
      });
    }

    // Pre-proposal: free-form discovery extraction (consultant mode).
    if (!stored?.specification) {
      const now = this.nowISO();
      const applied = await this.sessionService.discoveryEngine.applyFreeText(session, {
        text,
        nowISO: now,
      });
      const updated = withBuilderSessionPatch(session, {
        answers: applied.answers,
        businessSummary: applied.businessSummary,
        assumptions: applied.assumptions,
        unresolvedQuestions: applied.unresolvedQuestions,
        progress: applied.progress,
        conversation: applied.conversation,
        questions: applied.nextQuestions,
        currentStage: applied.progress?.readyForProposal ? "assembling" : "interviewing",
      }, { updatedAt: now });
      const saved = await this.persistChatSession(updated);
      return deepFreeze({
        ok: true,
        session: saved,
        discovery: true,
        extracted: applied.extracted,
        nextQuestions: applied.nextQuestions,
        journey: applied.progress,
        message: applied.extracted?.note ?? null,
      });
    }

    // Post-proposal: registry-driven change capabilities.
    const changeService = this.changeProposalService;
    if (changeService?.propose) {
      const pending = session.metadata?.pendingChange ?? null;
      const proposed = await changeService.propose({
        session,
        specification: stored.specification,
        text,
        priorValues: pending?.values ?? null,
        selectCapabilityId: pending?.capabilityId && pending?.status === "needs_information"
          ? pending.capabilityId
          : null,
        actorPermissions: ["business.manage"],
      });

      await this.recordArchitectAudit(session, "architect.change_interpreted", {
        status: proposed.status ?? (proposed.ok ? "matched" : "failed"),
        capabilityId: proposed.capabilityId ?? null,
      });

      if (proposed.status === "needs_information") {
        await this.recordArchitectAudit(session, "architect.change_needs_information", {
          capabilityId: proposed.capabilityId,
          missing: (proposed.missing ?? []).map((field) => field.id),
        });
        const conversation = appendConversation(session.conversation, createBuilderConversationMessage({
          messageId: `msg_user_change_${Date.now()}`,
          role: "user",
          text,
        }));
        const question = proposed.questions?.[0]
          ?? proposed.missing?.[0]?.prompt
          ?? "I need one more detail before I can propose that change.";
        const withAssistant = appendConversation(conversation, createBuilderConversationMessage({
          messageId: `msg_assistant_need_${Date.now()}`,
          role: "assistant",
          text: question,
        }));
        const updated = withBuilderSessionPatch(session, {
          conversation: withAssistant,
          metadata: {
            ...session.metadata,
            pendingChange: {
              status: "needs_information",
              capabilityId: proposed.capabilityId,
              values: proposed.values ?? {},
              missing: proposed.missing ?? [],
              summary: proposed.summary,
            },
          },
        }, { updatedAt: this.nowISO() });
        const saved = await this.persistChatSession(updated);
        return deepFreeze({
          ok: true,
          status: "needs_information",
          session: saved,
          missing: proposed.missing,
          questions: proposed.questions,
          changeImpact: {
            kind: proposed.legacyKind ?? proposed.capabilityId,
            label: "Need a bit more detail",
            requiresDryRun: false,
            requiresApproval: false,
            explanation: question,
            risk: "low",
            affectedAreas: [],
          },
        });
      }

      if (proposed.status === "ambiguous") {
        await this.recordArchitectAudit(session, "architect.change_ambiguous", {
          candidates: (proposed.candidates ?? []).map((entry) => entry.capabilityId),
        });
        const conversation = appendConversation(session.conversation, createBuilderConversationMessage({
          messageId: `msg_user_change_${Date.now()}`,
          role: "user",
          text,
        }));
        const options = (proposed.candidates ?? [])
          .map((entry, index) => `${index + 1}. ${entry.title}`)
          .join("\n");
        const withAssistant = appendConversation(conversation, createBuilderConversationMessage({
          messageId: `msg_assistant_amb_${Date.now()}`,
          role: "assistant",
          text: `${proposed.message ?? "I found more than one possible change."}\n${options}`,
        }));
        const updated = withBuilderSessionPatch(session, {
          conversation: withAssistant,
          metadata: {
            ...session.metadata,
            pendingChange: {
              status: "ambiguous",
              candidates: proposed.candidates ?? [],
              summary: proposed.summary,
            },
          },
        }, { updatedAt: this.nowISO() });
        const saved = await this.persistChatSession(updated);
        return deepFreeze({
          ok: true,
          status: "ambiguous",
          session: saved,
          candidates: proposed.candidates,
          changeImpact: {
            kind: "ambiguous",
            label: "Clarify the change",
            requiresDryRun: false,
            requiresApproval: false,
            explanation: proposed.message,
            risk: "low",
            affectedAreas: [],
          },
        });
      }

      if (proposed.status === "unsupported" || proposed.ok === false && proposed.status === "unsupported") {
        await this.recordArchitectAudit(session, "architect.change_unsupported", {
          reason: proposed.reason ?? null,
        });
        if (proposed.gapHint && this.platformStore?.upsertBusinessCapabilityProposal && session.businessId) {
          await this.platformStore.upsertBusinessCapabilityProposal({
            id: `gap_${session.sessionId}_${Date.now()}`,
            businessId: session.businessId,
            proposalId: `arch_gap_${Date.now()}`,
            requestedOutcome: proposed.gapHint.requestedOutcome ?? text,
            evidence: [{ source: "architect_chat", text }],
            whyInsufficient: proposed.reason ?? "unsupported_architect_capability",
            status: "proposed",
            createdByUserId: session.actorId,
          }).catch(() => null);
        }
        const conversation = appendConversation(session.conversation, createBuilderConversationMessage({
          messageId: `msg_user_change_${Date.now()}`,
          role: "user",
          text,
        }));
        const withAssistant = appendConversation(conversation, createBuilderConversationMessage({
          messageId: `msg_assistant_unsup_${Date.now()}`,
          role: "assistant",
          text: `I understood: ${proposed.summary ?? text}. ${proposed.recommendation ?? "That change is not supported yet."} Nothing was changed.`,
        }));
        const updated = withBuilderSessionPatch(session, {
          conversation: withAssistant,
          metadata: {
            ...session.metadata,
            pendingChange: null,
            lastUnsupportedChange: {
              summary: proposed.summary,
              reason: proposed.reason,
            },
          },
        }, { updatedAt: this.nowISO() });
        const saved = await this.persistChatSession(updated);
        return deepFreeze({
          ok: true,
          status: "unsupported",
          session: saved,
          unsupported: true,
          changeImpact: {
            kind: "unsupported",
            label: "Not supported yet",
            requiresDryRun: false,
            requiresApproval: false,
            explanation: proposed.recommendation ?? "Unsupported change — nothing was modified.",
            risk: "low",
            affectedAreas: [],
          },
        });
      }

      if (proposed?.ok) {
        const kind = proposed.request?.interpreted?.kind
          ?? proposed.impact?.kind
          ?? proposed.capabilityId
          ?? "generic_change";
        const conversation = appendConversation(session.conversation, createBuilderConversationMessage({
          messageId: `msg_user_change_${Date.now()}`,
          role: "user",
          text,
        }));
        const withAssistant = appendConversation(conversation, createBuilderConversationMessage({
          messageId: `msg_assistant_change_${Date.now()}`,
          role: "assistant",
          text: proposed.impact?.explanation
            ?? `Proposed change: ${String(kind).replace(/_/g, " ")}. Dry run and approval are required before install.`,
        }));
        const nextSpec = proposed.nextSpecification ?? stored.specification;
        const proposalState = createBuilderProposalState({
          ...stored,
          specification: nextSpec,
          plan: null,
          dryRunResult: null,
          approval: null,
          change: proposed,
          updatedAt: this.nowISO(),
        });
        const titledMeta = withAutoAskTitle({
          ...session,
          conversation: withAssistant,
          metadata: {
            ...session.metadata,
            pendingChange: null,
            lastChangeRequest: proposed.request ?? proposed,
            lastMutationPlan: proposed.mutationPlan ?? null,
            lastChangeSideEffects: proposed.sideEffects ?? [],
          },
        }).metadata;
        const updated = await this.persistProposalState(session, proposalState, {
          conversation: withAssistant,
          currentStage: "awaiting_review",
          specificationId: nextSpec.specificationId,
          specificationContentHash: nextSpec.contentHash,
          installationPlanId: null,
          installationPlanHash: null,
          metadata: titledMeta,
        });
        this.installationRepository.saveSpecification({
          ...nextSpec,
          businessId: session.businessId ?? nextSpec.businessId,
        });
        await this.recordArchitectAudit(session, "architect.change_proposed", {
          kind,
          capabilityId: proposed.capabilityId ?? null,
          mutationPlanId: proposed.mutationPlan?.planId ?? null,
        });
        return deepFreeze({
          ok: true,
          status: "matched",
          session: updated,
          proposal: clientSafeProposalView(this.buildPreview(updated, proposalState)),
          specification: nextSpec,
          changeImpact: {
            kind,
            label: String(kind).replace(/_/g, " "),
            requiresDryRun: true,
            requiresApproval: true,
            explanation: proposed.impact?.explanation
              ?? `This would ${String(kind).replace(/_/g, " ")}. Nothing is installed until you review launch readiness and approve.`,
            risk: proposed.impact?.risk ?? "medium",
            affectedAreas: proposed.impact?.affectedAreas ?? ["proposal"],
            warnings: proposed.warnings ?? [],
            capabilityId: proposed.capabilityId ?? null,
          },
        });
      }
    }

    return deepFreeze({
      ok: false,
      reason: "change_proposal_unavailable",
      message: "Architect could not build a governed change proposal.",
    });
  }

  async recordArchitectAudit(session, action, metadata = {}) {
    if (!this.platformStore?.recordAuditEvent) return null;
    const safe = { ...metadata };
    delete safe.password;
    delete safe.token;
    delete safe.secret;
    delete safe.documentBody;
    return this.platformStore.recordAuditEvent({
      actorUserId: session.actorId,
      businessId: session.businessId,
      action,
      targetType: "builder_session",
      targetId: session.sessionId,
      metadata: safe,
    }).catch(() => null);
  }

  async dryRun({ sessionId }) {
    const session = await this.requireSession(sessionId);
    const stored = await this.loadProposalState(session);
    if (!stored?.specification) return deepFreeze({ ok: false, reason: "proposal_required" });

    const specification = applyPlanAdditionsToSpecification(stored.specification, session);

    // Already live — never regress session stage; return checklist for review only.
    if (String(session.currentStage) === "installed") {
      let plan = stored.plan;
      if (!plan) {
        const compiled = this.compiler.compile(specification, { nowISO: this.nowISO() });
        if (!compiled.ok) return compiled;
        plan = compiled.plan;
      }
      const dry = stored.dryRunResult?.ok
        ? stored.dryRunResult
        : deepFreeze({
          ok: true,
          mutated: false,
          simulatedOperations: plan?.actions ?? plan?.operations ?? [],
          readiness: { ok: true, warnings: [], blocking: [] },
        });
      return deepFreeze({
        ok: true,
        alreadyInstalled: true,
        session,
        plan,
        dryRunResult: dry,
        checklist: buildDryRunChecklist({
          plan,
          dryRunResult: dry,
          specification,
        }),
        openHref: session.businessId ? `/b/${session.businessId}/home` : null,
        progressSteps: [
          "Creating your workspaces",
          "Configuring roles",
          "Preparing AI teammates",
          "Preparing home screens",
          "Checking connections",
        ],
        approvalInvalidated: false,
      });
    }

    const compiled = this.compiler.compile(specification, { nowISO: this.nowISO() });
    if (!compiled.ok) return compiled;

    const businessId = await this.ensurePlatformBusinessId(session, stored);
    const dry = this.installer.dryRun({
      specification: { ...specification, businessId },
      plan: compiled.plan,
      businessId,
      nowISO: this.nowISO(),
    });

    // Do not wipe an existing approval if dry-run is a re-check before install.
    const proposalState = createBuilderProposalState({
      ...stored,
      specification,
      plan: compiled.plan,
      dryRunResult: dry,
      approval: dry.ok ? stored.approval : null,
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
        specification,
      }),
      progressSteps: [
        "Creating your workspaces",
        "Configuring roles",
        "Preparing AI teammates",
        "Preparing home screens",
        "Checking connections",
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

    await this.recordArchitectAudit(updated, "architect.change_approved", {
      specificationContentHash: stored.specification.contentHash,
      planHash: stored.plan.planHash,
      capabilityId: session.metadata?.lastChangeRequest?.capabilityId
        ?? session.metadata?.lastChangeRequest?.interpreted?.capabilityId
        ?? null,
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

    // Already live — idempotent success (reloading /install must not re-enter installing).
    if (String(session.currentStage) === "installed" && session.businessId) {
      const storedInstalled = await this.loadProposalState(session);
      return deepFreeze({
        ok: true,
        alreadyInstalled: true,
        session,
        installation: storedInstalled?.installation ?? { ok: true },
        openHref: `/b/${session.businessId}/home`,
      });
    }

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
    await this.syncPlatformBusinessName({ session, stored, businessId });
    await this.syncPlatformIndustryPackage({ session, stored, businessId });
    this.hydrateInstallationRepository(businessId, stored);

    // Re-apply owner plan edits; if they changed the installable spec, re-dry-run + re-bind approval.
    let specification = applyPlanAdditionsToSpecification(stored.specification, session);
    let plan = stored.plan;
    let dryRunResult = stored.dryRunResult;
    let approval = stored.approval;
    const specChanged = String(specification?.contentHash ?? "") !== String(stored.specification?.contentHash ?? "")
      || (specification?.employeeDefinitions?.length ?? 0) !== (stored.specification?.employeeDefinitions?.length ?? 0);

    if (specChanged) {
      const compiled = this.compiler.compile(specification, { nowISO: this.nowISO() });
      if (!compiled.ok) return compiled;
      plan = compiled.plan;
      dryRunResult = this.installer.dryRun({
        specification: { ...specification, businessId },
        plan,
        businessId,
        nowISO: this.nowISO(),
      });
      if (!dryRunResult?.ok) {
        return deepFreeze({
          ok: false,
          reason: "dry_run_required",
          dryRunResult,
          checklist: buildDryRunChecklist({ plan, dryRunResult, specification }),
        });
      }
      approval = createBusinessOSInstallationApproval({
        approvalId: `appr_${session.sessionId}_${String(specification.contentHash ?? "plan").slice(0, 8)}`,
        businessId,
        specificationId: specification.specificationId,
        specificationVersion: specification.version,
        specificationContentHash: specification.contentHash,
        planId: plan.planId,
        planHash: plan.planHash,
        approvedByUserId: actorId ?? session.actorId ?? "builder_actor",
        approvedAt: this.nowISO(),
      });
      this.installationRepository.saveApproval(approval);
    }

    const installing = withBuilderSessionPatch(session, { currentStage: "installing" });
    await this.repository.save(installing);
    await this.recordArchitectAudit(installing, "architect.change_execution_started", {
      businessId,
      planId: plan?.planId ?? null,
    });

    const installed = this.installer.install({
      specification: { ...specification, businessId },
      plan,
      businessId,
      dryRunResult,
      approval,
      actorUserId: actorId ?? session.actorId,
      nowISO: this.nowISO(),
      failAtOperationId,
    });

    const proposalState = createBuilderProposalState({
      ...stored,
      specification,
      plan,
      dryRunResult,
      approval,
      installation: installed.installation ?? stored.installation,
      updatedAt: this.nowISO(),
    });

    const updated = await this.persistProposalState(installing, proposalState, {
      currentStage: installed.ok ? "installed" : "failed",
      businessId,
      installationPlanId: plan?.planId,
      installationPlanHash: plan?.planHash,
    });

    if (installed.ok) {
      await this.persistCanonicalBusinessOS({
        businessId,
        specification: { ...specification, businessId },
        plan,
        installation: installed.installation ?? proposalState.installation,
        actorUserId: actorId ?? session.actorId,
      });
      await this.executeChangeSideEffects({
        session: updated,
        sideEffects: session.metadata?.lastChangeSideEffects ?? [],
        actorId: actorId ?? session.actorId,
        businessId,
      });
      await this.recordArchitectAudit(updated, "architect.change_executed", {
        businessId,
        installationId: installed.installation?.installationId ?? null,
      });
    } else {
      await this.recordArchitectAudit(updated, "architect.change_failed", {
        businessId,
        reason: installed.reason ?? "install_failed",
      });
    }

    return deepFreeze({
      ok: installed.ok,
      session: updated,
      installation: installed,
      openHref: installed.ok ? `/b/${businessId}/home` : null,
    });
  }

  async resumeInstall({ sessionId, actorId = null, failAtOperationId = null }) {
    const session = await this.requireSession(sessionId);
    if (String(session.currentStage) === "installed" && session.businessId) {
      return deepFreeze({
        ok: true,
        alreadyInstalled: true,
        session,
        installation: { ok: true },
        openHref: `/b/${session.businessId}/home`,
      });
    }
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
    const name = this.resolveInstallBusinessName(session, stored);

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

  resolveInstallBusinessName(session, stored) {
    return resolveBusinessDisplayName(
      session?.businessSummary?.businessName,
      session?.appearance?.businessName,
      session?.businessName,
      stored?.specification?.businessProfile?.businessName,
      stored?.specification?.businessName,
      stored?.specification?.name,
      "New Business",
    );
  }

  /**
   * Keep the platform business record aligned with the approved discovery name.
   * Existing businesses (e.g. magna mare) previously kept their create-time name forever.
   */
  async syncPlatformBusinessName({ session, stored, businessId }) {
    if (!businessId || String(businessId).startsWith("draft_")) return null;
    if (typeof this.platformStore?.updateBusinessName !== "function") return null;
    const nextName = this.resolveInstallBusinessName(session, stored);
    if (!isUsableBusinessName(nextName) || nextName === "Your business" || nextName === "New Business") {
      return null;
    }
    const current = await this.platformStore.getBusinessById?.(businessId);
    if (current?.name && String(current.name).trim().toLowerCase() === nextName.toLowerCase()) {
      return current;
    }
    return this.platformStore.updateBusinessName({ businessId, name: nextName });
  }

  /**
   * Align industry package with the approved OS industry.
   * Marketing / universal installs must not keep pkg_property_management active.
   */
  async syncPlatformIndustryPackage({ session, stored, businessId }) {
    if (!businessId || String(businessId).startsWith("draft_")) return null;
    if (typeof this.platformStore?.updateBusinessIndustryPackage !== "function") return null;
    const industry = String(
      stored?.specification?.businessProfile?.industry
      ?? session?.businessSummary?.industry
      ?? "",
    ).toLowerCase().replace(/\s+/g, "_");
    const isProperty = industry === "property_management" || industry === "property" || industry === "real_estate";
    const nextPackageId = isProperty ? "pkg_property_management" : null;
    const current = await this.platformStore.getBusinessById?.(businessId);
    if ((current?.industryPackageId ?? null) === nextPackageId) return current;
    return this.platformStore.updateBusinessIndustryPackage({
      businessId,
      industryPackageId: nextPackageId,
      industryPackageVersion: 1,
      packageConfiguration: isProperty ? (current?.packageConfiguration ?? {}) : {},
    });
  }

  /**
   * Post-approval side effects from mutation plans (governed invites / knowledge only).
   * Never sends customer communications. Invites use existing invitation delivery.
   */
  async executeChangeSideEffects({
    session,
    sideEffects = [],
    actorId = null,
    businessId,
  }) {
    if (!Array.isArray(sideEffects) || !sideEffects.length) return [];
    const results = [];
    for (const op of sideEffects) {
      if (op.operationType === "inviteMembership") {
        if (op.allowsExternalCommunication !== true) {
          results.push({ operationId: op.operationId, ok: false, reason: "external_communication_prohibited" });
          continue;
        }
        if (!this.platformStore || !businessId || String(businessId).startsWith("draft_")) {
          results.push({ operationId: op.operationId, ok: false, reason: "platform_invite_unavailable" });
          continue;
        }
        try {
          // Prefer existing store invitation helpers if present; otherwise record readiness only.
          if (typeof this.platformStore.createInvitation === "function") {
            await this.platformStore.createInvitation({
              businessId,
              email: op.payload?.email,
              role: String(op.payload?.role ?? "EMPLOYEE").toUpperCase(),
              invitedByUserId: actorId,
            });
          }
          results.push({ operationId: op.operationId, ok: true, kind: "inviteMembership" });
        } catch (err) {
          results.push({
            operationId: op.operationId,
            ok: false,
            reason: err instanceof Error ? err.message : "invite_failed",
          });
        }
        continue;
      }
      if (String(op.operationType).includes("Knowledge")) {
        // Knowledge body is never auto-published externally; readiness hint already on spec.
        results.push({
          operationId: op.operationId,
          ok: true,
          kind: op.operationType,
          allowsExternalCommunication: false,
        });
      }
    }
    return results;
  }

  /**
   * Write installed OS into canonical Postgres tables so Ask VIBETech / improve
   * can load truth after process restart without session metadata alone.
   */
  async persistCanonicalBusinessOS({
    businessId,
    specification,
    plan,
    installation,
    actorUserId = null,
  }) {
    if (!this.platformStore?.upsertBusinessOSSpecification || !this.platformStore?.upsertBusinessOSInstallation) {
      return null;
    }
    if (!businessId || String(businessId).startsWith("draft_")) {
      return null;
    }

    const specificationId = String(specification.specificationId);
    const specificationVersion = Number(
      specification.version ?? specification.specificationVersion ?? 1,
    );
    const contentHash = String(specification.contentHash);
    const specRowId = `bos_spec_${businessId}_${specificationId}_v${specificationVersion}`;
    const installId = String(
      installation?.installationId
        ?? `install_${businessId}_${specificationId}`,
    );
    const nowISO = this.nowISO();

    const specRow = await this.platformStore.upsertBusinessOSSpecification({
      id: specRowId,
      businessId,
      specificationId,
      specificationVersion,
      schemaVersion: Number(specification.schemaVersion ?? 1),
      status: "installed",
      contentHash,
      specification: { ...specification, businessId },
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    });

    const installRow = await this.platformStore.upsertBusinessOSInstallation({
      id: installId,
      businessId,
      specificationRowId: specRow?.id ?? specRowId,
      specificationId,
      specificationVersion,
      specificationContentHash: contentHash,
      planId: String(plan?.planId ?? installation?.planId ?? `plan_${businessId}`),
      status: String(installation?.status ?? "installed"),
      plan: plan ?? installation?.plan ?? {},
      actionCheckpoints: installation?.actionCheckpoints ?? [],
      configuration: installation?.configuration ?? {},
      history: installation?.history ?? [],
      actorUserId,
      installedAt: installation?.installedAt ?? nowISO,
    });

    if (this.platformStore.recordAuditEvent) {
      await this.platformStore.recordAuditEvent({
        actorUserId,
        businessId,
        action: "architect.installed",
        targetType: "business_os_installation",
        targetId: installRow?.id ?? installId,
        metadata: {
          specificationId,
          specificationVersion,
          contentHash,
        },
      });
    }

    return { specification: specRow, installation: installRow };
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

function isIntelligenceAttentionQuestion(text) {
  const normalized = String(text ?? "").toLowerCase();
  if (!normalized.trim()) return true;
  return /(what needs attention|why does this matter|what evidence|who owns|already being handled|what changed|what should we do|did we try|tried before|explain this|why|evidence|owner|next)/i
    .test(normalized);
}
