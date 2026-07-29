/**
 * Free public-text extractors for prospecting (snippets / titles only).
 * Never invent phones or emails — only pattern-match what already appears in text.
 * When multiple are found, rank most relevant → least (no low/medium/high labels).
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
 * @returns {string[]} unique normalized phones (order of first appearance)
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

function hostnameFromUrl(url) {
  try {
    const raw = String(url ?? "").trim();
    if (!raw) return "";
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function emailDomain(email) {
  const at = String(email ?? "").indexOf("@");
  return at > 0 ? String(email).slice(at + 1).toLowerCase() : "";
}

/**
 * Score a phone occurrence for relevance (higher = better).
 */
export function scorePhoneCandidate({
  value,
  text = "",
  url = "",
  companyHost = "",
  geo = "",
} = {}) {
  let score = 0;
  const reasons = [];
  const blob = String(text ?? "");
  const host = hostnameFromUrl(url);
  const digits = String(value ?? "").replace(/\D/g, "");

  if (companyHost && host && (host === companyHost || host.endsWith(`.${companyHost}`))) {
    score += 40;
    reasons.push("on company site");
  }
  if (/contact|appointment|call|phone|tel|locations?/i.test(url)) {
    score += 25;
    reasons.push("contact page");
  }
  if (/\b(call|phone|tel|reach us|contact us|schedule)\b/i.test(blob)) {
    score += 20;
    reasons.push("near call/contact wording");
  }
  // Prefer numbers that appear more than once in the same blob
  const occurrences = (blob.match(new RegExp(digits.slice(-10).replace(/(\d)/g, "\\D*$1"), "g")) ?? []).length;
  if (occurrences >= 2) {
    score += 10;
    reasons.push("repeated in snippet");
  }
  // Soft geo hint: area code digits appearing near city mention is weak; skip inventing.
  if (geo && blob.toLowerCase().includes(String(geo).toLowerCase().slice(0, 6))) {
    score += 5;
    reasons.push("local listing");
  }
  // Penalize toll-free slightly vs local business lines (still keep them)
  if (/^1?(800|888|877|866|855|844|833)/.test(digits)) {
    score -= 8;
    reasons.push("toll-free");
  }

  return {
    score,
    reason: reasons[0] || "public listing",
  };
}

/**
 * Score an email for relevance (higher = better).
 */
export function scoreEmailCandidate({
  value,
  text = "",
  url = "",
  companyHost = "",
} = {}) {
  let score = 0;
  const reasons = [];
  const email = String(value ?? "").toLowerCase();
  const domain = emailDomain(email);
  const local = email.split("@")[0] || "";
  const host = hostnameFromUrl(url);
  const blob = String(text ?? "");

  if (companyHost && domain && (domain === companyHost || companyHost.endsWith(`.${domain}`) || domain.endsWith(`.${companyHost}`))) {
    score += 45;
    reasons.push("company domain");
  }
  if (/^(info|hello|contact|office|appointments?|frontdesk|admin|support)$/i.test(local)) {
    score += 25;
    reasons.push("general inbox");
  }
  if (companyHost && host && (host === companyHost || host.endsWith(`.${companyHost}`))) {
    score += 15;
    reasons.push("on company site");
  }
  if (/\b(email|contact|reach|@)\b/i.test(blob)) {
    score += 8;
    reasons.push("near contact wording");
  }
  if (/^(noreply|no-reply|donotreply|mailer-daemon)/i.test(local)) {
    score -= 50;
  }

  return {
    score,
    reason: reasons[0] || "public listing",
  };
}

/**
 * @param {Array<string|{ text?: string, url?: string }>} texts
 * @param {{ companyHost?: string, geo?: string, source?: string }} [opts]
 * @returns {{
 *   phones: Array<{ value: string, rank: number, reason: string, source: string }>,
 *   emails: Array<{ value: string, rank: number, reason: string, source: string }>,
 *   phone: object|null,
 *   email: object|null,
 * }}
 */
export function extractPublicContactFields(texts = [], {
  companyHost = "",
  geo = "",
  source = "serper_snippet",
} = {}) {
  const rows = (Array.isArray(texts) ? texts : [texts]).map((entry) => {
    if (entry && typeof entry === "object") {
      return {
        text: String(entry.text ?? entry.snippet ?? entry.title ?? ""),
        url: String(entry.url ?? entry.link ?? ""),
      };
    }
    return { text: String(entry ?? ""), url: "" };
  });

  const phoneMap = new Map();
  const emailMap = new Map();

  for (const row of rows) {
    for (const value of extractPhonesFromText(row.text)) {
      const key = value.replace(/\D/g, "");
      const scored = scorePhoneCandidate({
        value,
        text: row.text,
        url: row.url,
        companyHost,
        geo,
      });
      const prev = phoneMap.get(key);
      if (!prev || scored.score > prev.score) {
        phoneMap.set(key, {
          value,
          score: scored.score,
          reason: scored.reason,
          source,
        });
      } else {
        prev.score += 3; // seen again across sources
      }
    }
    for (const value of extractEmailsFromText(row.text)) {
      const key = value.toLowerCase();
      const scored = scoreEmailCandidate({
        value,
        text: row.text,
        url: row.url,
        companyHost,
      });
      const prev = emailMap.get(key);
      if (!prev || scored.score > prev.score) {
        emailMap.set(key, {
          value,
          score: scored.score,
          reason: scored.reason,
          source,
        });
      } else {
        prev.score += 3;
      }
    }
  }

  const phones = [...phoneMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((p, i) => ({
      value: p.value,
      rank: i + 1,
      reason: p.reason,
      source: p.source,
    }));

  const emails = [...emailMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((e, i) => ({
      value: e.value,
      rank: i + 1,
      reason: e.reason,
      source: e.source,
    }));

  return {
    phones,
    emails,
    phone: phones[0]
      ? { value: phones[0].value, source: phones[0].source, reason: phones[0].reason, rank: 1 }
      : null,
    email: emails[0]
      ? { value: emails[0].value, source: emails[0].source, reason: emails[0].reason, rank: 1 }
      : null,
  };
}

/**
 * Lead qualifies only with phone + name + brief.
 */
export function qualifiesProspectLead({ phone, phones, name, overview } = {}) {
  const phoneValue = phones?.[0]?.value
    ?? (typeof phone === "object" ? phone?.value : phone);
  const hasPhone = Boolean(String(phoneValue ?? "").replace(/\D/g, "").length >= 10);
  const hasName = Boolean(String(name ?? "").trim());
  const hasBrief = Boolean(String(overview ?? "").trim());
  return hasPhone && hasName && hasBrief;
}

export { hostnameFromUrl, emailDomain };
