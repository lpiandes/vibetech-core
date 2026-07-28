/**
 * Thin lead-list CSV importer → CrmStore contacts (+ optional pipeline cards).
 */
import { CsvImportParser } from "../import/parsers/CsvImportParser.js";
import {
  ensureCrmContactAndOptionalCard,
  findContact,
  tryDualWriteParty,
} from "./ensureCrmContactAndOptionalCard.js";
import { readCrmState, writeCrmState } from "./CrmStore.js";

function headerKey(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function pickField(row, aliases) {
  const entries = Object.entries(row || {});
  for (const alias of aliases) {
    const want = headerKey(alias);
    for (const [key, value] of entries) {
      if (headerKey(key) === want && String(value ?? "").trim()) {
        return String(value).trim();
      }
    }
  }
  return "";
}

/**
 * Map a loose CSV row into a contact payload.
 */
export function mapLeadRow(row) {
  const first = pickField(row, ["first_name", "firstname", "first"]);
  const last = pickField(row, ["last_name", "lastname", "last"]);
  const full = pickField(row, ["name", "full_name", "fullname", "contact_name", "contact"]);
  const name = full || [first, last].filter(Boolean).join(" ").trim();
  const email = pickField(row, ["email", "email_address", "e_mail"]);
  const phone = pickField(row, ["phone", "mobile", "cell", "phone_number", "mobile_phone"]);
  const notes = pickField(row, ["notes", "note", "comments", "comment", "message"]);
  const source = pickField(row, ["source", "lead_source", "origin"]);
  const tagsRaw = pickField(row, ["tags", "tag", "labels"]);
  const tags = [
    "import",
    "lead_list",
    ...(source ? [source] : []),
    ...tagsRaw.split(/[|,;]/).map((t) => t.trim()).filter(Boolean),
  ];
  return {
    name,
    email,
    phone,
    notes: [notes, source ? `Source: ${source}` : ""].filter(Boolean).join("\n"),
    tags: [...new Set(tags)],
    kind: "lead",
  };
}

/**
 * @param {{
 *   platformStore: object,
 *   installation: object,
 *   actorId?: string|null,
 *   csvText?: string,
 *   csvBuffer?: Buffer|string,
 *   pipelineId?: string|null,
 *   stageId?: string|null,
 *   addToPipeline?: boolean,
 *   kind?: string,
 *   businessGraphRuntime?: object|null,
 *   persistGraph?: Function|null,
 * }} opts
 */
export async function importLeadList({
  platformStore,
  installation,
  actorId = null,
  csvText = "",
  csvBuffer = null,
  pipelineId = null,
  stageId = null,
  addToPipeline = true,
  kind = "lead",
  businessGraphRuntime = null,
  persistGraph = null,
} = {}) {
  if (!platformStore || !installation) {
    throw new Error("importLeadList requires platformStore and installation");
  }

  const parser = new CsvImportParser();
  const buffer = csvBuffer ?? Buffer.from(String(csvText ?? ""), "utf8");
  const parsed = await parser.parse(buffer, { sampleLimit: 3 });
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];

  let crm = readCrmState(installation);
  const report = {
    ok: true,
    rowCount: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    cardsCreated: 0,
    errors: /** @type {Array<{ row: number, error: string }>} */ ([]),
    contacts: /** @type {object[]} */ ([]),
  };

  let graphDirty = false;

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 2; // header is row 1
    try {
      const mapped = mapLeadRow(rows[i]);
      if (!mapped.name && !mapped.email && !mapped.phone) {
        report.skipped += 1;
        report.errors.push({ row: rowNumber, error: "empty_row" });
        continue;
      }
      if (!mapped.name) {
        mapped.name = mapped.email || mapped.phone || "Imported lead";
      }
      mapped.kind = kind || "lead";

      const before = findContact(crm, mapped);
      const hadCard = before
        ? (crm.pipelines ?? []).some((p) =>
          (p.cards ?? []).some(
            (c) => String(c.contactId) === String(before.id) || String(c.partyId) === String(before.id),
          ))
        : false;
      const ensured = ensureCrmContactAndOptionalCard(crm, {
        contact: {
          ...(before || {}),
          ...mapped,
          id: before?.id,
          partyId: before?.id,
          tags: [...new Set([...(before?.tags ?? []), ...mapped.tags])],
          notes: [before?.notes, mapped.notes].filter(Boolean).join("\n").trim(),
        },
        addToPipeline,
        pipelineId,
        stageId,
        skipExistingCard: true,
      });
      crm = ensured.crm;
      if (ensured.created) report.created += 1;
      else report.updated += 1;
      if (ensured.cardId && !hadCard) report.cardsCreated += 1;

      const party = tryDualWriteParty({
        businessGraphRuntime,
        contact: ensured.contact,
        source: "crm_lead_import",
      });
      if (party.created) graphDirty = true;

      report.contacts.push({
        id: ensured.contact.id,
        name: ensured.contact.name,
        email: ensured.contact.email,
        phone: ensured.contact.phone,
        created: ensured.created,
        cardId: ensured.cardId,
      });
    } catch (err) {
      report.skipped += 1;
      report.errors.push({
        row: rowNumber,
        error: String(err?.message ?? err),
      });
    }
  }

  await writeCrmState({ platformStore, installation, crm, actorId });
  if (graphDirty && typeof persistGraph === "function") {
    try {
      await persistGraph();
    } catch {
      /* optional */
    }
  }

  return {
    ...report,
    columns: parsed.columns ?? [],
    contactsTotal: (crm.contacts ?? []).length,
  };
}
