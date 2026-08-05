import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { readSpecialtyFireLedger } from "../ai-builder/specialty/specialtyFireLedger.js";
import { readCrmState } from "../crm/CrmStore.js";
import { RFT_PIPELINE_ID, hasProviderProof } from "../ai-builder/operating-contract/rft/rftCatalog.js";
import { readRftObservation } from "../ai-builder/operating-contract/rft/rftObservation.js";
import { readRftReplay } from "../ai-builder/operating-contract/rft/rftReplay.js";

/**
 * Honest Outcomes ledger — only real fires, RFT traces, and recent outcomes.
 * Never fabricates counts or provider ids.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasProviderEvidence(item) {
  return hasProviderProof(item?.evidence);
}

function classifyConversionOutcome(outcomeType) {
  const normalized = String(outcomeType ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return null;
  if (normalized.includes("won") && (normalized.includes("handoff") || normalized === "won")) {
    return "won";
  }
  if (normalized.includes("lost") && (normalized.includes("reason") || normalized === "lost")) {
    return "lost";
  }
  return null;
}

function computeMetrics(items, baseline) {
  const proofBackedCompleted = items.filter(
    (i) => i.status === "completed" && hasProviderEvidence(i),
  ).length;
  const autoHandled = items.filter(
    (i) => i.status === "completed" && i.humanInvolvement === "none",
  ).length;
  const humanHandled = items.filter(
    (i) => i.status === "completed" && i.humanInvolvement !== "none",
  ).length;
  const unproven = items.filter((i) => i.status === "unproven").length;

  let baselineDelta = { status: "not_observable", reason: "No historical baseline imported." };
  const firstResponse = baseline?.metrics?.firstResponse;
  if (firstResponse?.status === "observable" && Number.isFinite(firstResponse.medianMinutes)) {
    const currentMedians = items
      .filter((i) => i.kind === "rft_outcome" && i.at)
      .map((i) => Date.parse(String(i.at)))
      .filter(Number.isFinite);
    if (currentMedians.length >= 2) {
      baselineDelta = {
        status: "observable",
        baselineMedianMinutes: firstResponse.medianMinutes,
        note: "Compare against historical baseline median first-response.",
        evidence: asArray(firstResponse.evidence).slice(0, 5),
      };
    } else {
      baselineDelta = {
        status: "not_observable",
        reason: "Not enough current RFT outcomes to compute delta vs baseline.",
      };
    }
  } else if (firstResponse?.status === "not_observable") {
    baselineDelta = {
      status: "not_observable",
      reason: firstResponse.note || firstResponse.reason || "First-response baseline not observable.",
    };
  }

  let slaAttainment = { status: "not_observable", reason: "SLA attainment requires observable first-response baseline." };
  if (firstResponse?.status === "observable" && Number.isFinite(firstResponse.slaMinutes)) {
    const within = Number(firstResponse.medianMinutes) <= Number(firstResponse.slaMinutes);
    slaAttainment = {
      status: "observable",
      slaMinutes: firstResponse.slaMinutes,
      medianMinutes: firstResponse.medianMinutes,
      withinSla: within,
      sampleSize: firstResponse.sampleSize ?? null,
    };
  }

  const conversionCounts = items.reduce((acc, item) => {
    if (!hasProviderEvidence(item)) return acc;
    const bucket = classifyConversionOutcome(item?.outcomeType);
    if (bucket === "won") acc.won += 1;
    if (bucket === "lost") acc.lost += 1;
    return acc;
  }, { won: 0, lost: 0 });
  const conversionMovement = conversionCounts.won > 0 || conversionCounts.lost > 0
    ? {
      status: "observable",
      won: conversionCounts.won,
      lost: conversionCounts.lost,
      reason: null,
    }
    : {
      status: "not_observable",
      won: 0,
      lost: 0,
      reason: "Requires proof-backed won or lost outcomes.",
    };

  return deepFreeze({
    baselineDelta,
    slaAttainment,
    conversionMovement,
    autoVsHuman: deepFreeze({
      auto: autoHandled,
      human: humanHandled,
      not_observable: autoHandled + humanHandled === 0 ? "No completed outcomes yet." : null,
    }),
    proofBackedCompleted,
    unproven,
  });
}

function pushUnique(list, entry, seen) {
  const id = String(entry.id ?? "");
  if (!id || seen.has(id)) return;
  seen.add(id);
  list.push(entry);
}

/**
 * @param {{ installation?: object|null, recentOutcomes?: object[], businessId?: string }} input
 */
export function composeOutcomesLedger({
  installation = null,
  recentOutcomes = [],
  businessId = null,
} = {}) {
  const base = businessId ? `/b/${encodeURIComponent(businessId)}` : "";
  const items = [];
  const seen = new Set();

  const ledger = readSpecialtyFireLedger(installation);
  for (const entry of asArray(ledger.entries)) {
    const ok = entry.ok !== false;
    const evidence = [];
    // Only provider-backed kinds count as proof — never invent completion from internal ids alone.
    for (const note of asArray(entry.pathNotes)) {
      const providerId = note?.providerId ?? note?.messageId ?? note?.externalReference ?? null;
      const kind = note?.evidenceKind ?? note?.providerKind ?? null;
      if (providerId && kind) {
        evidence.push({ kind: String(kind), providerId: String(providerId) });
      }
    }
    if (entry.gmailMessageId) {
      evidence.push({ kind: "gmail_message_id", providerId: String(entry.gmailMessageId) });
    }
    const proven = hasProviderProof(evidence);
    pushUnique(items, {
      id: `fire_${entry.id}`,
      kind: ok ? (proven ? "specialty_fire" : "specialty_fire") : "exception",
      title: entry.brief
        || entry.payloadSummary
        || (ok ? `Handled ${entry.eventLabel || entry.eventType || "event"}` : "Follow-through exception"),
      status: !ok ? "exception" : (proven ? "completed" : "unproven"),
      at: entry.at ?? null,
      humanInvolvement: asArray(entry.approvalIds).length > 0 ? "approval_required" : "none",
      contractVersion: null,
      contentHash: null,
      evidence,
      actions: [
        entry.at ? { at: entry.at, label: "Triggered", detail: entry.eventType || null } : null,
        entry.workId ? { at: entry.at, label: "Work created", detail: entry.workId } : null,
        ...asArray(entry.pathNotes).slice(0, 6).map((note, index) => ({
          at: entry.at,
          label: `Step ${index + 1}`,
          detail: typeof note === "string" ? note : JSON.stringify(note),
        })),
      ].filter(Boolean),
      href: entry.workId && base ? `${base}/work` : (base ? `${base}/outcomes` : null),
      skipReason: entry.skipReason ?? null,
      employeeName: entry.employeeName ?? null,
    }, seen);
  }

  const crm = readCrmState(installation);
  const rftPipe = asArray(crm.pipelines).find((p) => String(p.id) === RFT_PIPELINE_ID);
  for (const card of asArray(rftPipe?.cards)) {
    const rft = card.rft && typeof card.rft === "object" ? card.rft : null;
    if (!rft) continue;
    const state = String(rft.state ?? "");
    if (!["Verified", "OutcomeRecorded", "Closed", "Exception"].includes(state)) continue;
    const evidence = asArray(rft.evidence);
    const proven = hasProviderProof(evidence);
    const isException = state === "Exception";
    pushUnique(items, {
      id: `rft_${card.id}`,
      kind: isException ? "exception" : "rft_outcome",
      title: String(card.title ?? "Revenue Follow-Through outcome"),
      status: isException ? "exception" : (proven ? "completed" : "unproven"),
      at: rft.lastTransitionAt ?? card.updatedAt ?? null,
      humanInvolvement: asArray(rft.history).some((h) => String(h?.actorId ?? "") !== "system")
        ? "human_touched"
        : "none",
      contractVersion: rft.contractVersion ?? null,
      contentHash: rft.contentHash ?? null,
      outcomeType: rft.outcomeType ?? null,
      evidence,
      actions: asArray(rft.history).map((h) => ({
        at: h.at ?? null,
        label: `${h.from ?? "—"} → ${h.to ?? "—"}`,
        detail: h.eventType || h.note || null,
      })),
      href: base ? `${base}/outcomes?cardId=${encodeURIComponent(card.id)}` : null,
      cardId: card.id,
      state,
    }, seen);
  }

  for (const outcome of asArray(recentOutcomes)) {
    const evidence = [];
    const providerId = outcome.providerId ?? outcome.gmailMessageId ?? outcome.evidence?.providerId ?? null;
    const kind = outcome.evidenceKind
      ?? (outcome.gmailMessageId ? "gmail_message_id" : null)
      ?? (providerId ? "gmail_message_id" : null);
    if (providerId && kind) {
      evidence.push({ kind: String(kind), providerId: String(providerId) });
    }
    for (const e of asArray(outcome.evidence)) {
      if (e?.kind && e?.providerId) evidence.push({ kind: String(e.kind), providerId: String(e.providerId) });
    }
    const proven = hasProviderProof(evidence);
    pushUnique(items, {
      id: `recent_${outcome.id ?? outcome.title}`,
      kind: "recent_outcome",
      title: String(outcome.title ?? "Completed work"),
      status: proven ? "completed" : "unproven",
      at: outcome.timestamp ?? outcome.at ?? null,
      humanInvolvement: outcome.actorLabel ? "human_touched" : "none",
      contractVersion: null,
      contentHash: null,
      evidence,
      actions: [],
      href: outcome.href ?? (base ? `${base}/work` : null),
    }, seen);
  }

  items.sort((a, b) => {
    const am = Date.parse(String(a.at ?? "")) || 0;
    const bm = Date.parse(String(b.at ?? "")) || 0;
    return bm - am;
  });

  const completed = items.filter((i) => i.status === "completed").length;
  const exceptions = items.filter((i) => i.status === "exception").length;
  const withProof = items.filter((i) => hasProviderEvidence(i)).length;
  const observation = readRftObservation(installation);
  const replay = readRftReplay(installation);
  const metrics = computeMetrics(items, observation.baseline ?? null);

  return deepFreeze({
    businessId,
    generatedAt: new Date().toISOString(),
    honesty: {
      message: "Only outcomes with real work, specialty fires, or RFT traces are listed. Completed counts require provider evidence — unproven rows are excluded. Baseline metrics are not_observable when the channel is missing.",
    },
    summary: {
      total: items.length,
      completed,
      exceptions,
      withProof,
      proofBackedCompleted: metrics.proofBackedCompleted,
      unproven: metrics.unproven,
    },
    metrics,
    baseline: observation.baseline ?? null,
    observation: {
      importedAt: observation.importedAt,
      windowDays: observation.windowDays,
      eventCount: asArray(observation.events).length,
    },
    replay: {
      lastReplay: replay.lastReplay
        ? {
          ranAt: replay.lastReplay.ranAt,
          passed: replay.lastReplay.passed,
          summary: replay.lastReplay.summary,
          passDetail: replay.lastReplay.passDetail,
        }
        : null,
      shadow: {
        enabled: replay.shadow.enabled,
        passed: replay.shadow.passed,
        proposalCount: asArray(replay.shadow.proposals).length,
      },
    },
    items,
  });
}
