/**
 * Accounting read adapter pattern — Memory facts only, never a full GL UI.
 * Same Connection + Memory mapping as other SoRs.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const ACCOUNTING_READ_FACT_KINDS = Object.freeze([
  "open_balance",
  "invoice_status",
  "payment_received",
  "customer_balance",
]);

/**
 * Normalize a provider record into bounded Memory facts VIBETech can cite.
 */
export function mapAccountingRecordToMemoryFacts(record = {}) {
  const facts = [];
  const partyId = record.partyId ?? record.customerId ?? record.contactId ?? null;
  const subjectId = record.subjectId ?? record.propertyId ?? null;
  const source = String(record.provider ?? record.source ?? "accounting");

  if (record.openBalance != null || record.balance != null) {
    facts.push({
      kind: "open_balance",
      value: Number(record.openBalance ?? record.balance),
      currency: record.currency ?? "USD",
      partyId,
      subjectId,
      externalId: record.id ?? record.externalId ?? null,
      source,
    });
  }
  if (record.invoiceStatus || record.status) {
    facts.push({
      kind: "invoice_status",
      value: String(record.invoiceStatus ?? record.status),
      partyId,
      subjectId,
      externalId: record.id ?? record.externalId ?? null,
      source,
    });
  }
  if (record.lastPaymentAmount != null || record.paymentReceived != null) {
    facts.push({
      kind: "payment_received",
      value: Number(record.lastPaymentAmount ?? record.paymentReceived),
      currency: record.currency ?? "USD",
      partyId,
      subjectId,
      externalId: record.id ?? record.externalId ?? null,
      source,
    });
  }

  return deepFreeze(facts.filter((fact) => ACCOUNTING_READ_FACT_KINDS.includes(fact.kind)));
}

/**
 * Adapter contract for QuickBooks / Xero / etc. — read only into Memory.
 */
export function createAccountingReadAdapter({ providerId = "accounting", listRecords } = {}) {
  return deepFreeze({
    providerId: String(providerId),
    connectionType: "accounting",
    capabilities: ["READ_EXTERNAL_RECORD"],
    async pullMemoryFacts({ businessId, cursor = null } = {}) {
      if (typeof listRecords !== "function") {
        return deepFreeze({
          ok: false,
          reason: "provider_not_configured",
          facts: [],
          note: "Connect accounting, then map balances into Memory — never rebuild the ledger UI here.",
        });
      }
      const page = await listRecords({ businessId, cursor });
      const records = Array.isArray(page?.records) ? page.records : [];
      const facts = records.flatMap((record) => mapAccountingRecordToMemoryFacts({ ...record, provider: providerId }));
      return deepFreeze({
        ok: true,
        facts,
        nextCursor: page?.nextCursor ?? null,
        winClaim: "Connect what you already pay for. Operate everything important here.",
      });
    },
  });
}
