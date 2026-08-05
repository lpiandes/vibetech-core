import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { composeOutcomesLedger } from "../operating-home/composeOutcomesLedger.js";
import { readOperatorInterventions } from "./operatorInterventions.js";
import { readRftObservation } from "../ai-builder/operating-contract/rft/rftObservation.js";
import { readCrmState } from "../crm/CrmStore.js";
import { RFT_PIPELINE_ID, hasProviderProof } from "../ai-builder/operating-contract/rft/rftCatalog.js";
import { readSpecialtyFireLedger } from "../ai-builder/specialty/specialtyFireLedger.js";
import { buildOperatorCasesForInstallation } from "./buildRftOperatorQueue.js";
import { getRftOpportunityTrace } from "../ai-builder/operating-contract/rft/rftOpportunityRuntime.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseTime(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function inWindow(value, startMs, endMs) {
  const ms = parseTime(value);
  if (ms == null) return false;
  return ms >= startMs && ms <= endMs;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function notObservable(reason) {
  return deepFreeze({
    status: "not_observable",
    reason,
  });
}

function observableCount(count, extra = {}) {
  return deepFreeze({
    status: "observable",
    count,
    ...extra,
  });
}

function outcomeCardIdFromIntervention(intervention) {
  if (intervention?.payload?.cardId) return String(intervention.payload.cardId);
  const parts = String(intervention?.caseId ?? "").split(":");
  return parts.length >= 3 ? String(parts[2]) : null;
}

function linkedRescueCompleted(intervention, installation, completedCardIds) {
  const outcomeText = String(intervention?.resolutionOutcome ?? "").toLowerCase();
  if (/(?:^|\b)(complete|completed|rescue|rescued)(?:\b|$)/i.test(outcomeText)) {
    return true;
  }
  const linkedTraceRef = String(intervention?.linkedTraceRef ?? "").trim();
  if (linkedTraceRef && completedCardIds.has(linkedTraceRef)) {
    return true;
  }
  const cardId = outcomeCardIdFromIntervention(intervention);
  if (!cardId) return false;
  if (completedCardIds.has(cardId)) return true;
  const trace = getRftOpportunityTrace(installation, cardId);
  return hasProviderProof(trace?.rft?.evidence) && ["Verified", "OutcomeRecorded", "Closed"].includes(String(trace?.rft?.state ?? ""));
}

function buildCurrentResponseMetric({ installation, windowStartMs, windowEndMs, observation }) {
  const baseline = observation?.baseline?.metrics?.firstResponse;
  if (baseline?.status !== "observable" || !Number.isFinite(baseline.medianMinutes)) {
    return notObservable("Historical baseline first-response is not observable.");
  }
  const crm = readCrmState(installation);
  const pipe = asArray(crm.pipelines).find((entry) => String(entry.id) === RFT_PIPELINE_ID);
  const deltas = [];
  for (const card of asArray(pipe?.cards)) {
    const rft = card?.rft && typeof card.rft === "object" ? card.rft : null;
    if (!rft) continue;
    const history = asArray(rft.history);
    const detected = history.find((entry) => String(entry?.to ?? "") === "Detected") ?? history[0] ?? null;
    const firstAction = history.find((entry) =>
      ["ContextReady", "ActionProposed", "ApprovalRequired", "AutoEligible", "Executing", "Verified"].includes(String(entry?.to ?? "")),
    );
    if (!detected?.at || !firstAction?.at) continue;
    if (!inWindow(detected.at, windowStartMs, windowEndMs)) continue;
    const startMs = parseTime(detected.at);
    const endMs = parseTime(firstAction.at);
    if (startMs == null || endMs == null || endMs < startMs) continue;
    deltas.push((endMs - startMs) / 60_000);
  }
  if (!deltas.length) {
    return notObservable("No current detected-to-action traces in the scorecard window.");
  }
  return deepFreeze({
    status: "observable",
    currentMedianMinutes: Math.round(median(deltas) * 100) / 100,
    baselineMedianMinutes: baseline.medianMinutes,
    sampleSize: deltas.length,
  });
}

export function composePilotScorecard({
  installation = null,
  businessId = null,
  windowDays = 7,
  interventionsState = null,
  nowISO = null,
} = {}) {
  const generatedAt = nowISO ?? new Date().toISOString();
  const window = Math.max(1, Number(windowDays) || 7);
  const windowEndMs = parseTime(generatedAt) ?? Date.now();
  const windowStartMs = windowEndMs - (window * 86_400_000);
  const resolvedBusinessId = String(businessId ?? installation?.businessId ?? "").trim() || null;
  const observation = readRftObservation(installation);
  const interventions = interventionsState && typeof interventionsState === "object"
    ? readOperatorInterventions({ configuration: { operatorInterventions: interventionsState } })
    : readOperatorInterventions(installation);
  const outcomes = composeOutcomesLedger({
    installation,
    businessId: resolvedBusinessId,
  });
  const specialtyFireLedger = readSpecialtyFireLedger(installation);
  const crm = readCrmState(installation);
  const pipe = asArray(crm.pipelines).find((entry) => String(entry.id) === RFT_PIPELINE_ID);
  const cards = asArray(pipe?.cards);

  const completedItems = outcomes.items.filter((item) => item.status === "completed" && inWindow(item.at, windowStartMs, windowEndMs));
  const proofBackedCompleted = completedItems.filter((item) => hasProviderProof(item.evidence));
  const completedCardIds = new Set(
    proofBackedCompleted
      .map((item) => item.cardId)
      .filter(Boolean)
      .map(String),
  );
  const closedInterventions = asArray(interventions.closed).filter((entry) =>
    inWindow(entry.closedAt ?? entry.endedAt, windowStartMs, windowEndMs),
  );
  const humanMinutesTotal = Math.round(
    closedInterventions.reduce((sum, entry) => sum + (Number(entry.minutesSpent) || 0), 0) * 100,
  ) / 100;
  const exceptionsByCategoryCounts = {};
  for (const entry of closedInterventions) {
    const key = String(entry.rootCause ?? entry.category ?? "unknown");
    exceptionsByCategoryCounts[key] = (exceptionsByCategoryCounts[key] ?? 0) + 1;
  }
  const exceptionsByCategory = Object.entries(exceptionsByCategoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));

  const eligibleMetric = observation?.baseline?.metrics?.opportunitiesDetected;
  const eligibleEvents = eligibleMetric?.status === "observable"
    ? observableCount(Number(eligibleMetric.count) || 0, {
      evidence: asArray(eligibleMetric.evidence).slice(0, 20),
    })
    : notObservable(eligibleMetric?.reason ?? "Historical opportunity baseline not imported.");

  const detectedEventIds = new Set();
  for (const card of cards) {
    const rft = card?.rft && typeof card.rft === "object" ? card.rft : null;
    if (!rft) continue;
    const detectedAt = rft.createdAt ?? card.createdAt ?? card.updatedAt ?? rft.lastTransitionAt ?? null;
    if (!inWindow(detectedAt, windowStartMs, windowEndMs)) continue;
    detectedEventIds.add(`rft:${card.id}`);
  }
  for (const entry of asArray(specialtyFireLedger.entries)) {
    if (!inWindow(entry.at, windowStartMs, windowEndMs)) continue;
    detectedEventIds.add(`fire:${entry.id}`);
  }

  const openCases = buildOperatorCasesForInstallation({
    business: {
      id: resolvedBusinessId,
      name: installation?.configuration?.businessProfile?.businessName ?? "Business",
    },
    installation,
    nowISO: generatedAt,
  }).filter((entry) => {
    const createdMs = parseTime(entry.createdAt);
    return createdMs == null || createdMs >= windowStartMs;
  });

  const failedExternalActions = asArray(specialtyFireLedger.entries).filter((entry) =>
    entry.ok === false && inWindow(entry.at, windowStartMs, windowEndMs),
  ).length;

  const operatorRescueCompletions = closedInterventions.filter((entry) =>
    linkedRescueCompleted(entry, installation, completedCardIds),
  ).length;

  return deepFreeze({
    businessId: resolvedBusinessId,
    generatedAt,
    windowDays: window,
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
    eligibleEvents,
    detectedEvents: observableCount(detectedEventIds.size),
    completed: observableCount(proofBackedCompleted.length),
    verifiedOutcomes: observableCount(proofBackedCompleted.length),
    slaAttainment: outcomes.metrics?.slaAttainment?.status === "observable"
      ? outcomes.metrics.slaAttainment
      : notObservable(outcomes.metrics?.slaAttainment?.reason ?? "SLA attainment is not observable from stored evidence."),
    automaticCompletions: observableCount(
      proofBackedCompleted.filter((item) => item.humanInvolvement === "none").length,
    ),
    approvalRequiredCompletions: observableCount(
      proofBackedCompleted.filter((item) => item.humanInvolvement === "approval_required").length,
    ),
    operatorInterventions: observableCount(closedInterventions.length),
    operatorRescueCompletions: observableCount(operatorRescueCompletions),
    exceptionsByCategory,
    failedExternalActions: observableCount(failedExternalActions),
    unresolvedEvents: observableCount(openCases.length),
    humanMinutesTotal: observableCount(humanMinutesTotal),
    humanMinutesPerOutcome: proofBackedCompleted.length > 0
      ? deepFreeze({
        status: "observable",
        minutes: Math.round((humanMinutesTotal / proofBackedCompleted.length) * 100) / 100,
        outcomeCount: proofBackedCompleted.length,
      })
      : notObservable("No proof-backed completed outcomes in the scorecard window."),
    medianResponseMinutes: buildCurrentResponseMetric({
      installation,
      windowStartMs,
      windowEndMs,
      observation,
    }),
    honesty: {
      message: "Automatic completions and operator rescue completions are reported separately. Operator-rescued outcomes never inflate the automatic count.",
    },
  });
}
