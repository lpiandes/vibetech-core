import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  getDefaultArchitectChangeCapabilityRegistry,
} from "./change-capabilities/ArchitectChangeCapabilityRegistry.js";
import { registerDefaultArchitectChangeCapabilities } from "./change-capabilities/registerDefaultArchitectChangeCapabilities.js";

/**
 * Interprets NL change requests via the Architect Change Capability Registry.
 * Compatibility façade — no keyword ladder in the live path.
 */
export class BuilderChangeInterpreter {
  constructor({
    registry = null,
  } = {}) {
    this.registry = registry ?? getDefaultArchitectChangeCapabilityRegistry();
    registerDefaultArchitectChangeCapabilities({ registry: this.registry });
  }

  async interpret(text, context = {}) {
    const match = this.registry.match(text, context);
    if (match.status === "matched") {
      return deepFreeze({
        kind: match.legacyKind ?? match.capabilityId,
        capabilityId: match.capabilityId,
        status: "matched",
        confidence: match.confidence,
        evidence: match.evidence,
        text,
      });
    }
    if (match.status === "ambiguous") {
      return deepFreeze({
        kind: "ambiguous",
        status: "ambiguous",
        confidence: 0.5,
        candidates: match.candidates,
        text,
      });
    }
    return deepFreeze({
      kind: "generic_change",
      status: "unsupported",
      capabilityId: null,
      confidence: 0.2,
      text,
      reason: match.reason,
    });
  }
}
