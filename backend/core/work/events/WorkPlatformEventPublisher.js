import { WORK_OS_PUBLISHER_ID } from "./WorkPlatformEventDefaults.js";

import { mapWorkItemCreatedToPlatformEventInput } from "./WorkPlatformEventMapper.js";
import { mapWorkItemAssignedToPlatformEventInput } from "./WorkPlatformEventMapper.js";
import { validateWorkItemCreatedToPlatformEventInput } from "./WorkPlatformEventValidator.js";
import { validateWorkAssignedPlatformEventInput } from "./WorkPlatformEventValidator.js";

import { createPlatformEventPublicationResult } from "../../events/publishing/PlatformEventPublicationResult.js";
import { PUBLISHATION_STATUSES } from "../../events/publishing/PlatformEventPublisherDefaults.js";

function fail(message) {
  throw new Error(`WorkPlatformEventPublisher: ${message}`);
}

/**
 * Request OS equivalent wrapper for Work OS publishing.
 * It must be invoked explicitly after work creation; WorkRuntime remains pure ownership.
 */
export class WorkPlatformEventPublisher {
  constructor({ platformEventPublisher } = {}) {
    if (!platformEventPublisher) fail("platformEventPublisher required.");
    this.platformEventPublisher = platformEventPublisher;
  }

  publishWorkCreated({ workRuntime, workCreatedEvent, createdWorkItem, createdAtISO, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const publisherId = WORK_OS_PUBLISHER_ID;
    const workItemId = (createdWorkItem?.id ?? workCreatedEvent?.payload?.workItem?.id ?? "").toString();
    const eventId = `evt_work_created_${workItemId}_${String(createdAtISO ?? createdWorkItem?.createdAt ?? nowISO)}`;
    const eventType = "WORK_CREATED";
    const publicationId = `${publisherId}:${eventId}:${nowISO}`;

    try {
      validateWorkItemCreatedToPlatformEventInput({
        workRuntime,
        workCreatedEvent,
        createdWorkItem,
        createdAtISO,
      });

      const eventInput = mapWorkItemCreatedToPlatformEventInput({
        workRuntime,
        workCreatedEvent,
        createdWorkItem,
        createdAtISO,
      });

      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { workOS: true, publisherId: WORK_OS_PUBLISHER_ID } },
      });
    } catch (err) {
      return createPlatformEventPublicationResult({
        publicationId,
        eventId: String(workItemId),
        eventType,
        publisherId,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors: [String(err?.message ?? err)],
        metadata: metadata ?? {},
      });
    }
  }

  publishWorkAssigned({ assignment, workRuntime, workItemId, assignedAtISO, workAssignedEvent, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const publisherId = WORK_OS_PUBLISHER_ID;
    const wid = String(workItemId ?? assignment?.workItemId ?? workAssignedEvent?.payload?.workItemId ?? "");
    const eventId = `evt_work_assigned_${String(wid)}_${String(assignment?.assigneeId ?? "")}_${String(assignedAtISO ?? assignment?.assignedAt ?? nowISO)}`;
    const eventType = "WORK_ASSIGNED";
    const publicationId = `${publisherId}:${eventId}:${nowISO}`;

    try {
      const eventInput = mapWorkItemAssignedToPlatformEventInput({
        workItemId: wid,
        assignment,
        assignedAtISO,
      });

      // Optional validation (best-effort); PlatformEventPublisher also validates canonical constraints.
      validateWorkAssignedPlatformEventInput(eventInput);

      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { workOS: true, publisherId: WORK_OS_PUBLISHER_ID } },
      });
    } catch (err) {
      return createPlatformEventPublicationResult({
        publicationId,
        eventId: String(wid),
        eventType,
        publisherId,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors: [String(err?.message ?? err)],
        metadata: metadata ?? {},
      });
    }
  }
}

