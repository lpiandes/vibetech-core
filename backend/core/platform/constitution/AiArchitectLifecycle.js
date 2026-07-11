import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * AI Architect reasoning lifecycle — propose before install; improve after operate.
 */
export const AI_ARCHITECT_LIFECYCLE = Object.freeze([
  "discovery",
  "research",
  "evidence",
  "business_dna",
  "reasoning",
  "business_os",
  "preview",
  "dry_run",
  "approval",
  "install",
  "operate",
  "improve",
]);

const ALLOWED_TRANSITIONS = deepFreeze({
  discovery: ["research", "evidence", "business_dna"],
  research: ["evidence", "discovery"],
  evidence: ["business_dna", "research", "discovery"],
  business_dna: ["reasoning"],
  reasoning: ["business_os", "business_dna"],
  business_os: ["preview", "reasoning"],
  preview: ["dry_run", "business_os", "reasoning"],
  dry_run: ["approval", "preview", "business_os"],
  approval: ["install", "dry_run", "preview"],
  install: ["operate", "dry_run"],
  operate: ["improve"],
  improve: ["discovery", "reasoning", "business_os", "preview"],
});

export function isArchitectStage(stage) {
  return AI_ARCHITECT_LIFECYCLE.includes(String(stage));
}

export function validateLifecycleTransition({ from, to } = {}) {
  if (!isArchitectStage(from) || !isArchitectStage(to)) {
    return deepFreeze({ ok: false, reason: "unknown_stage" });
  }
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to) && from !== to) {
    return deepFreeze({
      ok: false,
      reason: "illegal_transition",
      from,
      to,
      allowed,
    });
  }
  return deepFreeze({ ok: true, from, to });
}

export function requireGovernedInstallPath(stagesCompleted = []) {
  const required = ["preview", "dry_run", "approval", "install"];
  const missing = required.filter((stage) => !stagesCompleted.includes(stage));
  return deepFreeze({
    ok: missing.length === 0,
    missing,
    rule: "Propose → Explain → Preview → Dry Run → Approve → Install",
  });
}
