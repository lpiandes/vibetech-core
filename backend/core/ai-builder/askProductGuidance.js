/**
 * Product-aware Ask guidance that should not depend on LLM classification.
 * Keeps how-to answers pointed at real surfaces (Automations builder), not
 * generic Architect change-capability templates.
 */

export const AUTOMATION_HOWTO_REPLY = [
  "To change an automation in VIBETech:",
  "1. Open Automations in the left nav (or open the operating responsibility from Team).",
  "2. Select the teammate whose path you want to edit.",
  "3. Edit the steps on the path canvas, or type a change in the AI Assistant panel",
  "   (for example: \"Add an SMS step\" or \"When a pipeline stage changes, draft an email\") and click Apply.",
  "4. Review the updated path, then save. Outbound email/SMS still needs your approval before anything sends.",
  "",
  "Ask can propose Business OS changes, but teammate automation paths are edited on that Automations page — not by inventing a separate \"update workflow\" recommendation here.",
].join("\n");

function normalizeBlob(parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join("\n");
}

export function recentAskTurns(session, limit = 6) {
  const conversation = Array.isArray(session?.conversation) ? session.conversation : [];
  return conversation.slice(-Math.max(1, limit)).map((message) => ({
    role: String(message?.role ?? "user"),
    text: String(message?.text ?? "").slice(0, 500),
  }));
}

/**
 * True when the owner is asking how/where to edit automations (including vague
 * follow-ups that only make sense with prior automation context).
 */
export function isAutomationHowToRequest({ text = "", session = null } = {}) {
  const turns = recentAskTurns(session);
  const blob = normalizeBlob([
    ...turns.map((turn) => turn.text),
    text,
  ]);
  if (!/\b(automation|automations|automation path|workflow path)\b/.test(blob)) {
    return false;
  }

  const latest = String(text ?? "").toLowerCase();
  if (/\b(how|where|what)\b/.test(latest) || /\?/.test(latest)) return true;
  if (/\b(make sense|didn'?t make|doesn'?t make|confused|help me|show me|explain)\b/.test(latest)) {
    return true;
  }

  // "change it" after an automation how-to turn — still product guidance.
  const priorHowTo = turns.some((turn) => {
    const t = String(turn.text ?? "").toLowerCase();
    return (
      /\b(automation|automations|workflow)\b/.test(t)
      && (/\b(how|where)\b/.test(t) || /\?/.test(t))
    );
  });
  if (
    priorHowTo
    && /\b(change|edit|update|modify)\s+(it|that|this|the automation)\b/.test(latest)
  ) {
    return true;
  }
  return false;
}

export function automationHowToReply() {
  return {
    kind: "conversational_reply",
    status: "reply",
    confidence: 1,
    reply: AUTOMATION_HOWTO_REPLY,
    source: "product_guidance",
  };
}
