import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { presentEmployeeOperatingStatus } from "./presentEmployeeOperatingStatus.js";
import { presentTeammateHomeGlance } from "./presentTeammateHomeGlance.js";

/**
 * Supervision Home composition — presentation only from existing Mission Control experience.
 * Never invents activity; never mutates Business OS.
 */
export function composeOperatingHomeSupervision({
  experience = null,
  ownerFirstName = null,
  setupChecklist = [],
  businessId = null,
} = {}) {
  if (!experience || typeof experience !== "object") {
    return deepFreeze({
      contract: "OperatingHomeSupervision/v1",
      available: false,
      greeting: buildGreeting(ownerFirstName),
      operatingSummary: {
        headline: "Your business is getting ready.",
        detail: "Operating signals will appear here once the business is live.",
      },
      recentActivity: [],
      needsDecision: emptyDecisionSection(),
      approvalsInbox: emptyApprovalsSection(),
      workingNow: [],
      digitalWorkforce: [],
      recentOutcomes: [],
      businessOverview: [],
      conversations: [],
      setup: normalizeSetup(setupChecklist),
      sectionOrder: DEFAULT_SECTION_ORDER,
    });
  }

  const attention = asArray(experience.waitingOnYou);
  const approvalAttention = attention.filter((item) => String(item.sourceType ?? "") === "approval");
  const otherAttention = attention.filter((item) => String(item.sourceType ?? "") !== "approval");
  const episodes = asArray(experience.activeBusinessEpisodes);
  const handled = asArray(experience.aiWorkforceActivity?.handledByVibeTech);
  const employees = asArray(experience.aiWorkforceActivity?.digitalEmployees);
  const timeline = asArray(experience.businessTimeline);
  const improvements = asArray(experience.recentlyImproved);
  const communications = asArray(experience.recentCommunications);
  const metrics = asArray(experience.criticalMetrics);
  const control = experience.businessControlStatus ?? null;
  const briefing = experience.executiveBriefing ?? null;

  const base = businessId ? `/b/${encodeURIComponent(businessId)}` : "";

  return deepFreeze({
    contract: "OperatingHomeSupervision/v1",
    available: true,
    fabricatedForbidden: true,
    greeting: buildGreeting(ownerFirstName),
    operatingSummary: buildOperatingSummary({ attention, episodes, control, briefing }),
    recentActivity: buildRecentActivity({ timeline, handled, improvements, briefing, base }).slice(0, 6),
    approvalsInbox: {
      title: "Approvals",
      subtitle: "Customer-facing send always needs a human grant",
      items: approvalAttention.slice(0, 8).map((item) => normalizeApprovalItem(item, base)),
      emptyTitle: "No outbound approvals waiting.",
      emptyDetail: "Drafts can be prepared freely; sends, SMS, and calls stay gated.",
      viewAllHref: base ? `${base}/intelligence` : null,
      winClaim: "Automation without silent outbound. Owners supervise; AI executes approved work.",
    },
    needsDecision: {
      title: "Needs your decision",
      items: otherAttention.slice(0, 8).map((item) => normalizeDecisionItem(item, base)),
      emptyTitle: "Nothing needs your judgment right now.",
      emptyDetail: "VIBETech will notify you when a decision is required.",
      recentOwnerDecision: findRecentOwnerDecision({ handled, improvements }),
      viewAllHref: base ? `${base}/intelligence` : null,
    },
    workingNow: episodes.slice(0, 5).map((ep) => normalizeEpisode(ep, base)),
    digitalWorkforce: employees.slice(0, 8).map((emp) => normalizeEmployee(emp, base)),
    recentOutcomes: buildOutcomes({ handled, improvements, base }).slice(0, 8),
    businessOverview: metrics.slice(0, 6).map((metric) => deepFreeze({
      id: String(metric.id),
      label: String(metric.label ?? metric.id),
      value: metric.value,
      trend: metric.trend == null ? null : String(metric.trend),
      evidence: metric.evidence == null ? null : humanizeEvidence(String(metric.evidence)),
    })),
    conversations: communications.slice(0, 8).map((entry) => normalizeConversation(entry, base)),
    setup: normalizeSetup(setupChecklist),
    sectionOrder: DEFAULT_SECTION_ORDER,
  });
}

export const DEFAULT_SECTION_ORDER = Object.freeze([
  "greeting",
  "recentActivity",
  "approvalsInbox",
  "needsDecision",
  "workingNow",
  "digitalWorkforce",
  "recentOutcomes",
  "businessOverview",
  "conversations",
]);

function normalizeApprovalItem(item, base) {
  const workHref = item.workHref
    ? resolveBusinessHref(item.workHref, base)
    : item.workId && base
      ? `${base}/work?workId=${encodeURIComponent(String(item.workId))}`
      : (base ? `${base}/intelligence` : null);
  const knowledgeCited = asArray(item.knowledgeCited ?? item.audit?.knowledgeCited).map(String).filter(Boolean);
  return deepFreeze({
    id: String(item.id),
    approvalId: item.approvalId ? String(item.approvalId) : null,
    title: String(item.title ?? "Approve outbound"),
    why: String(item.reason ?? item.summary ?? ""),
    channel: item.channel ? String(item.channel) : null,
    requestedBy: item.requestedBy ? String(item.requestedBy) : null,
    requestedAt: item.requestedAt ?? null,
    knowledgeCited,
    auditSummary: [
      item.channel ? `Channel: ${item.channel}` : null,
      item.requestedBy ? `Requested by: ${item.requestedBy}` : null,
      knowledgeCited.length ? `Knowledge: ${knowledgeCited.slice(0, 2).join(", ")}` : "No Knowledge cited yet",
    ].filter(Boolean).join(" · "),
    workHref,
    actions: asArray(item.availableActions)
      .map((action) => deepFreeze({
        id: String(action.id ?? action.label ?? "action"),
        label: String(action.label ?? "Open"),
        href: resolveBusinessHref(action.href, base),
        mutation: action.mutation ?? null,
      })),
  });
}

function buildGreeting(ownerFirstName) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = sanitizeFirstName(ownerFirstName);
  return deepFreeze({
    headline: name ? `${part}, ${name}.` : `${part}.`,
    firstName: name,
  });
}

function sanitizeFirstName(value) {
  if (!value) return null;
  const first = String(value).trim().split(/\s+/)[0];
  if (!first || first.length > 40) return null;
  if (/^[a-zA-Z][a-zA-Z'.-]*$/.test(first) === false) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function buildOperatingSummary({ attention, episodes, control, briefing }) {
  const decisionCount = attention.length;
  const activeCount = episodes.length;
  if (decisionCount > 0) {
    return deepFreeze({
      headline: decisionCount === 1
        ? "One item needs your decision."
        : `${decisionCount} items need your decision.`,
      detail: briefing?.nextHumanStep
        ? String(briefing.nextHumanStep)
        : "Review Needs your decision first, then continue supervising active work.",
    });
  }
  if (activeCount > 0) {
    return deepFreeze({
      headline: activeCount === 1
        ? "VIBETech is currently handling one active item."
        : `VIBETech is currently handling ${activeCount} active items.`,
      detail: control?.reason ? String(control.reason) : "Active work is progressing from recorded evidence.",
    });
  }
  if (control?.tone === "success" || /under control/i.test(String(control?.label ?? ""))) {
    return deepFreeze({
      headline: "Your business is running normally.",
      detail: control?.reason ? String(control.reason) : "Nothing is waiting on you right now.",
    });
  }
  return deepFreeze({
    headline: String(briefing?.summary ?? control?.label ?? "Your business is operating."),
    detail: briefing?.nextHumanStep ? String(briefing.nextHumanStep) : null,
  });
}

function buildRecentActivity({ timeline, handled, improvements, briefing, base }) {
  const rows = [];
  for (const line of asArray(briefing?.whatChanged).slice(0, 2)) {
    rows.push({
      id: `chg_${rows.length}`,
      timestamp: null,
      actorLabel: "VIBETech",
      title: String(line),
      description: null,
      href: null,
      state: "recorded",
      steps: [],
    });
  }
  for (const item of timeline) {
    rows.push({
      id: String(item.id ?? `tl_${rows.length}`),
      timestamp: item.occurredAt ?? item.at ?? null,
      actorLabel: String(item.actorName ?? "VIBETech"),
      title: String(item.title ?? "Operating activity"),
      description: item.summary == null ? null : String(item.summary),
      href: item.href == null ? null : String(item.href),
      state: "active",
      steps: [],
    });
  }
  for (const item of handled) {
    rows.push({
      id: String(item.id ?? `hd_${rows.length}`),
      timestamp: item.occurredAt ?? null,
      actorLabel: String(item.actorName ?? "VIBETech"),
      title: String(item.title ?? "Handled"),
      description: item.summary == null ? null : String(item.summary),
      href: item.href == null ? (base ? `${base}/work` : null) : String(item.href),
      state: String(item.result ?? "handled"),
      steps: [],
    });
  }
  for (const item of improvements) {
    rows.push({
      id: String(item.id ?? `imp_${rows.length}`),
      timestamp: item.at ?? null,
      actorLabel: "Architect",
      title: String(item.label ?? "Approved change installed"),
      description: "An owner-approved operating change was installed.",
      href: item.href == null ? (base ? `${base}/architect` : null) : String(item.href),
      state: "installed",
      steps: [],
    });
  }
  return deepFreeze(
    dedupeByTitle(rows)
      .sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp))
      .slice(0, 6)
      .map((row) => deepFreeze(row)),
  );
}

function normalizeDecisionItem(item, base) {
  const preferredHref = resolveBusinessHref(item.workHref ?? item.href, base);
  const actions = asArray(item.availableActions).map((action) => deepFreeze({
    id: String(action.id ?? action.label ?? "action"),
    label: String(action.label ?? "Open"),
    href: resolveBusinessHref(action.href, base) || preferredHref,
  })).filter((action) => action.href);
  if (preferredHref && !actions.some((action) => action.href === preferredHref)) {
    actions.unshift(deepFreeze({ id: "open_work", label: "Open draft", href: preferredHref }));
  }
  if (base && !actions.some((action) => /review|connect|open/i.test(action.label))) {
    actions.push(deepFreeze({ id: "review", label: "Review", href: `${base}/intelligence` }));
  }
  const why = String(item.sourceType) === "specialty_draft"
    ? [item.summary, item.reason].filter(Boolean).join(" — ")
    : String(item.reason ?? item.summary ?? item.businessImpact ?? "");
  return deepFreeze({
    id: String(item.id),
    title: String(item.title ?? "Decision needed"),
    why,
    evidenceSummary: summarizeEvidence(item),
    proposedAction: String(
      item.recommendedAction?.label
      ?? item.recommendedAction
      ?? actions[0]?.label
      ?? "Review",
    ),
    source: String(item.sourceType ?? item.partyName ?? "VIBETech"),
    ageOrDue: item.dueAt ?? item.waitingDuration ?? null,
    // Prefer priority level (high/medium/low). priorityBadge is a tone ("neutral") and must not drive UI badges.
    priority: item.priority ?? null,
    actions,
    askHref: base
      ? `${base}/architect?${item.intelligenceCandidateId
        ? `intelligenceCandidateId=${encodeURIComponent(item.intelligenceCandidateId)}`
        : item.sourceId && (item.sourceType === "work" || item.sourceType === "specialty_draft")
          ? `workId=${encodeURIComponent(item.sourceId)}`
          : ""}`.replace(/\?$/, "")
      : null,
  });
}

/** Map legacy package paths onto the in-business portal. */
function resolveBusinessHref(href, base) {
  if (href == null || href === "") return null;
  const raw = String(href).trim();
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/b/")) return raw;
  if (!base) return raw.startsWith("/") ? raw : null;
  const [pathPart, query = ""] = raw.split("?");
  const suffix = query ? `?${query}` : "";
  const path = pathPart || "/";
  if (path === "/connections" || path === "/integrations") return `${base}/integrations${suffix}`;
  if (path === "/attention" || path === "/intelligence") return `${base}/intelligence${suffix}`;
  if (path === "/architect") return `${base}/architect${suffix}`;
  if (path === "/mission-control" || path === "/home") return `${base}/home${suffix}`;
  if (path.startsWith("/")) return `${base}${path}${suffix}`;
  return `${base}/${path}${suffix}`;
}

function summarizeEvidence(item) {
  if (Array.isArray(item.evidence) && item.evidence.length) {
    return item.evidence
      .slice(0, 2)
      .map((entry) => String(entry.label ?? entry.summary ?? entry))
      .join(" · ");
  }
  if (item.explanation) return String(item.explanation);
  if (item.confidenceReason) return String(item.confidenceReason);
  if (item.summary) return String(item.summary);
  return null;
}

function normalizeEpisode(ep, base) {
  const handledSteps = asArray(ep.whatVibeTechHandled ?? ep.handledSteps).map((step, index) => deepFreeze({
    id: String(step.id ?? `step_${index}`),
    label: String(step.label ?? step.title ?? "Step completed"),
    done: true,
  }));
  return deepFreeze({
    id: String(ep.id ?? ep.episodeId ?? "episode"),
    title: String(ep.title ?? "Active work"),
    responsible: String(
      ep.assigneeName
      ?? ep.responsible
      ?? ep.primaryParty?.displayName
      ?? "VIBETech",
    ),
    currentState: humanizeStatus(ep.currentState ?? ep.operatingState ?? "In progress"),
    completedSteps: handledSteps.slice(0, 4),
    currentStep: ep.journeyLine ?? ep.summary ?? ep.currentState ?? null,
    nextStep: ep.nextStepLabel ?? ep.nextStep ?? null,
    relatedLabel: [
      ep.primaryParty?.displayName,
      ep.primarySubject?.displayName,
      ep.subjectName,
      ep.partyName,
    ].filter(Boolean).join(" · ") || null,
    waiting: /wait/i.test(String(ep.currentState ?? ep.operatingState ?? "")),
    openWorkHref: ep.href
      ? String(ep.href)
      : (base ? `${base}/work` : null),
  });
}

function normalizeEmployee(emp, base) {
  const operating = presentEmployeeOperatingStatus(emp);
  const employeeId = String(emp.id ?? emp.employeeId ?? "");
  const waitingFor = emp.waitingFor
    ?? emp.waitingOn
    ?? (emp.needsFromOwner && !/^nothing$/i.test(String(emp.needsFromOwner))
      ? String(emp.needsFromOwner)
      : null);
  const currentCustomer = emp.currentCustomer
    ?? emp.primaryParty?.displayName
    ?? emp.partyName
    ?? emp.relatedPartyName
    ?? null;
  const confidence = emp.confidenceLabel
    ?? emp.confidence
    ?? null;
  return deepFreeze({
    id: employeeId,
    name: String(emp.name ?? "Teammate"),
    responsibility: presentTeammateHomeGlance({
      purpose: emp.purpose,
      responsibility: emp.responsibility,
      role: emp.role,
      description: emp.description,
    }),
    status: operating.id,
    statusLabel: operating.label,
    currentAssignment: emp.currentHandling == null ? null : String(emp.currentHandling),
    currentCustomer: currentCustomer == null ? null : String(currentCustomer),
    waitingFor: waitingFor == null ? null : String(waitingFor),
    confidence: confidence == null ? null : String(confidence),
    activeItemCount: Number(emp.monitoring?.[0]?.count ?? (emp.currentHandling ? 1 : 0)),
    nextAction: emp.enablingAction
      ?? (emp.needsFromOwner && !/^nothing$/i.test(String(emp.needsFromOwner))
        ? String(emp.needsFromOwner)
        : emp.currentHandling
          ? "Continue assigned work"
          : null),
    lastActivity: emp.handledToday?.[0]?.label ?? emp.currentHandling ?? null,
    readinessBlockers: asArray(emp.blockers ?? (emp.blockedCapability ? [emp.blockedCapability] : []))
      .map((entry) => String(entry.message ?? entry)),
    askHref: employeeAskHref(base, employeeId, operating),
  });
}

function employeeAskHref(base, employeeId, operating) {
  if (!base || !employeeId) return null;
  const params = new URLSearchParams({ employeeId });
  if (operating.id === "needs_approval") {
    params.set("prompt", "Review what this operating responsibility needs approved and recommend the next step.");
  } else if (operating.id === "blocked" || operating.id === "needs_setup") {
    params.set("prompt", "Help me unblock this operating responsibility.");
  } else if (operating.id === "idle" || operating.id === "waiting") {
    params.set("prompt", "What should this responsibility take on next?");
  } else {
    params.set("prompt", "What is this responsibility working on?");
  }
  return `${base}/architect?${params.toString()}`;
}

function buildOutcomes({ handled, improvements, base }) {
  const rows = [];
  for (const item of handled) {
    const result = String(item.result ?? "handled");
    // Never present drafts as sent — only COMMUNICATION_SENT maps to "sent".
    if (/draft/i.test(String(item.title ?? "")) && result !== "sent") continue;
    const proven = Boolean(item.proven ?? item.hasEvidence ?? item.providerId ?? (result === "sent"));
    if (!proven && result !== "approved") continue;
    rows.push({
      id: String(item.id),
      title: String(item.title ?? "Outcome recorded"),
      result: humanizeOutcomeResult(result),
      when: item.occurredAt ?? null,
      who: String(item.actorName ?? "VIBETech"),
      related: formatRelated(item.relatedContext),
      href: item.href == null ? (base ? `${base}/work` : null) : String(item.href),
      proven,
    });
  }
  for (const item of improvements) {
    rows.push({
      id: String(item.id),
      title: String(item.label ?? "Approved change installed"),
      result: "Installed",
      when: item.at ?? null,
      who: "Architect",
      related: null,
      href: item.href == null ? (base ? `${base}/architect` : null) : String(item.href),
    });
  }
  return deepFreeze(rows.map((row) => deepFreeze(row)));
}

function normalizeConversation(entry, base) {
  const status = String(entry.status ?? entry.state ?? "").toLowerCase();
  const direction = /draft/.test(status)
    ? "Drafted — not sent"
    : /sent|outbound/.test(status)
      ? "Sent"
      : /received|inbound/.test(status)
        ? "Received"
        : /wait/.test(status)
          ? "Waiting"
          : entry.summary
            ? String(entry.summary)
            : "Conversation update";
  return deepFreeze({
    id: String(entry.id),
    person: String(entry.label ?? entry.subject ?? "Conversation"),
    context: entry.summary == null ? null : String(entry.summary),
    state: humanizeStatus(entry.status ?? "active"),
    direction,
    related: null,
    actionNeeded: /draft|wait|needs/i.test(status) ? "Review" : null,
    href: entry.href == null ? (base ? `${base}/inbox` : null) : String(entry.href),
  });
}

function normalizeSetup(checklist) {
  const incomplete = asArray(checklist).filter((item) => item && item.complete !== true);
  return deepFreeze({
    visible: incomplete.length > 0,
    incomplete: incomplete.map((item) => deepFreeze({
      id: String(item.id),
      title: String(item.title ?? item.id),
      actionLabel: String(item.actionLabel ?? "Continue"),
      href: String(item.href ?? "#"),
      summary: item.summary == null ? null : String(item.summary),
      whereInApp: item.whereInApp == null ? null : String(item.whereInApp),
      inApp: asArray(item.inApp).map(String),
      external: asArray(item.external).map(String),
    })),
  });
}

function emptyDecisionSection() {
  return deepFreeze({
    title: "Needs your decision",
    items: [],
    emptyTitle: "Nothing needs your judgment right now.",
    emptyDetail: "VIBETech will notify you when a decision is required.",
    recentOwnerDecision: null,
    viewAllHref: null,
  });
}

function emptyApprovalsSection() {
  return deepFreeze({
    title: "Approvals",
    subtitle: "Customer-facing send always needs a human grant",
    items: [],
    emptyTitle: "No outbound approvals waiting.",
    emptyDetail: "Drafts can be prepared freely; sends, SMS, and calls stay gated.",
    viewAllHref: null,
    winClaim: "Automation without silent outbound. Owners supervise; AI executes approved work.",
  });
}

function findRecentOwnerDecision({ handled, improvements }) {
  const approved = handled.find((item) => /approv/i.test(String(item.result ?? item.title ?? "")));
  if (approved) {
    return deepFreeze({
      title: String(approved.title),
      when: approved.occurredAt ?? null,
    });
  }
  const installed = improvements[0];
  if (installed) {
    return deepFreeze({
      title: String(installed.label ?? "Approved change installed"),
      when: installed.at ?? null,
    });
  }
  return null;
}

function humanizeStatus(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "In progress";
  if (/^[A-Z0-9_]+$/.test(raw)) {
    return raw
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return raw;
}

function humanizeOutcomeResult(result) {
  if (result === "sent") return "Sent";
  if (result === "completed") return "Completed";
  if (result === "approved") return "Approved";
  if (result === "handled") return "Handled";
  return humanizeStatus(result);
}

function humanizeEvidence(text) {
  return text.replace(/canonical evidence/gi, "supporting records").replace(/vibetech_app/gi, "VIBETech");
}

function formatRelated(relatedContext) {
  const refs = asArray(relatedContext);
  if (!refs.length) return null;
  return refs
    .slice(0, 2)
    .map((ref) => String(ref.label ?? ref.type ?? ref.id))
    .join(" · ");
}

function dedupeByTitle(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(row.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function timestampMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
