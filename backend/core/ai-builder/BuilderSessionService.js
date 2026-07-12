import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderSession, withBuilderSessionPatch } from "./BuilderSession.js";
import { BuilderSessionRepository } from "./BuilderSessionRepository.js";
import { BusinessDiscoveryEngine } from "./BusinessDiscoveryEngine.js";
import {
  createBuilderConversationMessage,
  appendConversation,
} from "./BuilderConversation.js";
import { getDefaultBuilderIntelligenceProvider } from "./BuilderIntelligenceProvider.js";

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
  } = {}) {
    const now = this.nowISO();
    const initial = this.discoveryEngine.initialPrompt();
    let session = createBuilderSession({
      mode,
      businessId,
      actorId,
      currentStage: "discovering",
      businessSummary: {
        businessName,
        description,
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

    if (description) {
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
    const assistantText = applied.progress.readyForProposal
      ? "We have enough to propose your Business Operating System. You can still answer more, or review the proposal."
      : (nextQuestions[0]?.prompt ?? "Thanks — that helps.");

    const conversation = appendConversation(applied.conversation, createBuilderConversationMessage({
      messageId: `msg_assistant_${questionId}_${Date.parse(now)}`,
      role: "assistant",
      text: assistantText,
      at: now,
      relatedQuestionId: nextQuestions[0]?.questionId ?? null,
      metadata: nextQuestions[0] ? { why: nextQuestions[0].why } : {},
    }));

    const session = withBuilderSessionPatch(existing, {
      answers: applied.answers,
      businessSummary: applied.businessSummary,
      assumptions: applied.assumptions,
      unresolvedQuestions: applied.unresolvedQuestions,
      progress: applied.progress,
      conversation,
      questions: nextQuestions,
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
