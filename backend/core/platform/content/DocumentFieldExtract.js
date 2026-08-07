/**
 * Structured document extract → CRM contact fields.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
const NAME_RE = /(?:^|\n)\s*(?:name|contact|from)\s*[:\-]\s*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)+)/i;
const COMPANY_RE = /(?:company|org|organization|business)\s*[:\-]\s*([^\n\r,]{2,80})/i;

export function extractContactFieldsFromText(plainText = "") {
  const text = String(plainText ?? "");
  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const phone = text.match(PHONE_RE)?.[0] ?? null;
  const name = text.match(NAME_RE)?.[1]?.trim()
    ?? (email ? String(email).split("@")[0].replace(/[._]/g, " ") : null);
  const company = text.match(COMPANY_RE)?.[1]?.trim() ?? null;
  return deepFreeze({
    name: name ? titleCase(name) : null,
    email,
    phone,
    company,
    extracted: Boolean(email || phone || name || company),
  });
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Process text (already extracted from PDF/DOCX/etc) into CRM contact.
 */
export async function processDocumentIntoCrmContact({
  platformStore,
  installation,
  plainText,
  title = "Processed document",
  actorId = "document_processing",
} = {}) {
  const fields = extractContactFieldsFromText(plainText);
  if (!fields.extracted) {
    return deepFreeze({
      ok: false,
      reason: "no_fields",
      message: "No name/email/phone/company fields found in document text.",
      fields,
    });
  }
  const { readCrmState, writeCrmState, upsertContact } = await import("../../crm/CrmStore.js");
  const contactId = `contact_doc_${Date.now().toString(36)}`;
  let crm = readCrmState(installation);
  crm = upsertContact(crm, {
    id: contactId,
    partyId: contactId,
    name: fields.name || fields.email || fields.phone || "Document contact",
    email: fields.email || "",
    phone: fields.phone || "",
    kind: "lead",
    tags: ["document_processing"],
    notes: [`Extracted from: ${title}`, fields.company ? `Company: ${fields.company}` : null]
      .filter(Boolean)
      .join("\n"),
    company: fields.company || undefined,
  });
  await writeCrmState({ platformStore, installation, crm, actorId });
  return deepFreeze({
    ok: true,
    contactId,
    fields,
    externalReference: contactId,
    message: "Document fields extracted into People.",
  });
}
