/**
 * Dedupe prospecting candidates against existing CRM contacts.
 */
import { findContact } from "../crm/ensureCrmContactAndOptionalCard.js";

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function domainFromEmail(email) {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  return at > 0 ? e.slice(at + 1) : "";
}

function domainFromWebsite(website) {
  try {
    const raw = String(website ?? "").trim();
    if (!raw) return "";
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(website ?? "").replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./i, "").toLowerCase();
  }
}

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @returns {{ isDuplicate: boolean, contactId: string|null, reason: string|null }}
 */
export function findDuplicateContact(crm, candidate = {}) {
  const email = normalizeEmail(
    typeof candidate.email === "object" ? candidate.email?.value : candidate.email,
  );
  const phone = String(
    typeof candidate.phone === "object" ? candidate.phone?.value : candidate.phone ?? "",
  ).trim();

  if (email || phone) {
    const hit = findContact(crm, { email, phone });
    if (hit) {
      return { isDuplicate: true, contactId: hit.id, reason: email ? "email" : "phone" };
    }
  }

  const companyDomain = domainFromWebsite(candidate.website);
  const dmName = normalizeName(candidate.decisionMakerName);
  const contacts = Array.isArray(crm?.contacts) ? crm.contacts : [];

  if (companyDomain && dmName) {
    for (const c of contacts) {
      const cDomain = domainFromEmail(c.email) || domainFromWebsite(c.notes);
      const sameDomain = cDomain && cDomain === companyDomain;
      const sameName = normalizeName(c.name) === dmName;
      if (sameDomain && sameName) {
        return { isDuplicate: true, contactId: c.id, reason: "name_domain" };
      }
    }
  }

  if (dmName && !email) {
    for (const c of contacts) {
      if (normalizeName(c.name) === dmName) {
        const cDomain = domainFromEmail(c.email);
        if (companyDomain && cDomain && companyDomain === cDomain) {
          return { isDuplicate: true, contactId: c.id, reason: "name_domain" };
        }
      }
    }
  }

  return { isDuplicate: false, contactId: null, reason: null };
}

export { domainFromWebsite, domainFromEmail, normalizeEmail };
