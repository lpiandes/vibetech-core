/**
 * One-line Home glance for an operating responsibility.
 * Generic — no vertical hardcoding. Shortens process chains and "Runs:" dumps.
 */

const CHAIN_SPLIT = /\s*(?:→|->|=>|»)\s*|\s+then\s+/i;
const MAX_LEN = 100;

function clip(text, max = MAX_LEN) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1))}…`;
}

function summarizeProcessChain(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const parts = text.split(CHAIN_SPLIT).map((part) => part.trim()).filter(Boolean);
  const trigger = parts[0] || text;
  const head = clip(
    trigger.replace(/^\w/, (c) => c.toUpperCase()),
    52,
  );
  const hasOutbound = /\b(email|e-mail|sms|text|send|notify|call)\b/i.test(text);
  const suffix = hasOutbound
    ? "Drafts for your review before anything sends."
    : "Drafts work for your review.";
  return `${head}. ${suffix}`;
}

function stripRunsDump(text) {
  const value = String(text ?? "").trim();
  const match = value.match(/^Runs:\s*(.+?)(?:\.\s*Drafts work for review.*)?$/is);
  if (!match) return null;
  return summarizeProcessChain(match[1]);
}

/**
 * @param {{
 *   purpose?: string | null,
 *   responsibility?: string | null,
 *   role?: string | null,
 *   description?: string | null,
 * }} [emp]
 * @returns {string}
 */
export function presentTeammateHomeGlance(emp = {}) {
  const candidates = [emp.purpose, emp.responsibility, emp.role, emp.description]
    .map((entry) => String(entry ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!candidates.length) return "Operating responsibility";

  // Prefer a short, non-dump line when the primary purpose is a full playbook.
  let text = candidates[0];
  if (text.length > MAX_LEN || /^Runs:/i.test(text)) {
    const shorter = candidates.find((entry) => (
      entry.length <= MAX_LEN
      && !/^Runs:/i.test(entry)
      && !CHAIN_SPLIT.test(entry)
    ));
    if (shorter) text = shorter;
  }

  const fromRuns = stripRunsDump(text);
  if (fromRuns) return clip(fromRuns, MAX_LEN);

  if (CHAIN_SPLIT.test(text) && text.length > 72) {
    return clip(summarizeProcessChain(text), MAX_LEN);
  }

  // Drop redundant trailing approval boilerplate when the line is already long.
  if (text.length > MAX_LEN) {
    text = text
      .replace(/\s*[—-]\s*nothing sends without you\.?$/i, ".")
      .replace(/\s*[—-]\s*drafts first,?\s*approval before send\.?$/i, ".")
      .replace(/\s*Drafts work for review[^.]*\.?$/i, ".")
      .replace(/\s*Email\/SMS need your approval before send\.?$/i, "")
      .trim();
  }

  return clipAtWord(text, MAX_LEN) || "Operating responsibility";
}

function clipAtWord(text, max = MAX_LEN) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (value.length <= max) return value;
  const slice = value.slice(0, Math.max(1, max - 1));
  const cut = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("—"), slice.lastIndexOf("-"));
  const base = cut >= Math.floor(max * 0.55) ? slice.slice(0, cut) : slice;
  return `${base.replace(/[\s—,-]+$/, "")}…`;
}

/**
 * Short purpose stored on compiled discovery workflows (source of truth for new hires).
 */
export function presentCompiledWorkflowPurpose(workflowText, trigger = null) {
  const fromTrigger = String(trigger?.summary ?? "").trim();
  const head = fromTrigger
    || String(workflowText ?? "").split(CHAIN_SPLIT)[0]?.trim()
    || "When this runs";
  return clip(
    `${head.replace(/^\w/, (c) => c.toUpperCase())}. Drafts for your review before anything sends.`,
    MAX_LEN,
  );
}
