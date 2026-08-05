/**
 * Cross-client RFT / specialty / SLA / approval operator queue (Plan 8).
 * Aggregates from installations — never invents cases without evidence.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { readCrmState } from "../crm/CrmStore.js";
import { RFT_PIPELINE_ID } from "../ai-builder/operating-contract/rft/rftCatalog.js";
import { normalizeRftServiceStandard } from "../ai-builder/operating-contract/rft/rftContract.js";
import { getRftOpportunityTrace } from "../ai-builder/operating-contract/rft/rftOpportunityRuntime.js";
import { readSpecialtyFireLedger } from "../ai-builder/specialty/specialtyFireLedger.js";
import { isCaseResolved } from "./operatorInterventions.js";
import { OPERATOR_CASE_KINDS } from "./operatorRootCause.js";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function parseTime(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function findRftContract(installation) {
  const employees = asArray(installation?.configuration?.employees);
  const emp = employees.find((e) => e?.operatingContract?.rft) ?? null;
  return normalizeRftServiceStandard(emp?.operatingContract?.rft ?? null);
}

/**
 * Build queue cases for one business installation.
 */
export function buildOperatorCasesForInstallation({
  business = null,
  installation = null,
  nowISO = null,
} = {}) {
  const businessId = String(business?.id ?? installation?.businessId ?? "");
  const businessName = String(business?.name ?? "Business");
  if (!businessId || !installation) return [];

  const at = nowISO ?? new Date().toISOString();
  const nowMs = parseTime(at) ?? Date.now();
  const cases = [];
  const rft = findRftContract(installation);
  const slaMinutes = Number(rft.sla?.acknowledgeWithinMinutes) || 5;
  const crm = readCrmState(installation);
  const pipe = asArray(crm.pipelines).find((p) => String(p.id) === RFT_PIPELINE_ID);
  const cards = asArray(pipe?.cards);

  for (const card of cards) {
    const cardRft = card.rft && typeof card.rft === "object" ? card.rft : null;
    if (!cardRft) continue;
    const state = String(cardRft.state ?? "");
    const caseBase = {
      businessId,
      businessName,
      cardId: card.id,
      title: card.title ?? "Opportunity",
      contractVersion: cardRft.contractVersion ?? rft.contractVersion,
      contentHash: cardRft.contentHash ?? rft.contentHash,
      evidence: asArray(cardRft.evidence),
      href: `/admin/exceptions?caseId=${encodeURIComponent(`rft:${businessId}:${card.id}`)}`,
      workspaceHref: `/b/${encodeURIComponent(businessId)}/outcomes`,
      supportHref: `/admin/support?businessId=${encodeURIComponent(businessId)}`,
      createdAt: cardRft.lastTransitionAt ?? card.updatedAt ?? cardRft.createdAt ?? null,
    };

    if (state === "Exception") {
      const caseId = `rft_exception:${businessId}:${card.id}`;
      if (!isCaseResolved(installation, caseId)) {
        cases.push(deepFreeze({
          ...caseBase,
          id: caseId,
          kind: "rft_exception",
          urgency: "critical",
          summary: `RFT opportunity in Exception — ${card.title ?? card.id}`,
          steps: [
            "Open the case trace (Work, approvals, fire ledger, RFT history)",
            "Enter support access if you need the live workspace",
            "Take over or retry the blocked step",
            "Resolve with a mandatory root-cause classification",
          ],
          payload: {
            state,
            outcomeType: cardRft.outcomeType ?? null,
            historyLength: asArray(cardRft.history).length,
          },
        }));
      }
    }

    if (state === "ApprovalRequired") {
      const caseId = `approval_backlog:${businessId}:${card.id}`;
      if (!isCaseResolved(installation, caseId)) {
        const ageMs = nowMs - (parseTime(cardRft.lastTransitionAt) ?? nowMs);
        const stalled = ageMs > 60 * 60 * 1000;
        if (stalled) {
          cases.push(deepFreeze({
            ...caseBase,
            id: caseId,
            kind: "approval_backlog",
            urgency: "high",
            summary: `Customer approval stalled >1h — ${card.title ?? card.id}`,
            steps: [
              "Check why the owner has not decided",
              "Support-enter if coaching the owner is needed",
              "Classify root cause when closing (often customer_delay)",
            ],
            payload: { state, ageMinutes: Math.round(ageMs / 60_000) },
          }));
        }
      }
    }

    // SLA risk: open opportunity older than acknowledge SLA without Verified/Closed
    if (!["Verified", "OutcomeRecorded", "Closed", "Exception"].includes(state)) {
      const createdMs = parseTime(cardRft.createdAt ?? cardRft.lastTransitionAt);
      if (createdMs != null) {
        const ageMin = (nowMs - createdMs) / 60_000;
        if (ageMin > slaMinutes) {
          const caseId = `sla_risk:${businessId}:${card.id}`;
          if (!isCaseResolved(installation, caseId)) {
            cases.push(deepFreeze({
              ...caseBase,
              id: caseId,
              kind: "sla_risk",
              urgency: ageMin > slaMinutes * 3 ? "critical" : "high",
              summary: `SLA risk — ${Math.round(ageMin)}m since detect (promise ${slaMinutes}m)`,
              steps: [
                "Inspect opportunity timeline and first-response evidence",
                "Escalate to owner or take over acknowledgement",
                "Close with root cause when handled",
              ],
              payload: {
                state,
                ageMinutes: Math.round(ageMin),
                slaMinutes,
              },
            }));
          }
        }
      }
    }
  }

  const ledger = readSpecialtyFireLedger(installation);
  for (const entry of asArray(ledger.entries).slice(0, 40)) {
    if (entry.ok !== false) continue;
    const caseId = `specialty_fire_failed:${businessId}:${entry.id}`;
    if (isCaseResolved(installation, caseId)) continue;
    cases.push(deepFreeze({
      id: caseId,
      kind: "specialty_fire_failed",
      urgency: "high",
      businessId,
      businessName,
      title: entry.brief || entry.eventLabel || entry.eventType || "Specialty fire failed",
      summary: entry.skipReason
        ? `Fire failed: ${entry.skipReason}`
        : "Specialty automation fire failed — see path notes.",
      contractVersion: rft.contractVersion,
      contentHash: rft.contentHash,
      evidence: entry.workId
        ? [{ kind: "work_item_id", providerId: String(entry.workId) }]
        : [],
      href: `/admin/exceptions?caseId=${encodeURIComponent(caseId)}`,
      workspaceHref: `/b/${encodeURIComponent(businessId)}/automations`,
      supportHref: `/admin/support?businessId=${encodeURIComponent(businessId)}`,
      createdAt: entry.at ?? null,
      steps: [
        "Read specialty fire ledger path notes",
        "Retry after fixing blocker (integration / knowledge / policy)",
        "Resolve with root-cause classification",
      ],
      payload: {
        eventType: entry.eventType,
        skipReason: entry.skipReason,
        workId: entry.workId,
        approvalIds: entry.approvalIds,
        pathNotes: entry.pathNotes,
      },
    }));
  }

  // Low confidence: RFT AutoEligible with no provider evidence yet while Executing-adjacent
  for (const card of cards) {
    const cardRft = card.rft && typeof card.rft === "object" ? card.rft : null;
    if (!cardRft) continue;
    if (String(cardRft.state) !== "AutoEligible") continue;
    const evidence = asArray(cardRft.evidence);
    if (evidence.some((e) => e?.providerId)) continue;
    const caseId = `low_confidence:${businessId}:${card.id}`;
    if (isCaseResolved(installation, caseId)) continue;
    cases.push(deepFreeze({
      id: caseId,
      kind: "low_confidence",
      urgency: "normal",
      businessId,
      businessName,
      cardId: card.id,
      title: card.title ?? "Auto-eligible opportunity",
      summary: "Marked AutoEligible without provider evidence — review before live send.",
      contractVersion: cardRft.contractVersion ?? rft.contractVersion,
      contentHash: cardRft.contentHash ?? rft.contentHash,
      evidence: [],
      href: `/admin/exceptions?caseId=${encodeURIComponent(caseId)}`,
      workspaceHref: `/b/${encodeURIComponent(businessId)}/outcomes`,
      supportHref: `/admin/support?businessId=${encodeURIComponent(businessId)}`,
      createdAt: cardRft.lastTransitionAt ?? null,
      steps: [
        "Confirm classification and evidence requirements",
        "Attach provider proof or move to ApprovalRequired",
        "Resolve with root cause (often incorrect_classification or insufficient_knowledge)",
      ],
      payload: { state: "AutoEligible" },
    }));
  }

  return cases.filter((c) => OPERATOR_CASE_KINDS.includes(c.kind));
}

/**
 * Cross-tenant scan.
 */
export async function buildRftOperatorQueue({
  businesses = [],
  getInstallation = async () => null,
  nowISO = null,
} = {}) {
  const cases = [];
  for (const business of Array.isArray(businesses) ? businesses : []) {
    const businessId = String(business?.id ?? "");
    if (!businessId) continue;
    let installation = null;
    try {
      installation = await getInstallation(businessId);
    } catch {
      installation = null;
    }
    if (!installation) continue;
    cases.push(...buildOperatorCasesForInstallation({
      business,
      installation,
      nowISO,
    }));
  }

  cases.sort((a, b) => {
    const rank = { critical: 0, high: 1, normal: 2 };
    const ra = rank[a.urgency] ?? 3;
    const rb = rank[b.urgency] ?? 3;
    if (ra !== rb) return ra - rb;
    return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
  });

  return deepFreeze(cases);
}

/**
 * Full trace for an operator case (RFT card or specialty fire).
 */
export function composeOperatorCaseTrace({
  installation = null,
  caseId = null,
  cardId = null,
} = {}) {
  const id = String(caseId ?? "");
  const ledger = readSpecialtyFireLedger(installation);
  let rftTrace = null;
  const resolvedCardId = cardId
    || (id.includes(":") ? id.split(":").slice(-1)[0] : null);

  if (resolvedCardId && installation) {
    rftTrace = getRftOpportunityTrace(installation, resolvedCardId);
  }

  const fire = asArray(ledger.entries).find((e) =>
    id.includes(String(e.id)) || (rftTrace && e.workId),
  ) ?? null;

  return deepFreeze({
    caseId: id || null,
    rft: rftTrace,
    specialtyFire: fire,
    contract: findRftContract(installation),
    honesty: {
      message: "Trace only includes stored RFT history, specialty fires, and contract version — never fabricated steps.",
    },
  });
}
