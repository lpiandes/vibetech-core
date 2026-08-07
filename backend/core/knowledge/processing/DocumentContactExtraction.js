/**
 * Document Processing Automation — wraps DocumentProcessingEngine with
 * regex-based structured field extraction (name, email, phone, company) and
 * upserts the result as a CRM contact. Honest extraction: fields that cannot
 * be found stay null/empty rather than being guessed.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { DocumentProcessingEngine } from "./DocumentProcessingEngine.js";
import { ensureCrmContactPersisted } from "../../crm/ensureCrmContactAndOptionalCard.js";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// US-style phone: optional country code, separators, 10 digits.
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
// "Name: John Doe" / "Contact: John Doe" style labeled lines.
const NAME_LABEL_RE = /^(?:name|contact|attn|attention)\s*:\s*(.+)$/im;
// "Company: Acme Inc" / "Acme Inc, LLC" style labeled lines.
const COMPANY_LABEL_RE = /^(?:company|organization|employer|business)\s*:\s*(.+)$/im;
const COMPANY_SUFFIX_RE = /^[A-Z][A-Za-z0-9&.,'\s-]{1,60}\b(Inc|LLC|LLP|Ltd|Corp|Co|Company|Group|Partners)\.?\b/m;

function cleanLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Regex-only structured extraction from plain text. Never invents a value —
 * unmatched fields are null.
 * @returns {{ name: string|null, email: string|null, phone: string|null, company: string|null }}
 */
export function extractContactFieldsFromText(text) {
  const plain = String(text ?? "");

  const emailMatch = plain.match(EMAIL_RE);
  const email = emailMatch ? emailMatch[0].trim() : null;

  const phoneMatch = plain.match(PHONE_RE);
  const phone = phoneMatch ? phoneMatch[0].trim() : null;

  let name = null;
  const nameLabelMatch = plain.match(NAME_LABEL_RE);
  if (nameLabelMatch) {
    name = cleanLine(nameLabelMatch[1]).slice(0, 120);
  } else if (email) {
    // Fall back to the line immediately preceding a bare email (common in
    // signature blocks) — still evidence-based, not invented.
    const lines = plain.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const emailLineIdx = lines.findIndex((l) => EMAIL_RE.test(l));
    if (emailLineIdx > 0) {
      const candidate = cleanLine(lines[emailLineIdx - 1]);
      if (candidate && candidate.split(" ").length <= 5 && !EMAIL_RE.test(candidate) && !PHONE_RE.test(candidate)) {
        name = candidate.slice(0, 120);
      }
    }
  }

  let company = null;
  const companyLabelMatch = plain.match(COMPANY_LABEL_RE);
  if (companyLabelMatch) {
    company = cleanLine(companyLabelMatch[1]).slice(0, 160);
  } else {
    const suffixMatch = plain.match(COMPANY_SUFFIX_RE);
    if (suffixMatch) company = cleanLine(suffixMatch[0]).slice(0, 160);
  }

  return deepFreeze({ name, email, phone, company });
}

/**
 * Process a document (via DocumentProcessingEngine), extract structured
 * contact fields, and upsert a CRM contact. Contact is only created/updated
 * when at least one identifying field (email or phone) was found — never
 * fabricates a contact from an empty extraction.
 * @returns {Promise<{
 *   ok: boolean,
 *   reason?: string,
 *   message?: string,
 *   document?: object,
 *   extracted?: object,
 *   contact?: object|null,
 *   contactCreated?: boolean,
 * }>}
 */
export async function processDocumentAndUpsertContact({
  platformStore,
  installation,
  businessGraphRuntime = null,
  persistGraph = null,
  workspaceService = null,
  id,
  sourceType,
  filename,
  content,
  actorId = null,
  engine = new DocumentProcessingEngine(),
} = {}) {
  if (!platformStore || !installation) {
    throw new Error("processDocumentAndUpsertContact requires platformStore and installation");
  }
  const document = await engine.processDocument({ id, sourceType, filename, content });
  if (document.processingStatus === "FAILED") {
    return deepFreeze({
      ok: false,
      reason: "document_processing_failed",
      message: document.warnings?.[0] ?? "Document processing failed.",
      document,
    });
  }

  const extracted = extractContactFieldsFromText(document.plainText);
  if (!extracted.email && !extracted.phone) {
    return deepFreeze({
      ok: true,
      document,
      extracted,
      contact: null,
      contactCreated: false,
      reason: "no_identifying_fields",
      message: "Document processed, but no email or phone was found — no CRM contact created.",
    });
  }

  const result = await ensureCrmContactPersisted({
    platformStore,
    installation,
    actorId,
    businessGraphRuntime,
    persistGraph,
    workspaceService,
    contact: {
      name: extracted.name || undefined,
      email: extracted.email || undefined,
      phone: extracted.phone || undefined,
      kind: "lead",
      tags: ["document_extract"],
      notes: extracted.company
        ? `Extracted from document "${filename ?? document.id}" — company: ${extracted.company}`
        : `Extracted from document "${filename ?? document.id}"`,
    },
    addToPipeline: false,
    dualWriteSource: "document_processing",
  });

  return deepFreeze({
    ok: true,
    document,
    extracted,
    contact: result.contact,
    contactCreated: result.created,
  });
}

/**
 * Prove helper — processes a canned sample document with all four fields
 * present and upserts a CRM contact end-to-end. Honest: uses the real
 * extraction + CRM write path, not a mocked result.
 */
export async function runProcessTestDocumentProve({
  platformStore,
  installation,
  actorId = "document_processing_prove",
} = {}) {
  const sampleText = [
    "Inbound Inquiry",
    "",
    "Name: Jordan Rivera",
    "Company: Rivera Roofing & Repair LLC",
    "Email: jordan.rivera@example.com",
    "Phone: (555) 240-1180",
    "",
    "Message: Looking for a quote on a new roof install this fall.",
  ].join("\n");

  return processDocumentAndUpsertContact({
    platformStore,
    installation,
    id: `doc_prove_${Date.now()}`,
    sourceType: "TXT",
    filename: "prove-test-document.txt",
    content: sampleText,
    actorId,
  });
}
