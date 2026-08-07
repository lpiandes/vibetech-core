/**
 * Plan 6 — historical observation + evidence-linked baseline.
 * Every metric either links to evidence ids or is explicitly not_observable.
 */
import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { readGmailInboxState } from "../../../integrations/gmail/GmailInboxStore.js";
import { readCrmState } from "../../../crm/CrmStore.js";
import { RFT_PIPELINE_ID } from "./rftCatalog.js";
import { normalizeRftServiceStandard } from "./rftContract.js";

export const RFT_OBSERVATION_VERSION = 1;
export const DEFAULT_OBSERVE_WINDOW_DAYS = 90;

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function parseTime(value) {
  const ms = Date.parse(String(value ?? ""));
  return Number.isFinite(ms) ? ms : null;
}

function withinWindow(iso, windowStartMs, windowEndMs) {
  const ms = parseTime(iso);
  if (ms == null) return false;
  return ms >= windowStartMs && ms <= windowEndMs;
}

function median(sortedNums) {
  if (!sortedNums.length) return null;
  const mid = Math.floor(sortedNums.length / 2);
  if (sortedNums.length % 2 === 0) {
    return (sortedNums[mid - 1] + sortedNums[mid]) / 2;
  }
  return sortedNums[mid];
}

function percentile(sortedNums, p) {
  if (!sortedNums.length) return null;
  const idx = Math.min(sortedNums.length - 1, Math.max(0, Math.ceil((p / 100) * sortedNums.length) - 1));
  return sortedNums[idx];
}

function channelFlags(connectionStatuses = {}) {
  const connected = (keys) => keys.some((key) => {
    const raw = connectionStatuses?.[key];
    const status = String(
      typeof raw === "object" ? (raw.status ?? raw.state ?? "") : (raw ?? ""),
    ).toUpperCase();
    return status === "CONNECTED" || status === "VERIFIED" || status === "PROVEN" || status === "OK" || raw === true;
  });
  return {
    email: connected(["business_email", "gmail"]),
    calendar: connected(["calendar", "google_calendar"]),
    forms: connected(["website_forms", "forms", "meta_lead_ads"]) || false,
  };
}

/**
 * Build discrete observation events from channel stores (no invented rows).
 */
export function buildObservationEventsFromInstallation({
  installation = null,
  windowDays = DEFAULT_OBSERVE_WINDOW_DAYS,
  nowISO = null,
  connectionStatuses = {},
} = {}) {
  const at = nowISO ?? new Date().toISOString();
  const endMs = parseTime(at) ?? Date.now();
  const startMs = endMs - (Math.max(1, Number(windowDays) || DEFAULT_OBSERVE_WINDOW_DAYS) * 86_400_000);
  const channels = channelFlags(connectionStatuses);
  const events = [];
  const sources = {
    email: { available: channels.email, messageCount: 0 },
    calendar: { available: channels.calendar, eventCount: 0 },
    forms: { available: false, contactCount: 0 },
    rftCards: { available: true, cardCount: 0 },
  };

  const inbox = readGmailInboxState(installation);
  const messages = asArray(inbox.messages);
  sources.email.messageCount = messages.length;
  if (channels.email) {
    for (const msg of messages) {
      const receivedAt = msg.receivedAt || msg.date || msg.syncedAt;
      if (!withinWindow(receivedAt, startMs, endMs)) continue;
      const id = String(msg.gmailMessageId || msg.id || "").trim();
      if (!id) continue;
      events.push({
        id: `email_${id}`,
        kind: "inbound_email",
        at: new Date(parseTime(receivedAt)).toISOString(),
        subject: msg.subject ?? null,
        from: msg.from ?? null,
        personId: msg.personId ?? null,
        evidence: [{ kind: "gmail_message_id", providerId: id, source: "gmail_inbox" }],
      });
    }
  }

  const crm = readCrmState(installation);
  const calendarEvents = asArray(crm.calendarEvents);
  sources.calendar.eventCount = calendarEvents.length;
  if (channels.calendar) {
    for (const ev of calendarEvents) {
      const start = ev.start || ev.updatedAt;
      if (!withinWindow(start, startMs, endMs)) continue;
      const id = String(ev.externalId || ev.id || "").trim();
      if (!id) continue;
      const hasNextStep = Boolean(
        String(ev.description ?? "").match(/next\s*step|follow[- ]?up|action:/i)
        || String(ev.title ?? "").match(/follow[- ]?up/i),
      );
      events.push({
        id: `cal_${id}`,
        kind: "meeting",
        at: new Date(parseTime(start)).toISOString(),
        title: ev.title ?? null,
        hasNextStep,
        evidence: [{
          kind: "calendar_event_id",
          providerId: id,
          source: ev.source ?? "crm_calendar",
        }],
      });
    }
  }

  const formContacts = asArray(crm.contacts).filter((c) => {
    const tags = asArray(c.tags).map((t) => String(t).toLowerCase());
    const source = String(c.source ?? "").toLowerCase();
    return tags.some((t) => /form|website|lead/.test(t))
      || /form|website|inbound/.test(source)
      || String(c.kind ?? "") === "lead";
  });
  sources.forms.contactCount = formContacts.length;
  sources.forms.available = formContacts.length > 0 || channels.forms;
  for (const contact of formContacts) {
    const created = contact.createdAt || contact.updatedAt;
    if (created && !withinWindow(created, startMs, endMs)) continue;
    const id = String(contact.id ?? "").trim();
    if (!id) continue;
    events.push({
      id: `form_${id}`,
      kind: "form_lead",
      at: created ? new Date(parseTime(created)).toISOString() : at,
      name: contact.name ?? null,
      email: contact.email ?? null,
      evidence: [{
        kind: "form_submission_id",
        providerId: id,
        source: contact.source ?? "crm_contact",
      }],
    });
  }

  const rftPipe = asArray(crm.pipelines).find((p) => String(p.id) === RFT_PIPELINE_ID);
  for (const card of asArray(rftPipe?.cards)) {
    const rft = card.rft && typeof card.rft === "object" ? card.rft : null;
    if (!rft) continue;
    sources.rftCards.cardCount += 1;
    const created = rft.createdAt || card.updatedAt || card.createdAt;
    if (created && !withinWindow(created, startMs, endMs)) continue;
    events.push({
      id: `rft_${card.id}`,
      kind: "rft_opportunity",
      at: created ? new Date(parseTime(created)).toISOString() : at,
      title: card.title ?? null,
      state: rft.state ?? null,
      outcomeType: rft.outcomeType ?? null,
      evidence: asArray(rft.evidence).filter((e) => e?.providerId),
      history: asArray(rft.history),
    });
  }

  events.sort((a, b) => (parseTime(a.at) ?? 0) - (parseTime(b.at) ?? 0));

  return deepFreeze({
    version: RFT_OBSERVATION_VERSION,
    windowDays: Math.max(1, Number(windowDays) || DEFAULT_OBSERVE_WINDOW_DAYS),
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
    generatedAt: at,
    sources,
    events,
  });
}

/**
 * Compose baseline metrics. Missing channel → not_observable (never invent medians).
 */
export function composeBaselineReport({
  observation = null,
  installation = null,
  connectionStatuses = {},
  contract = null,
} = {}) {
  const obs = observation ?? buildObservationEventsFromInstallation({
    installation,
    connectionStatuses,
  });
  const rft = normalizeRftServiceStandard(
    contract?.rft
    ?? installation?.configuration?.employees?.find((e) => e?.operatingContract?.rft)?.operatingContract?.rft
    ?? null,
  );
  const slaMinutes = Number(rft.sla.acknowledgeWithinMinutes) || 5;
  const events = asArray(obs.events);
  const sources = obs.sources ?? {};

  const opportunities = events.filter((e) =>
    e.kind === "inbound_email" || e.kind === "form_lead" || e.kind === "rft_opportunity",
  );
  const opportunityEvidence = opportunities.flatMap((e) => asArray(e.evidence));

  const emailAvailable = Boolean(sources.email?.available);
  const calendarAvailable = Boolean(sources.calendar?.available);

  // First-response: for each inbound email, find next outbound-ish reply in same thread/person —
  // without outbound store we use RFT history Detected→Executing/Verified deltas when present.
  const responseDeltasMinutes = [];
  const responseEvidence = [];
  for (const opp of events.filter((e) => e.kind === "rft_opportunity")) {
    const hist = asArray(opp.history);
    const detected = hist.find((h) => String(h.to) === "Detected" || String(h.from) == null);
    const firstAction = hist.find((h) =>
      ["Executing", "Verified", "ActionProposed", "ApprovalRequired"].includes(String(h.to)),
    );
    if (!detected?.at || !firstAction?.at) continue;
    const delta = (parseTime(firstAction.at) - parseTime(detected.at)) / 60_000;
    if (!Number.isFinite(delta) || delta < 0) continue;
    responseDeltasMinutes.push(delta);
    responseEvidence.push(...asArray(opp.evidence).slice(0, 1));
  }

  const sortedDeltas = [...responseDeltasMinutes].sort((a, b) => a - b);
  const firstResponse = !emailAvailable && !sources.rftCards?.cardCount
    ? metricNotObservable("Email not connected and no RFT opportunity history.")
    : sortedDeltas.length
      ? {
        status: "observable",
        medianMinutes: median(sortedDeltas),
        p90Minutes: percentile(sortedDeltas, 90),
        sampleSize: sortedDeltas.length,
        slaMinutes,
        evidence: responseEvidence.slice(0, 20),
      }
      : metricNotObservable(
        emailAvailable
          ? "Not enough Detected→action history to compute first-response times."
          : "Email channel not connected.",
      );

  const oneBusinessDayMs = 86_400_000;
  const waiting = opportunities.filter((e) => {
    const age = (parseTime(obs.windowEnd) ?? Date.now()) - (parseTime(e.at) ?? 0);
    if (age < oneBusinessDayMs) return false;
    if (e.kind === "rft_opportunity") {
      return !["Verified", "OutcomeRecorded", "Closed"].includes(String(e.state ?? ""));
    }
    return true;
  });

  const meetings = events.filter((e) => e.kind === "meeting");
  const meetingsNoNext = calendarAvailable
    ? {
      status: "observable",
      count: meetings.filter((m) => !m.hasNextStep).length,
      totalMeetings: meetings.length,
      evidence: meetings.filter((m) => !m.hasNextStep).flatMap((m) => asArray(m.evidence)).slice(0, 30),
    }
    : metricNotObservable("Calendar not connected.");

  const proposals = events.filter((e) =>
    e.kind === "rft_opportunity"
    && /proposal/i.test(String(e.title ?? ""))
    && !["Verified", "OutcomeRecorded", "Closed"].includes(String(e.state ?? "")),
  );
  const proposalsNoFollowUp = {
    status: "observable",
    count: proposals.length,
    evidence: proposals.flatMap((p) => asArray(p.evidence)).slice(0, 20),
    note: proposals.length
      ? null
      : "No open proposal-titled opportunities in window (may be not labeled).",
  };

  const wonIncomplete = events.filter((e) =>
    e.kind === "rft_opportunity"
    && (String(e.outcomeType ?? "") === "Won" || /won/i.test(String(e.title ?? "")))
    && String(e.state) !== "Closed",
  );

  return deepFreeze({
    version: RFT_OBSERVATION_VERSION,
    windowDays: obs.windowDays,
    windowStart: obs.windowStart,
    windowEnd: obs.windowEnd,
    generatedAt: obs.generatedAt ?? new Date().toISOString(),
    sources: obs.sources,
    eventCount: events.length,
    metrics: {
      opportunitiesDetected: {
        status: opportunities.length || emailAvailable || sources.forms?.available
          ? "observable"
          : "not_observable",
        count: opportunities.length,
        evidence: opportunityEvidence.slice(0, 40),
        reason: opportunities.length
          ? null
          : (emailAvailable || sources.forms?.available
            ? "No inbound opportunities in the observation window."
            : "Connect email or forms to observe opportunities."),
      },
      firstResponse,
      waitingOverOneBusinessDay: {
        status: "observable",
        count: waiting.length,
        evidence: waiting.flatMap((w) => asArray(w.evidence)).slice(0, 30),
      },
      meetingsWithoutNextStep: meetingsNoNext,
      proposalsWithoutFollowUp: proposalsNoFollowUp,
      wonIncompleteHandoffs: {
        status: "observable",
        count: wonIncomplete.length,
        evidence: wonIncomplete.flatMap((w) => asArray(w.evidence)).slice(0, 20),
        note: rft.sla.wonHandoffRequired
          ? "Contract requires won handoff before close."
          : null,
      },
    },
    honesty: {
      message: "Baseline numbers only appear when backed by synced evidence. Missing channels show as not observable — medians are never invented.",
      volume: {
        emailMessages: sources.email?.messageCount ?? 0,
        calendarEvents: sources.calendar?.eventCount ?? 0,
        formLeads: sources.forms?.eventCount ?? sources.forms?.leadCount ?? 0,
        rftCards: sources.rftCards?.cardCount ?? 0,
        totalEvents: events.length,
        note: events.length === 0
          ? "Zero events in window — connect channels or import history before treating baseline as a value report."
          : null,
      },
    },
  });
}

function metricNotObservable(reason) {
  return {
    status: "not_observable",
    count: null,
    medianMinutes: null,
    p90Minutes: null,
    sampleSize: 0,
    evidence: [],
    reason,
  };
}

export function readRftObservation(installation = null) {
  const raw = installation?.configuration?.rftObservation;
  if (!raw || typeof raw !== "object") {
    return {
      version: RFT_OBSERVATION_VERSION,
      baseline: null,
      events: [],
      importedAt: null,
      windowDays: DEFAULT_OBSERVE_WINDOW_DAYS,
    };
  }
  return {
    version: Number(raw.version) || RFT_OBSERVATION_VERSION,
    baseline: raw.baseline ?? null,
    events: asArray(raw.events),
    importedAt: raw.importedAt ?? null,
    windowDays: Number(raw.windowDays) || DEFAULT_OBSERVE_WINDOW_DAYS,
    windowStart: raw.windowStart ?? null,
    windowEnd: raw.windowEnd ?? null,
    sources: raw.sources ?? null,
  };
}

export async function persistRftObservation({
  platformStore,
  installation,
  observation,
  actorId = "rft_observe",
} = {}) {
  if (!platformStore || !installation) return null;
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "rft_observe",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    configuration: {
      ...(installation.configuration ?? {}),
      rftObservation: observation,
    },
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return observation;
}

/**
 * Rebuild observation + baseline from current channel stores and persist.
 */
export async function runHistoricalObservation({
  platformStore,
  installation,
  connectionStatuses = {},
  windowDays = DEFAULT_OBSERVE_WINDOW_DAYS,
  actorId = "rft_observe",
  nowISO = null,
} = {}) {
  const built = buildObservationEventsFromInstallation({
    installation,
    windowDays,
    nowISO,
    connectionStatuses,
  });
  const baseline = composeBaselineReport({
    observation: built,
    installation,
    connectionStatuses,
  });
  const payload = deepFreeze({
    version: RFT_OBSERVATION_VERSION,
    importedAt: built.generatedAt,
    windowDays: built.windowDays,
    windowStart: built.windowStart,
    windowEnd: built.windowEnd,
    sources: built.sources,
    events: built.events,
    baseline,
  });
  if (platformStore && installation) {
    const fresh = await platformStore.getBusinessOSInstallation(installation.businessId).catch(() => installation);
    await persistRftObservation({
      platformStore,
      installation: fresh ?? installation,
      observation: payload,
      actorId,
    });
  }
  return payload;
}
