import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { formatBusinessDate, formatBusinessDateWithOverdue } from "../presentation/formatBusinessDate.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function partyName(ctx, partyId) {
  if (!partyId) return null;
  return ctx?.businessGraphRuntime?.getParty?.(String(partyId))?.displayName ?? null;
}

function subjectName(ctx, subjectId) {
  if (!subjectId) return null;
  return ctx?.businessSubjectRuntime?.getSubject?.(String(subjectId))?.displayName ?? String(subjectId);
}

function assigneeName(ctx, assigneeId) {
  if (!assigneeId) return null;
  const m = safeArray(ctx?.teamRuntime?.getMembers?.()).find((x) => String(x.id) === String(assigneeId));
  return m?.name ?? String(assigneeId);
}

function workTypeLabel(presentation, workType) {
  return presentation?.workTypeLabels?.[workType] ?? String(workType ?? "work").replace(/_/g, " ");
}

function requestTypeLabel(presentation, requestType) {
  return presentation?.requestTypeLabels?.[requestType] ?? String(requestType ?? "request").replace(/_/g, " ");
}

function formatTemplate(template, vars) {
  let out = String(template ?? "");
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), v ?? "");
  }
  return out.replace(/\s+/g, " ").trim();
}

function isOpenWork(w) {
  return !["completed", "cancelled", "closed"].includes(String(w?.status ?? ""));
}

function isOpenRequest(r) {
  return !["closed", "cancelled", "rejected"].includes(String(r?.status ?? ""));
}

function findWorkForRequest(workRuntime, requestId) {
  return safeArray(workRuntime?.getWorkItems?.()).find(
    (w) =>
      String(w.requestId) === String(requestId) ||
      safeArray(w.relatedObjects).some((o) => String(o.requestId) === String(requestId) || String(o.id) === String(requestId)),
  );
}

function findInteractionsForRequest(interactionRuntime, requestId, partyId) {
  return safeArray(interactionRuntime?.getInteractions?.()).filter((i) => {
    const refs = safeArray(i.relatedObjects);
    return refs.some((r) => String(r.entityId) === String(requestId) || String(r.requestId) === String(requestId)) ||
      safeArray(i.participants).some((p) => String(p.partyId) === String(partyId));
  });
}

function findCommunicationsForRequest(communicationRuntime, requestId, partyId) {
  return safeArray(communicationRuntime?.getMessages?.()).filter(
    (m) => String(m.requestId) === String(requestId) || safeArray(m.recipients).some((r) => String(r.id) === String(partyId)),
  );
}

function buildHandledSteps({ request, party, subject, work, interactions, communications, presentation, ctx }) {
  const steps = [];
  const partyLabel = party?.displayName ?? "contact";
  const subjectLabel = subject?.displayName ?? null;

  if (request?.inboundAttribution || request?.requester) {
    steps.push({
      id: `handled_party_${request.id}`,
      stepKind: "party_identified",
      label: formatTemplate(presentation?.handledStepLabels?.party_identified ?? "Identified {party}", { party: partyLabel }),
      occurredAt: request.receivedAt ?? request.createdAt ?? null,
    });
  }

  if (subject) {
    steps.push({
      id: `handled_subject_${request.id}`,
      stepKind: "subject_matched",
      label: formatTemplate(presentation?.handledStepLabels?.subject_matched ?? "Matched to {subject}", { subject: subjectLabel }),
      occurredAt: request.receivedAt ?? null,
    });
  }

  const outbound = communications.filter((m) => String(m.direction) === "outbound");
  if (outbound.length) {
    steps.push({
      id: `handled_ack_${request.id}`,
      stepKind: "acknowledgment_sent",
      label: formatTemplate(presentation?.handledStepLabels?.acknowledgment_sent ?? "Sent acknowledgment to {party}", { party: partyLabel }),
      occurredAt: outbound[0]?.sentAt ?? outbound[0]?.createdAt ?? null,
    });
  }

  const qual = interactions.find((i) => safeArray(i.notes).length > 0 || i.outcome);
  if (qual) {
    steps.push({
      id: `handled_qual_${request.id}`,
      stepKind: "qualification_captured",
      label: formatTemplate(presentation?.handledStepLabels?.qualification_captured ?? "Captured qualification from {party}", { party: partyLabel }),
      detail: qual.notes?.[0]?.text ?? qual.summary ?? null,
      occurredAt: qual.occurredAt ?? null,
    });
  }

  if (work) {
    steps.push({
      id: `handled_work_${work.id}`,
      stepKind: "work_created",
      label: formatTemplate(presentation?.handledStepLabels?.work_created ?? "Created {workType} work", {
        workType: workTypeLabel(presentation, work.workType),
      }),
      occurredAt: work.createdAt ?? null,
    });
    if (work.assignedTo) {
      steps.push({
        id: `handled_assign_${work.id}`,
        stepKind: "work_assigned",
        label: formatTemplate(presentation?.handledStepLabels?.work_assigned ?? "Assigned to {assignee}", {
          assignee: assigneeName(ctx, work.assignedTo),
        }),
        occurredAt: work.updatedAt ?? work.createdAt ?? null,
      });
    }
  }

  return deepFreeze(steps);
}

function dedupeHandledSteps(steps) {
  const byKind = new Map();
  for (const step of safeArray(steps)) {
    const kind = step.stepKind ?? step.id;
    const existing = byKind.get(kind);
    if (!existing || new Date(step.occurredAt ?? 0) < new Date(existing.occurredAt ?? 0)) {
      byKind.set(kind, step);
    }
  }
  return deepFreeze(
    [...byKind.values()].sort((a, b) => new Date(a.occurredAt ?? 0) - new Date(b.occurredAt ?? 0)),
  );
}

function buildJourneyLine({ requests, interactions, work, presentation }) {
  const parts = [];
  const channels = [...new Set(safeArray(requests).map((r) => r.inboundAttribution?.sourceLabel ?? r.channel ?? r.source).filter(Boolean))];
  const requestType = requests[0]?.requestType;
  if (requestType) {
    parts.push(requestTypeLabel(presentation, requestType));
  }
  if (channels.length) {
    parts.push(`via ${channels.join(" + ")}`);
  }
  const qual = interactions.find((i) => i.outcome);
  if (qual?.outcome) parts.push("Qualified");
  if (work) parts.push(workTypeLabel(presentation, work.workType));
  return parts.join(" → ").replace(" → via", " via");
}

function resolveEpisodeOperatingState({ work, approvalRuntime, request }) {
  const pendingApproval = safeArray(approvalRuntime?.getRequests?.()).some((a) => a.status === "PENDING");
  if (pendingApproval && String(request?.requestType) === "OWNER_REQUEST") return "waiting_human";
  if (work?.status === "blocked") return "blocked";
  if (!work && isOpenRequest(request) && request?.inboundAttribution) return "new";
  if (work && isOpenWork(work)) return "handling";
  if (isOpenRequest(request)) return "handling";
  if (work?.status === "completed") return "completed";
  return "monitoring";
}

function operatingStateLabel(presentation, state) {
  const labels = presentation?.operatingStateLabels ?? {};
  switch (String(state ?? "")) {
    case "waiting_human":
      return labels.waitingHuman ?? "Waiting on you";
    case "blocked":
      return labels.blocked ?? "Blocked";
    case "new":
      return labels.new ?? "New";
    case "handling":
      return labels.vibetechHandling ?? "In progress";
    case "completed":
      return labels.completed ?? "Completed";
    case "monitoring":
      return labels.monitoring ?? "Monitoring";
    default:
      return String(state ?? "").replace(/_/g, " ");
  }
}

function buildNextStepLabel({ work, interactions, presentation }) {
  if (work && isOpenWork(work)) {
    if (String(work.workType) === "showing_coordination") return "Confirm showing time";
    if (work.status === "blocked") return "Resolve blocker";
    return work.title ?? workTypeLabel(presentation, work.workType);
  }
  const qual = interactions.find((i) => i.followUpAt);
  if (qual?.followUpAt) return "Scheduled follow-up";
  return null;
}

function inferSubjectIdForRequest(ctx, request, partyId) {
  const direct = request?.subjectRefs?.[0]?.entityId;
  if (direct) return String(direct);
  const work = findWorkForRequest(ctx?.workRuntime, request?.id);
  if (work?.relatedObjects) {
    const sub = safeArray(work.relatedObjects).find((o) => o.subjectId || o.entityType === "SUBJECT");
    if (sub?.entityId || sub?.subjectId) return String(sub.entityId ?? sub.subjectId);
  }
  for (const other of safeArray(ctx?.requestRuntime?.getRequests?.())) {
    if (String(other.requester) !== String(partyId)) continue;
    const sid = other.subjectRefs?.[0]?.entityId;
    if (!sid) continue;
    if (String(other.requestType) === String(request?.requestType)) return String(sid);
    const sharedWork = findWorkForRequest(ctx?.workRuntime, other.id);
    if (sharedWork && work && String(sharedWork.id) === String(work.id)) return String(sid);
  }
  return null;
}

function episodeGroupKey({ request, partyId, subjectId, work, ctx }) {
  const resolvedSubject = subjectId ?? inferSubjectIdForRequest(ctx, request, partyId);
  if (work?.id) return `work:${work.id}`;
  const rt = String(request?.requestType ?? "");
  if (partyId && resolvedSubject && rt) return `journey:${partyId}:${resolvedSubject}:${rt}`;
  if (partyId && resolvedSubject) return `journey:${partyId}:${resolvedSubject}`;
  return `request:${request?.id}`;
}

function collapseRelatedEpisodes(rawEpisodes, ctx, presentation) {
  const groups = new Map();
  for (const ep of safeArray(rawEpisodes)) {
    const key = episodeGroupKey({
      request: ctx?.requestRuntime?.getRequest?.(ep.requestId),
      partyId: ep.primaryParty?.id,
      subjectId: ep.primarySubject?.id,
      work: ep.workId ? ctx?.workRuntime?.getWorkItem?.(ep.workId) : null,
      ctx,
    });
    const list = groups.get(key) ?? [];
    list.push(ep);
    groups.set(key, list);
  }

  const merged = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    const sorted = group.slice().sort((a, b) => {
      if (a.workId && !b.workId) return -1;
      if (!a.workId && b.workId) return 1;
      return new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0);
    });
    const primary = sorted[0];
    const requestIds = [...new Set(group.map((e) => e.requestId).filter(Boolean))];
    const requests = requestIds.map((id) => ctx?.requestRuntime?.getRequest?.(id)).filter(Boolean);
    const interactions = requestIds.flatMap((id) =>
      findInteractionsForRequest(ctx?.interactionRuntime, id, primary.primaryParty?.id),
    );
    const work = primary.workId ? ctx?.workRuntime?.getWorkItem?.(primary.workId) : null;
    const allSteps = dedupeHandledSteps(group.flatMap((e) => safeArray(e.whatVibeTechHandled)));

    merged.push(
      deepFreeze({
        ...primary,
        episodeId: `episode_merged_${primary.requestId}`,
        mergedRequestIds: deepFreeze(requestIds),
        journeyLine: buildJourneyLine({ requests, interactions, work, presentation }),
        whatVibeTechHandled: allSteps,
        handledAutomaticallyCount: allSteps.length,
        operatingState: resolveEpisodeOperatingState({
          work,
          approvalRuntime: ctx?.approvalRuntime,
          request: requests[0],
        }),
        nextStepLabel: buildNextStepLabel({ work, interactions, presentation }),
      }),
    );
  }

  return deepFreeze(
    merged.sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0)),
  );
}

function buildEpisodeTitle({ request, party, subject, presentation }) {
  const rt = String(request?.requestType ?? "");
  const template =
    presentation?.episodeTitleTemplates?.[rt] ??
    presentation?.episodeTitleTemplates?.default ??
    "{requestType} — {party}";
  return formatTemplate(template, {
    subject: subject?.displayName ?? "property",
    party: party?.displayName ?? "contact",
    requestType: requestTypeLabel(presentation, rt),
  });
}

function buildEpisodeSummary({ request, party, subject, work, interactions, presentation }) {
  const parts = [];
  const source = request?.inboundAttribution?.sourceLabel ?? request?.inboundAttribution?.channel ?? request?.channel;
  if (source && party) parts.push(`${party.displayName} reached out via ${source}.`);
  else if (party) parts.push(`${party.displayName} submitted a ${requestTypeLabel(presentation, request?.requestType)}.`);

  if (subject) parts.push(`Linked to ${subject.displayName}.`);

  const qual = interactions.find((i) => i.outcome);
  if (qual?.outcome === "showing_requested") parts.push("Showing preferences were captured.");
  if (work) parts.push(`${workTypeLabel(presentation, work.workType)} is in progress.`);

  return parts.join(" ") || request?.description || "";
}

function buildCurrentState({ work, interactions, approvalRuntime, request }) {
  const pendingApproval = safeArray(approvalRuntime?.getRequests?.()).find((a) => a.status === "PENDING");
  if (pendingApproval) return "Waiting for owner approval";
  if (work && isOpenWork(work)) return `${work.status ?? "open"} — ${work.title ?? work.workType}`;
  const qual = interactions.find((i) => i.outcome);
  if (qual && isOpenRequest(request)) return `Qualification captured — ${String(qual.outcome).replace(/_/g, " ")}`;
  if (isOpenRequest(request)) return "Request received";
  return "Closed";
}

function buildWhatHappensNextEpisode({ work, interactions, nowISO, presentation }) {
  const next = [];
  if (work?.dueAt && isOpenWork(work)) {
    const dueMeta = formatBusinessDateWithOverdue(work.dueAt, { nowISO });
    if (dueMeta.label) {
      next.push({
        id: `next_${work.id}`,
        title: work.title ?? workTypeLabel(presentation, work.workType),
        detail: dueMeta.overdue
          ? `Overdue since ${dueMeta.label}`
          : `Due ${dueMeta.label}`,
        priority: work.priority === "urgent" ? "high" : "medium",
      });
    }
  }
  const followUp = interactions.find((i) => i.followUpAt);
  if (followUp?.followUpAt) {
    const followMeta = formatBusinessDateWithOverdue(followUp.followUpAt, { nowISO });
    if (followMeta.label) {
      next.push({
        id: `next_follow_${followUp.id}`,
        title: presentation?.autonomousContinuationTemplates?.scheduledFollowUp ?? "Scheduled follow-up",
        detail: followMeta.overdue
          ? `Overdue since ${followMeta.label}`
          : `Follow-up on ${followMeta.label}`,
        priority: "medium",
      });
    }
  }
  return deepFreeze(next);
}

/**
 * Universal read-only business episode projection.
 * Groups linked canonical facts into owner-meaningful stories. No runtime mutation.
 */
export function projectBusinessEpisodes({ ctx, presentation, nowISO, limit = 20 } = {}) {
  const requests = safeArray(ctx?.requestRuntime?.getRequests?.())
    .slice()
    .sort((a, b) => new Date(b.receivedAt ?? b.createdAt ?? 0) - new Date(a.receivedAt ?? a.createdAt ?? 0));

  const episodes = [];

  for (const request of requests.slice(0, limit)) {
    const partyId = String(request.requester ?? "");
    const party = partyId ? ctx?.businessGraphRuntime?.getParty?.(partyId) : null;
    const subjectId = request.subjectRefs?.[0]?.entityId ?? null;
    const subject = subjectId ? ctx?.businessSubjectRuntime?.getSubject?.(subjectId) : null;
    const work = findWorkForRequest(ctx?.workRuntime, request.id);
    const interactions = findInteractionsForRequest(ctx?.interactionRuntime, request.id, partyId);
    const communications = findCommunicationsForRequest(ctx?.communicationRuntime, request.id, partyId);

    const whatVibeTechHandled = buildHandledSteps({
      request,
      party,
      subject,
      work,
      interactions,
      communications,
      presentation,
      ctx,
    });

    const journeyLine = buildJourneyLine({ requests: [request], interactions, work, presentation });

    const operatingState = resolveEpisodeOperatingState({ work, approvalRuntime: ctx?.approvalRuntime, request });

    episodes.push(
      deepFreeze({
        episodeId: `episode_req_${request.id}`,
        title: buildEpisodeTitle({ request, party, subject, presentation }),
        summary: buildEpisodeSummary({ request, party, subject, work, interactions, presentation }),
        journeyLine,
        currentState: buildCurrentState({ work, interactions, approvalRuntime: ctx?.approvalRuntime, request }),
        operatingState,
        operatingStateLabel: operatingStateLabel(presentation, operatingState),
        nextStepLabel: buildNextStepLabel({ work, interactions, presentation }),
        businessContext: subject?.displayName ?? party?.displayName ?? null,
        primaryParty: party
          ? deepFreeze({ id: party.id, displayName: party.displayName })
          : partyId
            ? deepFreeze({ id: partyId, displayName: partyName(ctx, partyId) })
            : null,
        primarySubject: subject
          ? deepFreeze({ id: subject.id, displayName: subject.displayName, subjectType: subject.subjectType })
          : null,
        whatTriggeredIt: request.inboundAttribution
          ? deepFreeze({
              channel: request.inboundAttribution.channel ?? request.channel,
              sourceLabel: request.inboundAttribution.sourceLabel ?? request.inboundAttribution.landingPage ?? null,
            })
          : null,
        whatVibeTechHandled,
        handledAutomaticallyCount: whatVibeTechHandled.length,
        whatNeedsHumanAttention: null,
        whatHappensNext: buildWhatHappensNextEpisode({ work, interactions, nowISO, presentation }),
        occurredAt: request.receivedAt ?? request.createdAt ?? nowISO,
        updatedAt: work?.updatedAt ?? interactions[interactions.length - 1]?.occurredAt ?? request.receivedAt ?? nowISO,
        relatedObjects: deepFreeze([
          { entityType: ENTITY_TYPES.REQUEST, entityId: String(request.id) },
          partyId ? { entityType: ENTITY_TYPES.PARTY, entityId: partyId } : null,
          subjectId ? { entityType: ENTITY_TYPES.SUBJECT, entityId: String(subjectId) } : null,
          work ? { entityType: ENTITY_TYPES.WORK, entityId: String(work.id) } : null,
        ].filter(Boolean)),
        requestId: String(request.id),
        workId: work ? String(work.id) : null,
      }),
    );
  }

  const collapsed = collapseRelatedEpisodes(episodes, ctx, presentation);
  return deepFreeze(
    collapsed.map((ep) => {
      if (ep.journeyLine && !ep.journeyLine.includes("→")) return ep;
      const request = ctx?.requestRuntime?.getRequest?.(ep.requestId);
      const work = ep.workId ? ctx?.workRuntime?.getWorkItem?.(ep.workId) : null;
      const interactions = findInteractionsForRequest(ctx?.interactionRuntime, ep.requestId, ep.primaryParty?.id);
      return deepFreeze({
        ...ep,
        journeyLine: ep.journeyLine || buildJourneyLine({ requests: [request].filter(Boolean), interactions, work, presentation }),
        nextStepLabel: ep.nextStepLabel ?? buildNextStepLabel({ work, interactions, presentation }),
      });
    }),
  );
}
