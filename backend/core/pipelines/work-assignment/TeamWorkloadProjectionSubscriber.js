import { createPlatformEventSubscriberFromHandler } from "../../events/subscribers/PlatformEventSubscriberFactory.js";

import { TEAM_EVENT_TYPES } from "../../team/TeamEventTypes.js";

function fail(message) {
  throw new Error(`TeamWorkloadProjectionSubscriber: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function toStringOrNull(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

export function teamWorkloadProjectionHandle(event, context = {}) {
  if (String(event?.eventType) !== "WORK_ASSIGNED") {
    return { status: "SKIPPED", message: "", actions: [], errors: [], metadata: {} };
  }

  try {
    const { teamRuntime } = context;
    if (!teamRuntime || typeof teamRuntime.applyEvent !== "function") {
      return { status: "FAILED", message: "teamRuntime required.", actions: [], errors: ["teamRuntime required"], metadata: {} };
    }

    const payload = event?.payload ?? {};
    const assignment = payload?.assignment ?? payload?.workAssignment ?? payload?.assigned ?? null;
    const workId = payload?.workId ?? payload?.workItemId ?? null;

    const memberId = toStringOrNull(assignment?.assigneeId);
    const assignedAtISO = toStringOrNull(assignment?.assignedAt ?? event?.occurredAt ?? event?.timestampISO);

    if (!memberId) fail("assignment.assigneeId required.");

    // No-op projection for unassigned.
    if (memberId === "unassigned" || String(assignment?.assigneeType) === "unassigned") {
      return { status: "SKIPPED", message: "", actions: [], errors: [], metadata: { derivedFrom: { workId: String(workId ?? "") } } };
    }

    const eventId = `evt_team_work_assigned_proj_${String(workId ?? "")}_${String(memberId)}_${String(assignedAtISO ?? "na")}`;
    teamRuntime.applyEvent({
      id: eventId,
      timestampISO: String(event?.occurredAt ?? assignedAtISO ?? "2026-07-01T00:00:00.000Z"),
      type: TEAM_EVENT_TYPES.TEAM_WORK_ASSIGNED,
      source: "work_assigned_projection",
      payload: {
        memberId: String(memberId),
        // Team workload models this new work as pending review.
        assignedDelta: 0,
        pendingDelta: 1,
      },
    });

    return { status: "SUCCESS", message: "", actions: [], errors: [], metadata: { derivedFrom: { workId: String(workId ?? ""), memberId: String(memberId) } } };
  } catch (err) {
    return { status: "FAILED", message: "Projection failed.", actions: [], errors: [String(err?.message ?? err)], metadata: {} };
  }
}

export function createTeamWorkloadProjectionSubscriber({
  teamRuntime,
  id = "sub_team_workload_projection",
  name = "TeamWorkloadProjectionSubscriber",
  priority = 0,
  enabled = true,
} = {}) {
  if (!teamRuntime) fail("createTeamWorkloadProjectionSubscriber requires teamRuntime.");

  const boundHandler = (event) => teamWorkloadProjectionHandle(event, { teamRuntime });

  return createPlatformEventSubscriberFromHandler({
    id,
    name,
    operatingSystem: "team_workload_projection_pipeline",
    supportedEvents: ["WORK_ASSIGNED"],
    priority,
    enabled,
    handler: boundHandler,
    handlerMetadata: { derivedFromPublisher: "work_assignment_projection" },
  });
}
