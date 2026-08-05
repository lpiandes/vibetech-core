/**
 * Plan 9 — Ask as operating command.
 * Deterministic grounded answers for RFT operating questions.
 * Never invents facts without evidence / stored traces.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { composeOutcomesLedger } from "../operating-home/composeOutcomesLedger.js";
import { readGovernedLearning } from "../company-rules/governedLearning.js";
import { readCrmState } from "../crm/CrmStore.js";
import {
  RFT_PIPELINE_ID,
  hasProviderProof,
  getRftOpportunityTrace,
  normalizeRftServiceStandard,
  presentRftServiceStandard,
} from "./operating-contract/rft/index.js";
import { readRftObservation } from "./operating-contract/rft/rftObservation.js";
import { readSpecialtyFireLedger } from "./specialty/specialtyFireLedger.js";

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeText(text) {
  return String(text ?? "").trim().toLowerCase();
}

export const OPERATING_ASK_SUGGESTIONS = Object.freeze([
  "Why was the latest opportunity escalated?",
  "Show every proposal without a next step.",
  "What needs my approval?",
  "What changed today?",
  "Which rule is causing the most escalations?",
  "Where are we missing evidence?",
  "Change response promise to one hour.",
]);

/**
 * Match owner text to an operating command intent.
 */
export function matchOperatingCommandIntent(text = "") {
  const t = normalizeText(text);
  if (!t) return null;

  if (
    /\b(why|how come|explain)\b/.test(t)
    && /\b(escalat\w*|exception|stuck|blocked|failed)\b/.test(t)
  ) {
    return {
      intent: "explain_escalation",
      query: extractNameQuery(t),
      latest: /\b(latest|most recent|newest)\b/.test(t),
    };
  }
  if (
    /\b(today)\b/.test(t)
    && /\b(changed|change|happened|activity|updated)\b/.test(t)
  ) {
    return { intent: "what_changed_today" };
  }
  if (
    /\b(evidence|proof|prove|proven)\b/.test(t)
    && /\b(missing|where|lack|unproven|without)\b/.test(t)
  ) {
    return { intent: "list_missing_evidence" };
  }
  if (
    /\b(rule|rules|escalation|escalations|exception|exceptions)\b/.test(t)
    && /\b(most|common|causing|cause|hotspot|hotspots)\b/.test(t)
  ) {
    return { intent: "rule_escalation_hotspots" };
  }
  if (
    /\b(proposal|proposals)\b/.test(t)
    && /\b(without|no|missing)\b/.test(t)
    && /\b(next\s*step|follow[- ]?up)\b/.test(t)
  ) {
    return { intent: "list_proposals_no_next_step" };
  }
  if (
    /\b(show|list|every|all)\b/.test(t)
    && /\bproposal/.test(t)
    && /\b(stall|waiting|open)\b/.test(t)
  ) {
    return { intent: "list_proposals_no_next_step" };
  }
  if (
    /\b(change|set|update|make)\b/.test(t)
    && /\b(response|acknowledge|ack|sla|promise)\b/.test(t)
    && /\b(minute|hour|hr|min)\b/.test(t)
  ) {
    return {
      intent: "draft_sla_change",
      minutes: parseDurationMinutes(t),
    };
  }
  if (
    /\b(vacation|ooo|out of office|reassign|re-assign|cover for)\b/.test(t)
  ) {
    return {
      intent: "draft_reassign",
      fromName: extractReassignFrom(t),
      toName: extractReassignTo(t),
    };
  }
  if (
    /\b(what if|preview|simulate)\b/.test(t)
    && /\b(approval|approve)\b/.test(t)
    && /\b(existing|current)\b/.test(t)
    && /\b(customer|client)\b/.test(t)
  ) {
    return { intent: "preview_approval_policy" };
  }
  if (
    /\b(stop|remove|drop)\b/.test(t)
    && /\brequir/.test(t)
    && /\bapproval/.test(t)
    && /\bexisting/.test(t)
  ) {
    return { intent: "preview_approval_policy" };
  }
  if (
    /\b(approval|approvals|approve)\b/.test(t)
    && /\b(what|which|show|list|need|needs|waiting|pending|my)\b/.test(t)
  ) {
    return { intent: "list_approvals_needed" };
  }

  return null;
}

function extractNameQuery(t) {
  const m = t.match(/\b(?:why(?: was| is)?)\s+(.+?)\s+(?:escalat\w*|exception|stuck)/i)
    || t.match(/\bexplain\s+(.+?)\s+(?:escalat\w*|exception)/i);
  if (!m) return null;
  const raw = String(m[1] ?? "").trim().replace(/^(the|an|a)\s+/i, "");
  if (!raw || /^(was|is)$/i.test(raw)) return null;
  return raw.replace(/\?+$/, "").trim();
}

function parseDurationMinutes(t) {
  const hour = t.match(/\b(\d+)\s*(hour|hours|hr|hrs)\b/);
  if (hour) return Math.max(1, Number(hour[1]) * 60);
  const min = t.match(/\b(\d+)\s*(minute|minutes|min|mins)\b/);
  if (min) return Math.max(1, Number(min[1]));
  if (/\bone\s+hour\b/.test(t) || /\ban\s+hour\b/.test(t)) return 60;
  return 60;
}

function extractReassignFrom(t) {
  const m = t.match(/\b([a-z][\w.\-]*)\s+is\s+on\s+vacation\b/i)
    || t.match(/\breassign\s+from\s+([a-z][\w.\-]*)\b/i)
    || t.match(/\bcover\s+for\s+([a-z][\w.\-]*)\b/i);
  return m ? String(m[1]) : null;
}

function extractReassignTo(t) {
  const m = t.match(/\breassign\s+to\s+([a-z][\w.\-]*)\b/i)
    || t.match(/\bto\s+([a-z][\w.\-]*)\s*$/i);
  return m ? String(m[1]) : null;
}

/**
 * Answer a matched operating command from installation evidence.
 */
export function answerOperatingCommand({
  text = "",
  installation = null,
  businessId = null,
  intentMatch = null,
  nowISO = null,
} = {}) {
  const matched = intentMatch ?? matchOperatingCommandIntent(text);
  if (!matched) {
    return deepFreeze({ handled: false });
  }

  switch (matched.intent) {
    case "explain_escalation":
      return explainEscalation({
        installation,
        businessId,
        query: matched.query,
        latest: matched.latest,
      });
    case "list_approvals_needed":
      return listApprovalsNeeded({ installation, businessId });
    case "what_changed_today":
      return whatChangedToday({ installation, businessId, nowISO });
    case "list_missing_evidence":
      return listMissingEvidence({ installation, businessId });
    case "rule_escalation_hotspots":
      return ruleEscalationHotspots({ installation, businessId });
    case "list_proposals_no_next_step":
      return listProposalsWithoutNextStep({ installation, businessId });
    case "draft_sla_change":
      return draftSlaChange({ installation, businessId, minutes: matched.minutes });
    case "draft_reassign":
      return draftReassign({ installation, businessId, fromName: matched.fromName, toName: matched.toName });
    case "preview_approval_policy":
      return previewApprovalPolicy({ installation, businessId });
    default:
      return deepFreeze({ handled: false });
  }
}

function findRftEmployee(installation) {
  return asArray(installation?.configuration?.employees).find((e) =>
    e?.operatingContract?.rft || e?.roleId === "revenue_follow_through",
  ) ?? null;
}

function parseTime(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function startOfUtcDayMs(nowISO = null) {
  const base = nowISO ? new Date(nowISO) : new Date();
  return Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    0,
    0,
    0,
    0,
  );
}

function isWithinUtcDay(value, nowISO = null) {
  const ms = parseTime(value);
  if (ms == null) return false;
  const start = startOfUtcDayMs(nowISO);
  const end = start + 24 * 60 * 60 * 1000;
  return ms >= start && ms < end;
}

function formatIsoMinute(value) {
  const ms = parseTime(value);
  if (ms == null) return null;
  return new Date(ms).toISOString().slice(11, 16) + "Z";
}

function formatReasonLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "unknown";
  return raw.replace(/[_-]+/g, " ");
}

function sortNewestFirst(rows, readAt) {
  return [...rows].sort((a, b) => (parseTime(readAt(b)) ?? 0) - (parseTime(readAt(a)) ?? 0));
}

function buildItemEvidence(item) {
  const refs = [];
  if (item?.cardId) {
    refs.push({ kind: "rft_card", providerId: String(item.cardId), label: item.title ?? null });
  }
  for (const ev of asArray(item?.evidence)) {
    if (ev?.providerId) refs.push(ev);
  }
  if (!refs.length && item?.id) {
    refs.push({ kind: "outcome_item", providerId: String(item.id), label: item.title ?? null });
  }
  return refs;
}

function pickLatestEscalation(cards, failedEntries) {
  const ranked = [
    ...cards.map((card) => ({ kind: "card", at: card?.rft?.lastTransitionAt ?? card?.updatedAt ?? null, value: card })),
    ...failedEntries.map((entry) => ({ kind: "fire", at: entry?.at ?? null, value: entry })),
  ].filter((row) => row.at);
  ranked.sort((a, b) => (parseTime(b.at) ?? 0) - (parseTime(a.at) ?? 0));
  return ranked[0] ?? null;
}

function explainEscalation({ installation, businessId, query, latest = false }) {
  const crm = readCrmState(installation);
  const pipe = asArray(crm.pipelines).find((p) => String(p.id) === RFT_PIPELINE_ID);
  const cards = asArray(pipe?.cards).filter((c) => String(c?.rft?.state) === "Exception");
  const q = String(query ?? "").toLowerCase();
  let card = null;
  if (q) {
    card = cards.find((c) => String(c.title ?? "").toLowerCase().includes(q))
      ?? cards.find((c) => String(c.title ?? "").toLowerCase().includes(q.split(/\s+/)[0]));
  }
  if (!card && cards.length === 1) card = cards[0];
  const ledger = readSpecialtyFireLedger(installation);
  const failed = asArray(ledger.entries).filter((e) => e.ok === false);
  if (!card && latest) {
    const latestEscalation = pickLatestEscalation(cards, failed);
    if (latestEscalation?.kind === "card") {
      card = latestEscalation.value;
    }
    if (latestEscalation?.kind === "fire") {
      const hit = latestEscalation.value;
      return groundedReply({
        message: [
          `The latest recorded escalation is a failed follow-through fire${hit.brief ? ` for “${hit.brief}”` : ""}.`,
          `Reason recorded: ${hit.skipReason || "unknown"}.`,
          hit.at ? `At: ${hit.at}.` : null,
          hit.workId ? `Work id: ${hit.workId}.` : "No Work id was stored on this fire.",
          "I will not invent anything beyond the fire ledger.",
        ].filter(Boolean).join(" "),
        evidence: [
          { kind: "specialty_fire_id", providerId: String(hit.id), source: "specialtyFireLedger" },
          hit.workId ? { kind: "work_item_id", providerId: String(hit.workId) } : null,
        ].filter(Boolean),
        href: businessId ? `/b/${businessId}/outcomes` : null,
      });
    }
  }
  if (!card && !q && cards.length > 1) {
    return refuse(
      "Several opportunities are in Exception. Name which one (for example: “Why was Acme escalated?”).",
      cards.slice(0, 5).map((c) => ({
        kind: "rft_card",
        providerId: String(c.id),
        label: c.title,
      })),
    );
  }
  if (!card) {
    if (q) {
      const hit = failed.find((e) =>
        String(e.brief ?? e.payloadSummary ?? "").toLowerCase().includes(q),
      );
      if (hit) {
        return groundedReply({
          message: [
            `I found a failed follow-through fire matching “${query}”.`,
            `Reason recorded: ${hit.skipReason || "unknown"}.`,
            hit.workId ? `Work id: ${hit.workId}.` : "No Work id was stored on this fire.",
            "I will not invent a narrative beyond the fire ledger.",
          ].join(" "),
          evidence: [
            { kind: "specialty_fire_id", providerId: String(hit.id), source: "specialtyFireLedger" },
            hit.workId ? { kind: "work_item_id", providerId: String(hit.workId) } : null,
          ].filter(Boolean),
          href: businessId ? `/b/${businessId}/outcomes` : null,
        });
      }
    }
    return refuse(
      query
        ? `No Exception opportunity or failed fire matched “${query}”. Connect channels and check Outcomes for evidence-backed exceptions.`
        : "No Exception opportunities are stored right now. Escalations appear when an RFT card enters Exception or a specialty fire fails.",
      [],
    );
  }

  const trace = getRftOpportunityTrace(installation, card.id);
  const history = asArray(trace?.rft?.history);
  const last = history[history.length - 1] ?? null;
  const evidence = asArray(trace?.rft?.evidence).filter((e) => e?.providerId);
  if (!evidence.length && !history.length) {
    return refuse(
      `“${card.title}” is in Exception, but no evidence or history is stored — I will not invent why.`,
      [{ kind: "rft_card", providerId: String(card.id), label: card.title }],
    );
  }

  const lines = [
    `“${card.title}” is in Exception.`,
    last?.note ? `Last note: ${last.note}.` : null,
    last?.eventType ? `Last event: ${last.eventType}.` : null,
    last?.at ? `At: ${last.at}.` : null,
    evidence.length
      ? `Evidence: ${evidence.map((e) => `${e.kind}=${e.providerId}`).join(", ")}.`
      : "No provider evidence ids on the card yet.",
    `Contract ${trace?.rft?.contractVersion ?? "unknown"} · hash ${(trace?.rft?.contentHash ?? "").slice(0, 12) || "n/a"}…`,
  ].filter(Boolean);

  return groundedReply({
    message: lines.join(" "),
    evidence: [
      ...evidence,
      { kind: "rft_card", providerId: String(card.id), source: "rft_pipeline" },
    ],
    href: businessId ? `/b/${businessId}/outcomes` : null,
  });
}

function listApprovalsNeeded({ installation, businessId }) {
  const crm = readCrmState(installation);
  const pipe = asArray(crm.pipelines).find((p) => String(p.id) === RFT_PIPELINE_ID);
  const pendingCards = sortNewestFirst(
    asArray(pipe?.cards).filter((card) => String(card?.rft?.state ?? "") === "ApprovalRequired"),
    (card) => card?.rft?.lastTransitionAt ?? card?.updatedAt ?? null,
  );

  if (!pendingCards.length) {
    return refuse(
      "I do not see any RFT opportunities currently stored in ApprovalRequired, and this installation does not expose live approval-runtime requests here.",
      [],
    );
  }

  const lines = [
    `These items are waiting for your approval (${pendingCards.length}):`,
    ...pendingCards.slice(0, 10).map((card) => {
      const when = card?.rft?.lastTransitionAt ? ` · ${card.rft.lastTransitionAt}` : "";
      const outcome = card?.rft?.outcomeType ? ` · ${card.rft.outcomeType}` : "";
      return `• ${card.title || "Opportunity"}${outcome}${when}`;
    }),
  ];

  return groundedReply({
    message: lines.join("\n"),
    evidence: pendingCards.slice(0, 10).map((card) => ({
      kind: "rft_card",
      providerId: String(card.id),
      label: card.title ?? null,
      source: "rft_pipeline",
    })),
    href: businessId ? `/b/${businessId}/intelligence` : null,
  });
}

function whatChangedToday({ installation, businessId, nowISO = null }) {
  const changed = [];
  const ledger = readSpecialtyFireLedger(installation);
  for (const entry of asArray(ledger.entries)) {
    if (!isWithinUtcDay(entry.at, nowISO)) continue;
    changed.push({
      at: entry.at,
      line: `• ${formatIsoMinute(entry.at) || "today"} · specialty fire · ${entry.brief || entry.eventLabel || entry.eventType || "activity"}${entry.skipReason ? ` · ${entry.skipReason}` : ""}`,
      evidence: [
        { kind: "specialty_fire_id", providerId: String(entry.id), source: "specialtyFireLedger" },
        entry.workId ? { kind: "work_item_id", providerId: String(entry.workId) } : null,
      ].filter(Boolean),
    });
  }

  const crm = readCrmState(installation);
  const pipe = asArray(crm.pipelines).find((p) => String(p.id) === RFT_PIPELINE_ID);
  for (const card of asArray(pipe?.cards)) {
    for (const step of asArray(card?.rft?.history)) {
      if (!isWithinUtcDay(step?.at, nowISO)) continue;
      changed.push({
        at: step.at,
        line: `• ${formatIsoMinute(step.at) || "today"} · ${card.title || "Opportunity"} · ${step.from ?? "—"} -> ${step.to ?? "—"}${step.eventType ? ` · ${step.eventType}` : ""}${step.note ? ` · ${step.note}` : ""}`,
        evidence: [{ kind: "rft_card", providerId: String(card.id), label: card.title ?? null, source: "rft_pipeline" }],
      });
    }
  }

  const ordered = sortNewestFirst(changed, (row) => row.at);
  if (!ordered.length) {
    return refuse("I do not have any stored specialty fires or RFT transitions for today yet.", []);
  }

  return groundedReply({
    message: ["Recorded changes today (UTC):", ...ordered.slice(0, 12).map((row) => row.line)].join("\n"),
    evidence: ordered.flatMap((row) => row.evidence).slice(0, 20),
    href: businessId ? `/b/${businessId}/outcomes` : null,
  });
}

function listMissingEvidence({ installation, businessId }) {
  const ledger = composeOutcomesLedger({ installation, businessId });
  const missing = asArray(ledger.items).filter((item) => (
    item?.status === "unproven"
    || (item?.status === "exception" && !hasProviderProof(item?.evidence))
  ));

  if (!missing.length) {
    return refuse("I do not see any stored outcomes or RFT cards that are missing provider proof right now.", []);
  }

  const lines = [
    `These records are missing provider evidence (${missing.length}):`,
    ...missing.slice(0, 10).map((item) => {
      const when = item.at ? ` · ${item.at}` : "";
      const state = item.state ? ` · ${item.state}` : "";
      const detail = item.status === "exception"
        ? "Exception without provider proof"
        : "Unproven";
      return `• ${item.title || item.id}${state}${when} · ${detail}`;
    }),
  ];

  return groundedReply({
    message: lines.join("\n"),
    evidence: missing.flatMap((item) => buildItemEvidence(item)).slice(0, 20),
    href: businessId ? `/b/${businessId}/outcomes` : null,
  });
}

function addHotspot(counts, {
  label,
  source,
  evidence = [],
  sample = null,
} = {}) {
  const raw = String(label ?? "").trim();
  if (!raw) return;
  const key = raw.toLowerCase();
  const current = counts.get(key) ?? {
    key,
    label: raw,
    total: 0,
    bySource: {},
    evidence: [],
    sample: sample ?? null,
  };
  current.total += 1;
  current.bySource[source] = (current.bySource[source] ?? 0) + 1;
  current.sample = current.sample ?? sample ?? raw;
  current.evidence.push(...asArray(evidence).filter((entry) => entry?.providerId));
  counts.set(key, current);
}

function ruleEscalationHotspots({ installation, businessId }) {
  const counts = new Map();
  const learning = readGovernedLearning(installation);
  for (const correction of asArray(learning.corrections)) {
    addHotspot(counts, {
      label: correction.reasonCode ?? correction.reasonLabel,
      source: "governed_learning",
      evidence: asArray(correction.evidence).length
        ? correction.evidence
        : [{ kind: "correction_id", providerId: String(correction.correctionId ?? "") }],
      sample: correction.reasonLabel ?? correction.reasonCode ?? null,
    });
  }

  const specialty = readSpecialtyFireLedger(installation);
  for (const entry of asArray(specialty.entries).filter((row) => row.ok === false)) {
    addHotspot(counts, {
      label: entry.skipReason,
      source: "specialty_failure",
      evidence: [{ kind: "specialty_fire_id", providerId: String(entry.id), source: "specialtyFireLedger" }],
      sample: entry.brief ?? entry.eventType ?? null,
    });
  }

  const crm = readCrmState(installation);
  const pipe = asArray(crm.pipelines).find((p) => String(p.id) === RFT_PIPELINE_ID);
  for (const card of asArray(pipe?.cards).filter((row) => String(row?.rft?.state ?? "") === "Exception")) {
    const latestExceptionStep = [...asArray(card?.rft?.history)].reverse().find((step) =>
      String(step?.to ?? "") === "Exception" || String(step?.eventType ?? "") === "EXCEPTION_RAISED",
    );
    addHotspot(counts, {
      label: card?.rft?.failureCondition ?? latestExceptionStep?.note ?? latestExceptionStep?.eventType,
      source: "rft_exception",
      evidence: [{ kind: "rft_card", providerId: String(card.id), label: card.title ?? null, source: "rft_pipeline" }],
      sample: card.title ?? null,
    });
  }

  const ranked = [...counts.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  if (!ranked.length) {
    return refuse("I do not have enough stored corrections, specialty failures, or Exception traces to rank escalation hotspots yet.", []);
  }

  const top = ranked.slice(0, 3);
  const lines = [
    "I can rank recorded escalation reasons, but not a specific Company Rule id unless the trace stored one.",
    "Most common hotspots:",
    ...top.map((entry) => {
      const sourceBits = Object.entries(entry.bySource).map(([source, count]) => `${count} ${source.replace(/_/g, " ")}`);
      return `• ${formatReasonLabel(entry.label)} — ${entry.total} signal(s)${sourceBits.length ? ` · ${sourceBits.join(", ")}` : ""}`;
    }),
  ];

  return groundedReply({
    message: lines.join("\n"),
    evidence: top.flatMap((entry) => entry.evidence).slice(0, 20),
    href: businessId ? `/b/${businessId}/knowledge` : null,
  });
}

function listProposalsWithoutNextStep({ installation, businessId }) {
  const observation = readRftObservation(installation);
  const baselineMetric = observation.baseline?.metrics?.proposalsWithoutFollowUp;
  const crm = readCrmState(installation);
  const pipe = asArray(crm.pipelines).find((p) => String(p.id) === RFT_PIPELINE_ID);
  const openProposals = asArray(pipe?.cards).filter((card) => {
    const rft = card.rft;
    if (!rft) return false;
    const title = String(card.title ?? "");
    if (!/proposal/i.test(title)) return false;
    return !["Verified", "OutcomeRecorded", "Closed"].includes(String(rft.state ?? ""));
  });

  const meetings = asArray(observation.events).filter((e) =>
    e.kind === "meeting" && e.hasNextStep === false,
  );

  if (!openProposals.length && !meetings.length) {
    const reason = baselineMetric?.note
      || "No open proposal-titled opportunities and no meetings marked without a next step in the observation window.";
    return refuse(reason, asArray(baselineMetric?.evidence).slice(0, 5));
  }

  const lines = [
    openProposals.length
      ? `Open proposal opportunities without a completed outcome (${openProposals.length}):`
      : null,
    ...openProposals.slice(0, 10).map((c) =>
      `• ${c.title} — state ${c.rft?.state}${c.rft?.evidence?.[0]?.providerId ? ` · evidence ${c.rft.evidence[0].kind}=${c.rft.evidence[0].providerId}` : " · no provider evidence"}`),
    meetings.length
      ? `Meetings without a recorded next step (${meetings.length}):`
      : null,
    ...meetings.slice(0, 8).map((m) =>
      `• ${m.title || "Meeting"} · ${m.evidence?.[0] ? `${m.evidence[0].kind}=${m.evidence[0].providerId}` : "no calendar id"}`),
  ].filter(Boolean);

  const evidence = [
    ...openProposals.flatMap((c) => asArray(c.rft?.evidence)).filter((e) => e?.providerId).slice(0, 20),
    ...meetings.flatMap((m) => asArray(m.evidence)).slice(0, 20),
  ];

  return groundedReply({
    message: lines.join("\n"),
    evidence,
    href: businessId ? `/b/${businessId}/outcomes` : null,
  });
}

function draftSlaChange({ installation, businessId, minutes }) {
  const employee = findRftEmployee(installation);
  if (!employee) {
    return refuse(
      "No Revenue Follow-Through teammate/contract is installed, so I cannot draft an SLA change.",
      [],
    );
  }
  const rft = normalizeRftServiceStandard(employee.operatingContract?.rft ?? null);
  const nextMinutes = Number(minutes) || 60;
  const presented = presentRftServiceStandard(rft);
  return deepFreeze({
    handled: true,
    inventedFacts: false,
    message: [
      `Draft (not applied): change acknowledge promise from ${rft.sla.acknowledgeWithinMinutes} minutes to ${nextMinutes} minutes.`,
      presented.slaSummary,
      "Confirm on Company Rules / operating contract to apply — Ask will not silently mutate the contract.",
    ].join(" "),
    evidence: [
      {
        kind: "rft_content_hash",
        providerId: rft.contentHash,
        source: "operating_contract",
      },
    ],
    actionDraft: {
      type: "rft_sla_patch",
      status: "needs_confirmation",
      employeeId: employee.employeeId ?? employee.id ?? null,
      patch: {
        rft: {
          sla: {
            acknowledgeWithinMinutes: nextMinutes,
          },
        },
      },
      confirmHref: businessId
        ? `/b/${encodeURIComponent(businessId)}/knowledge`
        : null,
      applyPath: businessId && (employee.employeeId || employee.id)
        ? `/api/businesses/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employee.employeeId || employee.id)}/operating-contract`
        : null,
    },
    href: businessId ? `/b/${businessId}/knowledge` : null,
  });
}

function draftReassign({ installation, businessId, fromName, toName }) {
  const employee = findRftEmployee(installation);
  const rft = normalizeRftServiceStandard(employee?.operatingContract?.rft ?? null);
  const currentOwner = rft.exceptionOwner || "customer_owner";
  if (!fromName && !toName) {
    return refuse(
      "Say who is unavailable and who should cover (for example: “Sarah is on vacation — reassign to Alex”).",
      [],
    );
  }
  const nextOwner = toName
    ? `owner:${toName}`
    : (fromName ? `owner:coverage_for_${fromName}` : currentOwner);

  return deepFreeze({
    handled: true,
    inventedFacts: false,
    message: [
      `Draft (not applied): exception owner from “${currentOwner}” → “${nextOwner}”.`,
      fromName ? `${fromName} marked unavailable in this draft.` : null,
      "Confirm on Company Rules to apply. This does not reassign live Work items until you confirm and update assignments.",
    ].filter(Boolean).join(" "),
    evidence: rft.contentHash
      ? [{ kind: "rft_content_hash", providerId: rft.contentHash, source: "operating_contract" }]
      : [],
    actionDraft: {
      type: "rft_exception_owner_patch",
      status: "needs_confirmation",
      employeeId: employee?.employeeId ?? employee?.id ?? null,
      fromName: fromName ?? null,
      toName: toName ?? null,
      patch: {
        rft: {
          exceptionOwner: nextOwner,
        },
      },
      confirmHref: businessId ? `/b/${encodeURIComponent(businessId)}/knowledge` : null,
      applyPath: businessId && (employee?.employeeId || employee?.id)
        ? `/api/businesses/${encodeURIComponent(businessId)}/team/${encodeURIComponent(employee.employeeId || employee.id)}/operating-contract`
        : null,
    },
    href: businessId ? `/b/${businessId}/knowledge` : null,
  });
}

function previewApprovalPolicy({ installation, businessId }) {
  const employee = findRftEmployee(installation);
  if (!employee) {
    return refuse("No RFT contract installed to preview approval policy against.", []);
  }
  const rft = normalizeRftServiceStandard(employee.operatingContract?.rft ?? null);
  const current = rft.approvalRules.customerFacingRequiresApproval;
  const ledger = composeOutcomesLedger({ installation, businessId });
  const approvalHeavy = asArray(ledger.items).filter((i) =>
    i.humanInvolvement === "approval_required" || i.humanInvolvement === "human_touched",
  ).length;

  return deepFreeze({
    handled: true,
    inventedFacts: false,
    message: [
      `Preview only — nothing changed.`,
      `Today: customer-facing requires approval = ${current}.`,
      `If existing-customer scheduling may auto (currently ${rft.approvalRules.existingCustomerSchedulingMayAuto}): more meetings could skip ApprovalRequired.`,
      `If you also stopped requiring approval for existing-customer outbound, ${approvalHeavy} recent outcome(s) with human involvement would be the comparison set — not a guarantee.`,
      "To change policy, confirm a contract patch on Company Rules after replay/shadow (Plan 7).",
    ].join(" "),
    evidence: [
      { kind: "rft_content_hash", providerId: rft.contentHash, source: "operating_contract" },
    ],
    actionDraft: {
      type: "rft_approval_policy_preview",
      status: "preview_only",
      patch: {
        rft: {
          approvalRules: {
            existingCustomerSchedulingMayAuto: true,
            newProspectOutboundRequiresApproval: true,
            customerFacingRequiresApproval: true,
          },
        },
      },
      note: "Preview keeps customerFacingRequiresApproval true for new prospects; only existing-customer scheduling may auto in this what-if.",
    },
    href: businessId ? `/b/${businessId}/knowledge` : null,
  });
}

function groundedReply({ message, evidence = [], href = null, actionDraft = null }) {
  const cites = asArray(evidence).filter((e) => e?.providerId);
  if (!cites.length && !actionDraft) {
    return refuse(message || "No evidence available.", []);
  }
  return deepFreeze({
    handled: true,
    inventedFacts: false,
    message,
    evidence: cites,
    actionDraft: actionDraft ?? null,
    href,
  });
}

function refuse(message, evidence = []) {
  return deepFreeze({
    handled: true,
    inventedFacts: false,
    refused: true,
    message: String(message),
    evidence: asArray(evidence).filter((e) => e?.providerId),
    actionDraft: null,
    href: null,
  });
}

/**
 * Format assistant message with optional action draft footer.
 */
export function formatOperatingCommandReply(result) {
  if (!result?.handled) return null;
  const parts = [String(result.message ?? "")];
  if (result.actionDraft?.status === "needs_confirmation") {
    parts.push("");
    parts.push("Action draft ready — confirm in Company Rules (or apply via operating-contract PATCH). Nothing was changed yet.");
  }
  if (result.actionDraft?.status === "preview_only") {
    parts.push("");
    parts.push("What-if only — no contract mutation.");
  }
  if (result.evidence?.length) {
    parts.push("");
    parts.push(`Sources: ${result.evidence.map((e) => `${e.kind}:${e.providerId}`).slice(0, 8).join("; ")}`);
  }
  return parts.join("\n");
}
