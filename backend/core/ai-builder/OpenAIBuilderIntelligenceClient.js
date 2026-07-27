/**
 * OpenAI-backed builder / Ask intelligence.
 * Uses gpt-4o-mini by default via createLlmProvider; never throws to callers.
 */
import { createLlmProvider, llmIsLiveAvailable } from "../providers/createLlmProvider.js";
import {
  getDefaultArchitectChangeCapabilityRegistry,
} from "./change-capabilities/ArchitectChangeCapabilityRegistry.js";
import { registerDefaultArchitectChangeCapabilities } from "./change-capabilities/registerDefaultArchitectChangeCapabilities.js";
import {
  automationHowToReply,
  isAutomationHowToRequest,
  recentAskTurns,
} from "./askProductGuidance.js";
import { filterAskCapabilitiesForPurchasedPackages } from "../platform/packages/SalesPackageCatalog.js";

function parseJsonObject(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === "object") return direct;
  } catch {
    /* try fence extract */
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export class OpenAIBuilderIntelligenceClient {
  constructor({
    llmProvider = null,
    registry = null,
  } = {}) {
    this.llmProvider = llmProvider;
    this.registry = registry ?? getDefaultArchitectChangeCapabilityRegistry();
    registerDefaultArchitectChangeCapabilities({ registry: this.registry });
  }

  #provider() {
    return this.llmProvider || createLlmProvider({ preferLive: true });
  }

  isLive() {
    return llmIsLiveAvailable();
  }

  /**
   * Discovery: refine structured answer fields from free text.
   */
  async refineAnswer({ questionId, answer, interpreted, session } = {}) {
    if (!this.isLive()) return interpreted;
    const openQs = (session?.questions ?? []).slice(0, 8).map((q) => ({
      id: q.id ?? q.questionId,
      prompt: q.prompt ?? q.text,
    }));
    const prompt = [
      "You refine business discovery answers for an AI Business OS builder.",
      "Return JSON only: { fields: object, unknown: boolean, note: string, answeredQuestionIds: string[] }",
      "Only include fields you are confident about. Prefer short plain values.",
      `questionId: ${questionId ?? "free_text"}`,
      `userAnswer: ${String(answer ?? "").slice(0, 2000)}`,
      `currentInterpreted: ${JSON.stringify(interpreted ?? {})}`,
      `openQuestions: ${JSON.stringify(openQs)}`,
      `businessSummarySoFar: ${JSON.stringify(session?.businessSummary ?? {})}`,
    ].join("\n");

    try {
      const raw = await this.#provider().generate(prompt, { json: true, temperature: 0.1 });
      const parsed = parseJsonObject(raw);
      if (!parsed || typeof parsed !== "object") return interpreted;
      return {
        ...interpreted,
        fields: {
          ...(interpreted?.fields ?? {}),
          ...(parsed.fields && typeof parsed.fields === "object" ? parsed.fields : {}),
        },
        unknown: Boolean(parsed.unknown ?? interpreted?.unknown),
        note: parsed.note ?? interpreted?.note,
        answeredQuestionIds: Array.isArray(parsed.answeredQuestionIds)
          ? parsed.answeredQuestionIds.map(String)
          : interpreted?.answeredQuestionIds,
      };
    } catch {
      return interpreted;
    }
  }

  /**
   * Free-text discovery extraction enhancement.
   */
  async extractFromFreeText({ text, session } = {}) {
    if (!this.isLive()) return null;
    const prompt = [
      "Extract business OS discovery facts from the owner's message.",
      "Return JSON only: { fields: { businessName?, industry?, website?, services?, audience?, goals?, desiredOutcomes?, painPoints?, constraints?, teamSize?, location? }, note: string, answeredQuestionIds: string[] }",
      "Be thorough but do not invent facts not implied by the message.",
      `message: ${String(text ?? "").slice(0, 3000)}`,
      `summarySoFar: ${JSON.stringify(session?.businessSummary ?? {})}`,
    ].join("\n");
    try {
      const raw = await this.#provider().generate(prompt, { json: true, temperature: 0.1 });
      return parseJsonObject(raw);
    } catch {
      return null;
    }
  }

  /**
   * Specialize next discovery prompts using remaining bank question IDs only.
   * Returns BuilderQuestion-shaped objects (same ids as allowlist).
   */
  async proposeNextDiscoveryQuestions({
    session = null,
    remainingBank = [],
    answered = [],
    limit = 3,
  } = {}) {
    if (!this.isLive()) return null;
    const allowlist = (remainingBank ?? []).map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      why: q.why,
      topic: q.topic,
      required: q.required,
      answerType: q.answerType,
      options: q.options ?? [],
    }));
    if (!allowlist.length) return null;

    const prompt = [
      "You specialize discovery follow-ups for VIBETech AI Builder.",
      "The owner already bought specific packages (purchasedPackages). Stay inside that scope.",
      "If packageAsk is true, ONLY set up the newly added packages in packageAskPackages — do not re-ask identity or anything already covered.",
      "Diagnose this business from businessSummary + answered questions — any industry is valid (hockey club, dental, landscaping, church, agency, etc.).",
      "Do not assume sports or dental unless the owner said so. Rewrite prompts to use their words (teams, patients, clients, members…).",
      "Pick the best next questions from the allowlist only (do not invent questionIds).",
      "You may rewrite prompt and why so each question feels specific to this business and what they need.",
      "For q_integrations: keep the allowlist options as-is (already narrowed). Never add Meta, SMS, Ads, or Voice unless those options are in the allowlist.",
      "Ask only what is needed for the purchased / new packages — do not expand into unpurchased products.",
      "Return JSON only: { questions: [{ questionId, prompt, why }] }",
      `limit: ${Math.max(1, Number(limit) || 3)}`,
      `packageAsk: ${Boolean(session?.businessSummary?.packageAsk)}`,
      `packageAskPackages: ${JSON.stringify(session?.businessSummary?.packageAskPackages ?? [])}`,
      `purchasedPackages: ${JSON.stringify(session?.businessSummary?.purchasedPackages ?? [])}`,
      `businessSummary: ${JSON.stringify(session?.businessSummary ?? {})}`,
      `answeredQuestionIds: ${JSON.stringify((answered ?? []).map((a) => a.questionId))}`,
      `allowlist: ${JSON.stringify(allowlist)}`,
    ].join("\n");

    try {
      const raw = await this.#provider().generate(prompt, { json: true, temperature: 0.2 });
      const parsed = parseJsonObject(raw);
      const rows = Array.isArray(parsed?.questions) ? parsed.questions : [];
      const byId = new Map(allowlist.map((q) => [q.questionId, q]));
      const out = [];
      for (const row of rows) {
        const id = String(row?.questionId ?? "");
        const base = byId.get(id);
        if (!base) continue;
        out.push({
          ...base,
          prompt: String(row.prompt ?? base.prompt).slice(0, 500) || base.prompt,
          why: String(row.why ?? base.why).slice(0, 400) || base.why,
        });
        if (out.length >= Math.max(1, Number(limit) || 3)) break;
      }
      // Fill from allowlist order if LLM under-returned
      for (const q of allowlist) {
        if (out.length >= Math.max(1, Number(limit) || 3)) break;
        if (!out.some((x) => x.questionId === q.questionId)) out.push(q);
      }
      return out.length ? out : null;
    } catch {
      return null;
    }
  }

  /**
   * Continuous Ask: map NL to a change capability or a helpful reply.
   */
  async interpretChangeRequest({ text, session, specification } = {}) {
    if (isAutomationHowToRequest({ text, session })) {
      return automationHowToReply();
    }
    if (!this.isLive()) return null;
    const purchasedPackages = session?.businessSummary?.purchasedPackages ?? [];
    const caps = filterAskCapabilitiesForPurchasedPackages(
      this.registry.list({ enabledOnly: true }).slice(0, 40).map((c) => ({
        id: c.capabilityId,
        title: c.title,
        description: c.description,
      })),
      purchasedPackages,
    );
    const profile = specification?.businessProfile ?? session?.businessSummary ?? {};
    const recent = recentAskTurns(session, 6);
    const prompt = [
      "You are VIBETech Ask — the AI that helps owners improve their installed Business OS.",
      "Return JSON only with keys:",
      '  action: "capability" | "reply" | "unsupported"',
      "  capabilityId: string|null (must be from the list when action=capability)",
      "  values: object (extracted field values for the capability)",
      "  reply: string (owner-facing answer when action=reply)",
      "  confidence: number 0-1",
      "  summary: string",
      "Prefer capability only when they clearly want Ask to propose a Business OS change now",
      "(add teammate, module, profile/settings, rename terminology, knowledge, integrations).",
      "Use reply for questions, explanations, how-to, navigation, or status — do not invent installs.",
      "IMPORTANT product facts:",
      "- Teammate automations / automation paths are edited under Automations (or Team → open the AI teammate).",
      "- Owners change path steps on the path canvas or via that page's AI Assistant panel (Apply/Preview).",
      "- Do NOT map automation how-to questions to architect.change.update_workflow or rename terminology.",
      "- Do NOT invent capabilities that are not in the list.",
      "- Stay inside purchasedPackages scope — never expand into unpurchased products.",
      `purchasedPackages: ${JSON.stringify(purchasedPackages)}`,
      "Read recentConversation for follow-ups like \"that didn't make sense\" / \"change it\".",
      `capabilities: ${JSON.stringify(caps)}`,
      `business: ${JSON.stringify(profile)}`,
      `recentConversation: ${JSON.stringify(recent)}`,
      `ownerMessage: ${String(text ?? "").slice(0, 3000)}`,
    ].join("\n");

    try {
      const raw = await this.#provider().generate(prompt, { json: true, temperature: 0.15 });
      const parsed = parseJsonObject(raw);
      if (!parsed) return null;
      const action = String(parsed.action ?? "").toLowerCase();
      const capabilityId = parsed.capabilityId ? String(parsed.capabilityId) : null;
      const allowedIds = new Set(caps.map((c) => c.id));
      if (action === "capability" && capabilityId && this.registry.get(capabilityId) && allowedIds.has(capabilityId)) {
        // Guard: never let the model sneak automation how-to into a mutation capability.
        if (isAutomationHowToRequest({ text, session })) {
          return automationHowToReply();
        }
        return {
          kind: this.registry.get(capabilityId)?.legacyKindAliases?.[0] ?? capabilityId,
          capabilityId,
          confidence: Number(parsed.confidence ?? 0.8),
          values: parsed.values && typeof parsed.values === "object" ? parsed.values : {},
          evidence: ["openai_interpret"],
          text,
          summary: parsed.summary ?? null,
          source: "llm",
        };
      }
      if (action === "reply" && parsed.reply) {
        return {
          kind: "conversational_reply",
          status: "reply",
          confidence: Number(parsed.confidence ?? 0.7),
          reply: String(parsed.reply).slice(0, 4000),
          text,
          source: "llm",
        };
      }
      return {
        kind: "generic_change",
        status: "unsupported",
        confidence: Number(parsed.confidence ?? 0.3),
        text,
        reply: parsed.reply ? String(parsed.reply).slice(0, 4000) : null,
        source: "llm",
      };
    } catch {
      return null;
    }
  }
}
