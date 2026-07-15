/**
 * Shared guards for owner-facing business identity copy.
 * Prevents throwaway chat answers ("ok", "yes") from becoming the company name.
 */

const JUNK_TOKENS = new Set([
  "ok",
  "okay",
  "yes",
  "y",
  "no",
  "n",
  "idk",
  "n/a",
  "na",
  "none",
  "test",
  "asdf",
  "foo",
  "bar",
  "...",
  ".",
  "-",
]);

export function isUsableBusinessName(value) {
  const text = String(value ?? "").trim();
  if (text.length < 2) return false;
  const lower = text.toLowerCase();
  if (JUNK_TOKENS.has(lower)) return false;
  if (/^(ok|okay|yes|no)([!.]?)$/i.test(text)) return false;
  if (/^[\d\W_]+$/.test(text)) return false;
  return true;
}

export function isUsableIndustry(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!text || text.length < 3) return false;
  if (JUNK_TOKENS.has(text)) return false;
  return true;
}

export function resolveBusinessDisplayName(...candidates) {
  for (const candidate of candidates) {
    if (isUsableBusinessName(candidate)) return String(candidate).trim();
  }
  return "Your business";
}

export function resolveIndustryLabel(value, fallback = "general") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const normalized = raw.toLowerCase().replace(/\s+/g, "_");
  if (!isUsableIndustry(normalized)) return fallback;
  return normalized;
}

/** Owner-facing industry words for sentences ("home health", not "ok"). */
export function resolveIndustryDisplayLabel(value, fallback = "this business") {
  const label = resolveIndustryLabel(value, "");
  if (!label || label === "general" || label === "default") {
    return fallback;
  }
  return label.replace(/_/g, " ");
}

/**
 * Scrub junk identity tokens and internal builder jargon from owner-facing copy.
 * e.g. "Specialize reusable Coordinator archetype for ok — never invent..." → readable purpose.
 */
export function scrubOwnerFacingPurpose(text, {
  businessName = null,
  industry = null,
  roleLabel = null,
} = {}) {
  let out = String(text ?? "").trim();
  if (!out) {
    const who = isUsableBusinessName(businessName) ? String(businessName).trim() : "this business";
    const role = roleLabel ? String(roleLabel).trim() : "This teammate";
    return `${role} helps run ${who}.`;
  }

  const industryLabel = resolveIndustryDisplayLabel(industry, "");
  const name = isUsableBusinessName(businessName) ? String(businessName).trim() : "";
  const forTarget = industryLabel && industryLabel !== "this business"
    ? industryLabel
    : (name || "this business");

  out = out.replace(/\bfor\s+(ok|okay|yes|y|no|n|idk|n\/a|na|none|test|asdf|foo|bar)\b/gi, `for ${forTarget}`);
  out = out.replace(/\s*—\s*never invent a ['']?one-off['']? agent\.?/gi, "");
  out = out.replace(/^Specialize reusable\s+/i, "");
  out = out.replace(/\s+archetype\b/gi, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  out = out.replace(/\s+—\s*$/g, "").trim();

  // If scrubbing left thin engineer residue, fall back to a clear purpose.
  if (!out || /^for\s/i.test(out) || out.length < 12) {
    const role = roleLabel ? String(roleLabel).trim() : "This teammate";
    const who = name || forTarget;
    return `${role} helps run ${who}.`;
  }

  // Capitalize first letter for display.
  return out.charAt(0).toUpperCase() + out.slice(1);
}
