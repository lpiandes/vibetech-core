/**
 * Free public-text extractors for prospecting (snippets / titles only).
 * Never invent phones or emails — only pattern-match what already appears in text.
 */

const PHONE_RE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Reject obvious non-phones (year ranges, ids, etc.). */
function looksLikePhone(digits) {
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith("1")) return true;
  return false;
}

export function normalizePhoneDisplay(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!looksLikePhone(digits)) return null;
  const ten = digits.length === 11 ? digits.slice(1) : digits;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/**
 * @param {string} text
 * @returns {string[]} unique normalized phones
 */
export function extractPhonesFromText(text) {
  const raw = String(text ?? "");
  const matches = raw.match(PHONE_RE) ?? [];
  const out = [];
  const seen = new Set();
  for (const m of matches) {
    const display = normalizePhoneDisplay(m);
    if (!display) continue;
    const key = display.replace(/\D/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}

/**
 * @param {string} text
 * @returns {string[]} unique lowercase emails (skips image/asset junk)
 */
export function extractEmailsFromText(text) {
  const raw = String(text ?? "");
  const matches = raw.match(EMAIL_RE) ?? [];
  const out = [];
  const seen = new Set();
  for (const m of matches) {
    const email = String(m).trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(email)) continue;
    if (/^(noreply|no-reply|donotreply)@/i.test(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Pull free contact fields from one or more public text blobs.
 * @returns {{
 *   phone: { value: string, confidence: string, source: string, verified: boolean }|null,
 *   email: { value: string, confidence: string, source: string, verified: boolean }|null,
 * }}
 */
export function extractPublicContactFields(texts = [], { source = "serper_snippet" } = {}) {
  const blob = (Array.isArray(texts) ? texts : [texts]).map((t) => String(t ?? "")).join("\n");
  const phones = extractPhonesFromText(blob);
  const emails = extractEmailsFromText(blob);
  return {
    phone: phones[0]
      ? { value: phones[0], confidence: "medium", source, verified: false }
      : null,
    email: emails[0]
      ? { value: emails[0], confidence: "medium", source, verified: false }
      : null,
  };
}

/**
 * Lead qualifies only with phone + name + brief.
 */
export function qualifiesProspectLead({ phone, name, overview } = {}) {
  const phoneValue = typeof phone === "object" ? phone?.value : phone;
  const hasPhone = Boolean(String(phoneValue ?? "").replace(/\D/g, "").length >= 10);
  const hasName = Boolean(String(name ?? "").trim());
  const hasBrief = Boolean(String(overview ?? "").trim());
  return hasPhone && hasName && hasBrief;
}
