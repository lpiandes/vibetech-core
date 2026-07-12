import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  getDefaultArchitectChangeCapabilityRegistry,
} from "./change-capabilities/ArchitectChangeCapabilityRegistry.js";
import { registerDefaultArchitectChangeCapabilities } from "./change-capabilities/registerDefaultArchitectChangeCapabilities.js";

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

  async interpretChangeRequest({ text }) {
    const match = this.registry.match(text);
    if (match.status === "matched") {
      return deepFreeze({
        kind: match.legacyKind ?? match.capabilityId,
        capabilityId: match.capabilityId,
        confidence: match.confidence,
        evidence: match.evidence,
        text,
      });
    }
    if (match.status === "ambiguous") {
      return deepFreeze({
        kind: "ambiguous",
        status: "ambiguous",
        candidates: match.candidates,
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
 * Optional AI provider stub — must never be required for Builder operation.
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
}

export function getDefaultBuilderIntelligenceProvider() {
  return new DeterministicBuilderIntelligenceProvider();
}
