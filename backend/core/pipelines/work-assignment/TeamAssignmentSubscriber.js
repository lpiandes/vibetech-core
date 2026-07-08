import { AssignmentService } from "./AssignmentService.js";
import { validateWorkCreatedEvent } from "./AssignmentValidator.js";

import { createPlatformEventSubscriberFromHandler } from "../../events/subscribers/PlatformEventSubscriberFactory.js";

import { WORK_OS_PUBLISHER_ID } from "../../work/events/WorkPlatformEventDefaults.js";
import { ASSIGNMENT_STATUSES } from "./AssignmentDefaults.js";

const DEFAULT_SUBSCRIBER_ID = "sub_team_assignment";
const DEFAULT_SUBSCRIBER_NAME = "TeamAssignmentSubscriber";
const DEFAULT_PIPELINE_OS = "team_assignment_pipeline";

function fail(message) {
  throw new Error(`TeamAssignmentSubscriber: ${message}`);
}

export function teamAssignmentHandle(event, context = {}) {
  // Bus-compatible handler. Never mutate runtimes directly here; delegate to AssignmentService.
  if (String(event?.eventType) !== "WORK_CREATED") {
    return { status: "SKIPPED", message: "", actions: [], errors: [], metadata: {} };
  }

  try {
    validateWorkCreatedEvent(event);
    const { workRuntime, teamRuntime, capabilityRuntime, workAssignmentPlatformPublisher } = context;

    if (!workRuntime) return { status: "FAILED", message: "Missing workRuntime.", actions: [], errors: ["workRuntime required"], metadata: {} };
    if (!teamRuntime) return { status: "FAILED", message: "Missing teamRuntime.", actions: [], errors: ["teamRuntime required"], metadata: {} };

    const service = new AssignmentService();
    const assignmentResult = service.assignOwnership({ workRuntime, teamRuntime, capabilityRuntime, workCreatedEvent: event });

    // Publish canonical WORK_ASSIGNED fact for projections + analytics.
    if (
      workAssignmentPlatformPublisher &&
      assignmentResult?.status === ASSIGNMENT_STATUSES?.ASSIGNED
    ) {
      const assignment = (workRuntime.getAssignments?.() ?? []).find(
        (a) => String(a.id) === String(assignmentResult.assignmentId),
      );

      if (assignment) {
        workAssignmentPlatformPublisher.publishWorkAssigned({
          assignment,
          workRuntime,
          workItemId: assignmentResult.workItemId,
          assignedAtISO: String(assignment.assignedAt),
          nowISO: String(workRuntime.nowISO ?? "2026-07-01T00:00:00.000Z"),
          metadata: {},
        });
      }
    }

    // Map assignment status -> bus status.
    const busStatus = String(assignmentResult?.status) === "FAILED" ? "FAILED" : "SUCCESS";
    const busErrors = Array.isArray(assignmentResult?.errors) ? assignmentResult.errors : [];

    return {
      status: busStatus,
      message: assignmentResult?.status === "FAILED" ? "Assignment failed." : "Assignment computed.",
      actions: [],
      errors: busErrors,
      metadata: { assignmentResult },
    };
  } catch (err) {
    return {
      status: "FAILED",
      message: "Invalid WORK_CREATED payload.",
      actions: [],
      errors: [String(err?.message ?? err)],
      metadata: {},
    };
  }
}

export function createTeamAssignmentSubscriber({
  workRuntime,
  teamRuntime,
  capabilityRuntime,
  workAssignmentPlatformPublisher,
  id = DEFAULT_SUBSCRIBER_ID,
  name = DEFAULT_SUBSCRIBER_NAME,
  priority = 0,
  enabled = true,
} = {}) {
  if (!workRuntime) fail("createTeamAssignmentSubscriber requires workRuntime.");
  if (!teamRuntime) fail("createTeamAssignmentSubscriber requires teamRuntime.");

  const boundHandler = (event) =>
    teamAssignmentHandle(event, {
      workRuntime,
      teamRuntime,
      capabilityRuntime,
      workAssignmentPlatformPublisher,
    });

  return createPlatformEventSubscriberFromHandler({
    id,
    name,
    operatingSystem: DEFAULT_PIPELINE_OS,
    supportedEvents: ["WORK_CREATED"],
    priority,
    enabled,
    handler: boundHandler,
    handlerMetadata: { derivedFromPublisher: WORK_OS_PUBLISHER_ID },
  });
}

