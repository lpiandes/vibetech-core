import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  getDefaultArchitectChangeCapabilityRegistry,
} from "./change-capabilities/ArchitectChangeCapabilityRegistry.js";
import { registerDefaultArchitectChangeCapabilities } from "./change-capabilities/registerDefaultArchitectChangeCapabilities.js";
import {
  automationHowToReply,
  isAutomationHowToRequest,
} from "./askProductGuidance.js";
import { filterAskCapabilitiesForPurchasedPackages } from "../platform/packages/SalesPackageCatalog.js";

/**
 * Provider boundary for optional AI assistance.
 * Deterministic interpretation delegates to the Architect Change Capability Registry.
 * Keyword ladders are not the live product path.
 */
export class BuilderIntelligenceProvider {
  async refineAnswer() {
    throw new Error("BuilderIntelligenceProvider: refineAnswer not implemented.");
  }

  async interpretChangeRequest() {
    throw new Error("BuilderIntelligenceProvider: interpretChangeRequest not implemented.");
  }
}

export class DeterministicBuilderIntelligenceProvider extends BuilderIntelligenceProvider {
  constructor({ registry = null } = {}) {
    super();
    this.registry = registry ?? getDefaultArchitectChangeCapabilityRegistry();
    registerDefaultArchitectChangeCapabilities({ registry: this.registry });
  }

  async refineAnswer({ interpreted }) {
    return deepFreeze(interpreted);
  }

  async interpretChangeRequest({ text, session = null } = {}) {
    if (isAutomationHowToRequest({ text, session })) {
      return deepFreeze(automationHowToReply());
    }
    const purchasedPackages = session?.businessSummary?.purchasedPackages ?? [];
    const match = this.registry.match(text);
    if (match.status === "matched") {
      const allowed = filterAskCapabilitiesForPurchasedPackages(
        [{ capabilityId: match.capabilityId }],
        purchasedPackages,
      );
      if (!allowed.length) {
        return deepFreeze({
          kind: "generic_change",
          status: "unsupported",
          confidence: 0.2,
          text,
          reason: "outside_purchased_packages",
          reply: "That change isn’t included in the packages purchased for this business. Ask your admin to add a package, or try something in your current scope.",
        });
      }
      return deepFreeze({
        kind: match.legacyKind ?? match.capabilityId,
        capabilityId: match.capabilityId,
        confidence: match.confidence,
        evidence: match.evidence,
        text,
      });
    }
    if (match.status === "ambiguous") {
      const candidates = filterAskCapabilitiesForPurchasedPackages(
        (match.candidates ?? []).map((entry) => (
          typeof entry === "string" ? { capabilityId: entry } : entry
        )),
        purchasedPackages,
      );
      if (!candidates.length) {
        return deepFreeze({
          kind: "generic_change",
          status: "unsupported",
          confidence: 0.2,
          text,
          reason: "outside_purchased_packages",
        });
      }
      return deepFreeze({
        kind: "ambiguous",
        status: "ambiguous",
        candidates,
        confidence: 0.5,
        text,
      });
    }
    return deepFreeze({
      kind: "generic_change",
      status: "unsupported",
      confidence: 0.2,
      text,
      reason: match.reason,
    });
  }
}

/**
 * Optional AI provider — uses OpenAI when enabled; always falls back to deterministic.
 */
export class OptionalAIBuilderIntelligenceProvider extends DeterministicBuilderIntelligenceProvider {
  constructor({ enabled = false, client = null, registry = null } = {}) {
    super({ registry });
    this.enabled = Boolean(enabled);
    this.client = client;
  }

  async refineAnswer(input) {
    if (!this.enabled || !this.client) {
      return super.refineAnswer(input);
    }
    try {
      const refined = await this.client.refineAnswer?.(input);
      return refined ? deepFreeze(refined) : super.refineAnswer(input);
    } catch {
      return super.refineAnswer(input);
    }
  }

  async extractFromFreeText(input) {
    if (!this.enabled || !this.client?.extractFromFreeText) return null;
    try {
      return await this.client.extractFromFreeText(input);
    } catch {
      return null;
    }
  }

  async proposeNextDiscoveryQuestions(input) {
    if (!this.enabled || !this.client?.proposeNextDiscoveryQuestions) return null;
    try {
      return await this.client.proposeNextDiscoveryQuestions(input);
    } catch {
      return null;
    }
  }

  async interpretChangeRequest({ text, session = null, specification = null } = {}) {
    if (isAutomationHowToRequest({ text, session })) {
      return deepFreeze(automationHowToReply());
    }
    if (this.enabled && this.client?.interpretChangeRequest) {
      try {
        const llm = await this.client.interpretChangeRequest({ text, session, specification });
        if (llm?.capabilityId || llm?.status === "reply" || llm?.reply) {
          return deepFreeze(llm);
        }
      } catch {
        /* fall through */
      }
    }
    return super.interpretChangeRequest({ text, session });
  }
}

export function getDefaultBuilderIntelligenceProvider() {
  return new DeterministicBuilderIntelligenceProvider();
}
