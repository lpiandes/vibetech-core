import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderSession, withBuilderSessionPatch } from "./BuilderSession.js";
import { BuilderSessionRepository } from "./BuilderSessionRepository.js";
import { BusinessDiscoveryEngine } from "./BusinessDiscoveryEngine.js";
import {
  createBuilderConversationMessage,
  appendConversation,
} from "./BuilderConversation.js";
import { getDefaultBuilderIntelligenceProvider } from "./BuilderIntelligenceProvider.js";
import { compileResponsibilityOperatingContract } from "./responsibility/compileResponsibilityOperatingContract.js";
import { pruneUnresolvedForLeanClarify } from "./responsibility/extractResponsibilityRequests.js";

/**
 * Durable AI Builder session orchestration façade.
 * Extends — does not replace — Business OS compiler/installer foundations.
 */
export class BuilderSessionService {
  constructor({
    repository = new BuilderSessionRepository(),
    discoveryEngine = null,
    intelligence = getDefaultBuilderIntelligenceProvider(),
    nowISO = () => new Date().toISOString(),
  } = {}) {
    this.repository = repository;
    this.intelligence = intelligence;
    this.discoveryEngine = discoveryEngine ?? new BusinessDiscoveryEngine({ intelligence });
    this.nowISO = nowISO;
  }

  async startSession({
    mode = "client_self_service",
    businessId = null,
    actorId = null,
    businessName = null,
    websiteUrl = null,
    description = null,
    purchasedPackages = null,
  } = {}) {
    const now = this.nowISO();
    const initial = this.discoveryEngine.initialPrompt();
    const scopedPackages = Array.isArray(purchasedPackages) ? purchasedPackages : [];
    let session = createBuilderSession({
      mode,
      businessId,
      actorId,
      currentStage: "discovering",
      businessSummary: {
        businessName,
        description,
        ...(scopedPackages.length ? { purchasedPackages: scopedPackages } : {}),
      },
      websiteUrls: websiteUrl ? [websiteUrl] : [],
      appearance: {
        accentColor: "#0F766E",
        businessName,
        dashboardDensity: "comfortable",
      },
      conversation: [
        createBuilderConversationMessage({
          messageId: `msg_assistant_welcome_${Date.parse(now)}`,
          role: "assistant",
          text: initial.text,
          at: now,
          metadata: { why: initial.why },
        }),
      ],
      progress: {
        percent: 0,
        label: "Getting started",
        readyForProposal: false,
      },
      createdAt: now,
      updatedAt: now,
    });

    if (description && String(description).trim()) {
      const applied = await this.discoveryEngine.applyAnswer(session, {
        questionId: "q_tell_us",
        answer: description,
        nowISO: now,
      });
      session = withBuilderSessionPatch(session, {
        ...applied,
        currentStage: "interviewing",
        conversation: appendConversation(applied.conversation, createBuilderConversationMessage({
          messageId: `msg_assistant_next_${Date.parse(now)}`,
          role: "assistant",
          text: applied.nextQuestions[0]?.prompt ?? "Thanks — a few more details will help.",
          at: now,
          relatedQuestionId: applied.nextQuestions[0]?.questionId ?? null,
        })),
      }, { updatedAt: now });
    }

    const questions = this.discoveryEngine.nextQuestions(session, { limit: 4 });
    session = withBuilderSessionPatch(session, { questions }, { updatedAt: now });
    await this.repository.save(session);

    return deepFreeze({
      ok: true,
      session,
      nextQuestions: questions,
      progress: session.progress,
      initialPrompt: initial,
    });
  }

  async getSession(sessionId) {
    return this.repository.get(sessionId);
  }

  async answer({
    sessionId,
    questionId,
    answer,
    skipped = false,
    unknown = false,
  }) {
    const existing = await this.repository.get(sessionId);
    if (!existing) return deepFreeze({ ok: false, reason: "session_not_found" });

    const now = this.nowISO();
    const applied = await this.discoveryEngine.applyAnswer(existing, {
      questionId,
      answer,
      skipped,
      unknown,
      nowISO: now,
    });

    const nextQuestions = applied.nextQuestions;
    const awaitingReview = Boolean(applied.awaitingResponsibilityReview);
    const assistantText = applied.progress.readyForProposal
      ? "I have enough to recommend how your business should run."
      : awaitingReview
        ? "Here is what I heard you want VIBETech to operate. Confirm, edit, or add before we ask implementation questions."
      : (nextQuestions[0]?.prompt ?? "Thanks — that helps.");

    const conversation = appendConversation(applied.conversation, createBuilderConversationMessage({
      messageId: `msg_assistant_${questionId}_${Date.parse(now)}`,
      role: "assistant",
      text: assistantText,
      at: now,
      relatedQuestionId: nextQuestions[0]?.questionId ?? null,
      metadata: nextQuestions[0]
        ? { why: nextQuestions[0].why }
        : awaitingReview
          ? { responsibilityReview: true }
          : {},
    }));

    const session = withBuilderSessionPatch(existing, {
      answers: applied.answers,
      businessSummary: applied.businessSummary,
      assumptions: applied.assumptions,
      unresolvedQuestions: applied.unresolvedQuestions,
      progress: applied.progress,
      conversation,
      questions: nextQuestions,
      responsibilityRequests: applied.responsibilityRequests ?? existing.responsibilityRequests ?? [],
      responsibilityInventoryConfirmed: Boolean(
        applied.responsibilityInventoryConfirmed ?? existing.responsibilityInventoryConfirmed,
      ),
      currentStage: applied.progress.readyForProposal ? "assembling" : "interviewing",
      appearance: {
        ...existing.appearance,
        businessName: applied.businessSummary.businessName ?? existing.appearance.businessName,
      },
    }, { updatedAt: now });

    await this.repository.save(session);
    return deepFreeze({
      ok: true,
      session,
      nextQuestions,
      progress: session.progress,
      summary: applied.summary,
      awaitingResponsibilityReview: awaitingReview,
    });
  }

  async confirmResponsibilityInventory({
    sessionId,
    responsibilityRequests = null,
    confirmed = true,
  } = {}) {
    const existing = await this.repository.get(sessionId);
    if (!existing) return deepFreeze({ ok: false, reason: "session_not_found" });
    const now = this.nowISO();
    let requests = Array.isArray(responsibilityRequests)
      ? responsibilityRequests
      : (existing.responsibilityRequests ?? []);
    if (confirmed) {
      requests = pruneUnresolvedForLeanClarify(
        requests
          .filter((r) => String(r.status) !== "removed")
          .map((r) => ({
            ...r,
            status: String(r.status) === "pending_review" || String(r.status) === "draft"
              ? "confirmed"
              : r.status,
            updatedAt: now,
          })),
        { maxQuestions: 3 },
      );
    }
    const industry = String(existing.businessSummary?.industry ?? "other");
    const compiledContracts = confirmed
      ? requests.map((request) => {
        try {
          return compileResponsibilityOperatingContract({ request, industry });
        } catch {
          return null;
        }
      }).filter(Boolean)
      : (existing.metadata?.compiledResponsibilityContracts ?? []);
    let session = withBuilderSessionPatch(existing, {
      responsibilityRequests: requests,
      responsibilityInventoryConfirmed: Boolean(confirmed),
      currentStage: "interviewing",
      metadata: {
        ...(existing.metadata ?? {}),
        compiledResponsibilityContracts: compiledContracts,
      },
    }, { updatedAt: now });
    const progress = this.discoveryEngine.completeness.evaluate({
      answers: session.answers,
      businessSummary: session.businessSummary,
      responsibilityInventoryConfirmed: Boolean(session.responsibilityInventoryConfirmed),
      responsibilityRequests: session.responsibilityRequests ?? [],
    });
    const nextQuestions = progress.readyForProposal
      ? []
      : this.discoveryEngine.nextQuestions(session, { limit: 3 });
    session = withBuilderSessionPatch(session, {
      questions: nextQuestions,
      progress,
      currentStage: progress.readyForProposal ? "assembling" : "interviewing",
      conversation: appendConversation(session.conversation, createBuilderConversationMessage({
        messageId: `msg_assistant_resp_confirm_${Date.parse(now)}`,
        role: "assistant",
        text: confirmed
          ? (nextQuestions[0]?.prompt ?? "Got it — building from what you confirmed.")
          : "OK — edit the list and confirm when it matches what you want VIBETech to operate.",
        at: now,
        relatedQuestionId: nextQuestions[0]?.questionId ?? null,
      })),
    }, { updatedAt: now });
    await this.repository.save(session);
    return deepFreeze({
      ok: true,
      session,
      nextQuestions,
      progress: session.progress,
    });
  }

  async listForBusiness(businessId) {
    return this.repository.listForBusiness(businessId);
  }

  async listAll() {
    return this.repository.listAll();
  }

  /**
   * Archive stale terminal sessions so businesses can keep listing recent work.
   * Does not delete — preserves audit via stage change.
   */
  async archiveStaleSessions({
    businessId = null,
    olderThanDays = 90,
    nowISO = new Date().toISOString(),
  } = {}) {
    const sessions = businessId
      ? await this.repository.listForBusiness(businessId)
      : await this.repository.listAll();
    const cutoffMs = Date.parse(nowISO) - (Number(olderThanDays) * 24 * 60 * 60 * 1000);
    const archived = [];
    for (const session of sessions) {
      if (session.currentStage === "archived") continue;
      const terminal = ["installed", "failed", "blocked"].includes(String(session.currentStage));
      if (!terminal) continue;
      const stamp = Date.parse(session.updatedAt ?? session.createdAt ?? nowISO);
      if (!Number.isFinite(stamp) || stamp > cutoffMs) continue;
      const next = await this.repository.save({
        ...session,
        currentStage: "archived",
        metadata: {
          ...session.metadata,
          archivedAt: nowISO,
          archivedReason: "stale_terminal_session",
        },
        updatedAt: nowISO,
      });
      archived.push(next);
    }
    return deepFreeze(archived);
  }
}
