import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Provider boundary for optional AI assistance.
 * Deterministic provider keeps the Builder fully functional offline.
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
  async refineAnswer({ interpreted }) {
    return deepFreeze(interpreted);
  }

  async interpretChangeRequest({ text }) {
    const lower = String(text ?? "").toLowerCase();
    if (lower.includes("rename") && lower.includes("to")) {
      const match = String(text).match(/rename\s+(.+?)\s+to\s+(.+)/i);
      return deepFreeze({
        kind: "terminology_rename",
        from: match?.[1]?.trim() ?? null,
        to: match?.[2]?.trim() ?? null,
        confidence: 0.8,
      });
    }
    if (lower.includes("add") && (lower.includes("workspace") || lower.includes("module"))) {
      return deepFreeze({ kind: "add_module", text, confidence: 0.7 });
    }
    if (lower.includes("remove") && lower.includes("employee")) {
      return deepFreeze({ kind: "remove_employee", text, confidence: 0.7 });
    }
    if (lower.includes("access") || lower.includes("permission") || lower.includes("only managers")) {
      return deepFreeze({ kind: "permission_change", text, confidence: 0.7 });
    }
    if (lower.includes("newsletter") || lower.includes("campaign")) {
      return deepFreeze({ kind: "add_campaign", text, confidence: 0.7 });
    }
    if (lower.includes("approval")) {
      return deepFreeze({ kind: "add_approval", text, confidence: 0.7 });
    }
    if (lower.includes("workflow") || lower.includes("intake")) {
      return deepFreeze({ kind: "add_workflow", text, confidence: 0.65 });
    }
    return deepFreeze({ kind: "generic_change", text, confidence: 0.4 });
  }
}

/**
 * Optional AI provider stub — must never be required for Builder operation.
 */
export class OptionalAIBuilderIntelligenceProvider extends DeterministicBuilderIntelligenceProvider {
  constructor({ enabled = false, client = null } = {}) {
    super();
    this.enabled = Boolean(enabled);
    this.client = client;
  }

  async refineAnswer(input) {
    if (!this.enabled || !this.client) {
      return super.refineAnswer(input);
    }
    // Real AI clients may refine interpretation; failures fall back deterministically.
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
