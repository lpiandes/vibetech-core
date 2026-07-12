import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { projectOwnerAttention } from "./OwnerAttentionProjection.js";
import { projectHandledByVibeTech } from "./HandledByVibeTechProjection.js";
import { presentDigitalWorkforce } from "./DigitalWorkforcePresentation.js";
import { projectBusinessPulse } from "./BusinessPulseProjection.js";
import { projectBusinessEpisodes } from "../episodes/BusinessEpisodeProjection.js";
import { projectBusinessStateSummary } from "./BusinessStateSummaryProjection.js";
import { projectOperatingStates } from "./OperatingStateProjection.js";
import { projectAutonomousContinuation } from "./AutonomousContinuationProjection.js";
import { composeWorkspaceAttentionSignals } from "../workspace/views/WorkspaceMissionControlComposer.js";
import { formatBusinessDateWithOverdue } from "../presentation/formatBusinessDate.js";
import { resolveBusinessWorkLinks, resolveWorkPartyId } from "../work/views/resolveWorkRowLinks.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function partyName(ctx, partyId) {
  return ctx?.businessGraphRuntime?.getParty?.(String(partyId))?.displayName ?? null;
}

function subjectName(ctx, subjectId) {
  return ctx?.businessSubjectRuntime?.getSubject?.(String(subjectId))?.displayName ?? null;
}

function assigneeName(ctx, assigneeId) {
  if (!assigneeId || String(assigneeId) === "unassigned") return null;
  const m = safeArray(ctx?.teamRuntime?.getMembers?.()).find((x) => String(x.id) === String(assigneeId));
  if (!m) return null;
  if (m.metadata?.seeded) return null;
  return m.name ?? null;
}

function workTypeLabel(presentation, workType) {
  const key = String(workType ?? "");
  return (
    presentation?.workTypeLabels?.[key] ??
    presentation?.requestTypeLabels?.[key] ??
    key.replace(/_/g, " ")
  );
}

function deriveOperationalStatus({ attentionItems, readinessReport, workRuntime } = {}) {
  if (safeArray(attentionItems).some((a) => a.priority === "critical")) return "needs_attention";
  const openWork = safeArray(workRuntime?.getWorkItems?.()).filter((w) => w.status !== "completed" && w.status !== "cancelled");
  if (openWork.length && readinessReport?.readinessStatus === "READY") return "operating";
  if (readinessReport?.readinessStatus !== "READY") return "setup_in_progress";
  return "operating";
}

function resolveDashboardPresentation({ installationResult, industryPackage }) {
  return (
    installationResult?.executiveExperience?.dashboardPresentation ??
    industryPackage?.executiveExperience?.dashboardPresentation ??
    {}
  );
}

function buildWorkMovingNow({
  workRuntime,
  teamRuntime,
  businessGraphRuntime,
  businessSubjectRuntime,
  requestRuntime,
  presentation,
  nowISO,
  businessId = null,
}) {
  const rows = [];
  for (const w of safeArray(workRuntime?.getWorkItems?.())) {
    if (w.status === "completed" || w.status === "cancelled") continue;

    const request = w.requestId ? requestRuntime?.getRequest?.(w.requestId) : null;
    const partyId = resolveWorkPartyId({ workItem: w, requestRuntime, businessGraphRuntime });
    const subjectId = request?.subjectRefs?.[0]?.entityId ?? null;

    let nextStep = "In progress";
    if (w.status === "blocked") nextStep = "Blocked — needs resolution";
    else if (w.status === "waiting" || w.status === "pending") nextStep = "Waiting for confirmation";
    else if (String(w.workType) === "showing_coordination") nextStep = "Confirm tour time";

    const dueAt = w.dueAt ?? null;
    const dueMeta = dueAt ? formatBusinessDateWithOverdue(dueAt, { nowISO }) : { label: null, overdue: false };
    const overdue = Boolean(dueMeta.overdue);
    const statusKey = String(w.status ?? "open");
    const statusLabel =
      presentation?.workStatusLabels?.[statusKey] ?? statusKey.replace(/_/g, " ");

    const links = resolveBusinessWorkLinks({
      partyId,
      subjectId,
      businessId,
      businessGraphRuntime,
      workItem: w,
      requestRuntime,
    });

    rows.push(
      deepFreeze({
        id: w.id,
        title: w.title ?? w.id,
        workType: w.workType,
        workTypeLabel: workTypeLabel(presentation, w.workType),
        partyId: links.partyId,
        partyName: partyName({ businessGraphRuntime }, links.partyId),
        subjectId,
        subjectName: subjectName({ businessSubjectRuntime }, subjectId),
        status: w.status,
        statusLabel,
        priority: w.priority ?? "normal",
        assignedTo: w.assignedTo ?? null,
        assigneeName: assigneeName({ teamRuntime }, w.assignedTo),
        dueAt,
        dueLabel: dueMeta.label,
        overdue,
        nextStep,
        href: links.rowHref ?? "/work",
        personHref: links.personHref,
        propertyHref: links.propertyHref,
        rowHref: links.rowHref,
        engagementHref: null,
      }),
    );
  }

  return deepFreeze(
    rows.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const pa = { urgent: 0, high: 1, medium: 2, normal: 3 };
      return (pa[a.priority] ?? 3) - (pa[b.priority] ?? 3);
    }),
  );
}

function buildHandledFromEpisodes(episodes, limit = 12) {
  const items = [];
  for (const ep of safeArray(episodes)) {
    for (const step of safeArray(ep.whatVibeTechHandled)) {
      items.push(
        deepFreeze({
          id: `handled_${step.id}`,
          title: step.label,
          summary: step.detail ?? ep.summary,
          actorType: "SYSTEM",
          actorName: "VIBETech",
          occurredAt: step.occurredAt ?? ep.occurredAt,
          result: "handled",
          episodeId: ep.episodeId,
          relatedContext: ep.relatedObjects,
        }),
      );
    }
  }
  return deepFreeze(
    items
      .sort((a, b) => new Date(b.occurredAt ?? 0) - new Date(a.occurredAt ?? 0))
      .slice(0, limit),
  );
}

function buildActivityFromEpisodes(episodes, limit = 8) {
  return deepFreeze(
    safeArray(episodes)
      .slice(0, limit)
      .map((ep) =>
        deepFreeze({
          id: `activity_${ep.episodeId}`,
          title: ep.title,
          summary: ep.summary,
          occurredAt: ep.updatedAt ?? ep.occurredAt,
          actorType: "SYSTEM",
          actorName: "VIBETech",
          episodeId: ep.episodeId,
          href: ep.primaryParty?.id ? `/engagement/${ep.primaryParty.id}` : null,
        }),
      ),
  );
}

function buildBusinessControlStatus({ businessStateSummary, operatingStates, presentation }) {
  const status = businessStateSummary?.status ?? "UNDER_CONTROL";
  const labels = presentation?.businessControlLabels ?? {};
  const labelMap = {
    UNDER_CONTROL: labels.underControl ?? "Under control",
    NEEDS_YOUR_ATTENTION: labels.needsAttention ?? "Needs your attention",
    AT_RISK: labels.atRisk ?? "At risk",
    SETUP_INCOMPLETE: labels.setupIncomplete ?? "Setup incomplete",
  };
  return deepFreeze({
    status,
    label: labelMap[status] ?? status,
    tone: status === "AT_RISK" ? "danger" : status === "NEEDS_YOUR_ATTENTION" ? "warning" : "success",
    reason: businessStateSummary?.reason ?? "",
    decisionCount: businessStateSummary?.decisionCount ?? 0,
    activeEpisodes: operatingStates?.states?.find((s) => s.id === "vibetech_handling")?.count ?? 0,
  });
}

function buildWhatHappensNext({ episodes, attentionItems, workMovingNow, autonomousContinuation }) {
  const next = [];
  for (const item of safeArray(attentionItems).filter((a) => a.sourceType === "approval").slice(0, 2)) {
    next.push({
      id: item.id,
      title: item.title,
      detail: item.summary,
      priority: "critical",
      href: item.availableActions?.[0]?.href ?? "/attention",
    });
  }
  for (const w of safeArray(workMovingNow).slice(0, 4)) {
    next.push({
      id: `next_${w.id}`,
      title: w.partyName ? `${w.workTypeLabel} — ${w.partyName}` : w.title,
      detail: w.nextStep + (w.dueLabel ? (w.overdue ? ` · Overdue since ${w.dueLabel}` : ` · Due ${w.dueLabel}`) : ""),
      priority: w.overdue ? "critical" : w.priority === "urgent" ? "high" : "medium",
      href: w.engagementHref ?? "/work",
    });
  }
  for (const ep of safeArray(episodes)) {
    for (const n of safeArray(ep.whatHappensNext)) {
      if (next.length >= 6) break;
      next.push({ ...n, href: ep.primaryParty?.id ? `/engagement/${ep.primaryParty.id}` : "/work" });
    }
  }
  for (const item of safeArray(autonomousContinuation).slice(0, 4)) {
    next.push({
      id: item.id,
      title: item.title,
      detail: item.blocker ? `${item.detail} · Blocked: ${item.blocker}` : item.detail,
      priority: item.canProceed ? "medium" : "low",
      href: item.episodeId ? `/engagement` : "/work",
      canProceedAutonomously: item.canProceed,
    });
  }
  return deepFreeze(next.slice(0, 6));
}

function buildEpisodeSummaryFeed(episodes, limit = 8) {
  return deepFreeze(
    safeArray(episodes).slice(0, limit).map((ep) =>
      deepFreeze({
        id: ep.episodeId,
        title: ep.primaryParty?.displayName
          ? `${ep.primaryParty.displayName}${ep.primarySubject ? ` · ${ep.primarySubject.displayName}` : ""}`
          : ep.title,
        summary: ep.journeyLine ?? ep.summary,
        journeyLine: ep.journeyLine,
        currentState: ep.currentState,
        nextStepLabel: ep.nextStepLabel,
        handledCount: ep.handledAutomaticallyCount ?? safeArray(ep.whatVibeTechHandled).length,
        operatingState: ep.operatingState,
        occurredAt: ep.updatedAt ?? ep.occurredAt,
        href: ep.primaryParty?.id ? `/engagement/${ep.primaryParty.id}` : null,
        whatVibeTechHandled: ep.whatVibeTechHandled,
        primaryParty: ep.primaryParty,
        primarySubject: ep.primarySubject,
      }),
    ),
  );
}

/**
 * Universal Business Command Center — read-only composition from canonical runtimes.
 */
export function composeBusinessCommandCenter(input = {}) {
  const {
    identityViewModel,
    readinessReport,
    connectedSystemsSnapshot,
    employeeReadinessReport,
    connectionDependencyProjection,
    integrationPlatform,
    terminology,
    installationResult,
    industryPackage,
    nowISO,
    ctx,
    missionControlSummary,
  } = input;

  const presentation = resolveDashboardPresentation({ installationResult, industryPackage });

  const attentionItems = projectOwnerAttention({
    approvalRuntime: ctx?.approvalRuntime,
    workRuntime: ctx?.workRuntime,
    requestRuntime: ctx?.requestRuntime,
    businessGraphRuntime: ctx?.businessGraphRuntime,
    businessSubjectRuntime: ctx?.businessSubjectRuntime,
    readinessReport,
    connectedSystemsSnapshot,
    employeeReadinessReport,
    automationRuntime: ctx?.automationRuntime,
    connectionDependencyProjection,
    integrationPlatform,
    presentation,
    nowISO,
    intelligenceCandidateRuntime: ctx?.intelligenceCandidateRuntime
      ?? input.operatingStack?.intelligenceCandidateRuntime
      ?? null,
  });

  const episodes = projectBusinessEpisodes({ ctx, presentation, nowISO });
  const workMovingNow = buildWorkMovingNow({
    workRuntime: ctx?.workRuntime,
    teamRuntime: ctx?.teamRuntime,
    businessGraphRuntime: ctx?.businessGraphRuntime,
    businessSubjectRuntime: ctx?.businessSubjectRuntime,
    requestRuntime: ctx?.requestRuntime,
    presentation,
    nowISO,
    businessId: input.businessId ?? null,
  });

  const pulse = projectBusinessPulse({
    pulseMetricDefs: presentation.pulseMetrics,
    ctx,
    attentionItems,
  });

  const operatingStates = projectOperatingStates({ ctx, episodes, attentionItems, presentation, nowISO });
  const businessStateSummary = projectBusinessStateSummary({
    pulse,
    attentionItems,
    episodes,
    workMovingNow,
    operatingStates,
    presentation,
    nowISO,
  });
  const businessControlStatus = buildBusinessControlStatus({ businessStateSummary, operatingStates, presentation });
  const autonomousContinuation = projectAutonomousContinuation({ episodes, ctx, presentation });

  const workspaceSignals = composeWorkspaceAttentionSignals({
    readinessReport,
    connectedSystemsSnapshot,
    employeeReadinessReport,
    automationRuntime: ctx?.automationRuntime,
    connectionDependencyProjection,
    integrationPlatform,
  });

  const operationalStatus = deriveOperationalStatus({ attentionItems, readinessReport, workRuntime: ctx?.workRuntime });

  const episodeFeed = buildEpisodeSummaryFeed(episodes);
  const fallbackHandled =
    episodeFeed.length === 0
      ? projectHandledByVibeTech({ platformEventStore: ctx?.platformEventStore, terminology })
      : [];

  return deepFreeze({
    hero: deepFreeze({
      businessName: identityViewModel?.businessName ?? "Your Business",
      operatingSystemTitle: identityViewModel?.industryDisplayName ?? "Business Operating System",
      operationalStatus,
      headline: businessStateSummary.headline,
      summary: missionControlSummary ?? businessStateSummary.summary,
      businessStateStatus: businessStateSummary.status,
      currentTimeContext: nowISO,
    }),
    businessStateSummary,
    businessControlStatus,
    operatingStates,
    pulse,
    needsYourAttention: attentionItems,
    handledByVibeTech: fallbackHandled,
    workInProgress: deepFreeze({
      in_progress: workMovingNow,
      waiting: [],
      blocked: workMovingNow.filter((w) => w.status === "blocked"),
    }),
    workMovingNow,
    businessEpisodes: episodes,
    businessEpisodeFeed: episodeFeed,
    digitalWorkforce: presentDigitalWorkforce({
      employeeReadinessReport,
      workRuntime: ctx?.workRuntime,
      automationRuntime: ctx?.automationRuntime,
      teamRuntime: ctx?.teamRuntime,
      communicationRuntime: ctx?.communicationRuntime,
      requestRuntime: ctx?.requestRuntime,
      platformEventStore: ctx?.platformEventStore,
      presentation,
      nowISO,
      attentionItems,
      approvalRuntime: ctx?.approvalRuntime,
    }),
    businessActivity: buildActivityFromEpisodes(episodes),
    businessHealth: deepFreeze([]),
    whatHappensNext: buildWhatHappensNext({ episodes, attentionItems, workMovingNow, autonomousContinuation }),
    autonomousContinuation,
    workspaceSignals,
  });
}
