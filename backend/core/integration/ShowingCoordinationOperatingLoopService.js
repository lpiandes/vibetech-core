import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { PM_RESIDENT_PROSPECT_COORDINATOR_ID } from "./ProspectInquiryOperatingLoopService.js";

export { PM_RESIDENT_PROSPECT_COORDINATOR_ID };

export function showingInteractionIdForRequest(requestId) {
  return `int_showing_${String(requestId ?? "")}`;
}

function buildQualificationNote({ note, preferredTiming, request }) {
  const parts = [];
  const trimmedNote = String(note ?? "").trim();
  const trimmedTiming = String(preferredTiming ?? "").trim();
  if (trimmedNote) parts.push(trimmedNote);
  if (trimmedTiming) parts.push(`Preferred timing: ${trimmedTiming}`);
  if (parts.length > 0) return parts.join("\n\n");
  const fallback = String(request?.description ?? "").trim();
  return fallback || "Showing requested for prospect inquiry.";
}

/**
 * Advance an existing prospect inquiry into showing coordination via qualification interaction.
 */
export async function runShowingCoordinationOperatingLoop({
  stack,
  workspaceId,
  nowISO,
  request: showingRequest,
} = {}) {
  if (!stack) {
    throw new Error("runShowingCoordinationOperatingLoop: stack required.");
  }

  const requestId = String(showingRequest?.requestId ?? "").trim();
  if (!requestId) {
    return { ok: false, reason: "validation_error", message: "Request is required." };
  }

  const request = stack.requestRuntime?.getRequest?.(requestId) ?? null;
  if (!request) {
    return { ok: false, reason: "request_not_found", message: "Prospect inquiry was not found." };
  }
  if (String(request.requestType) !== "PROSPECT_INQUIRY") {
    return {
      ok: false,
      reason: "invalid_request_type",
      message: "Showing coordination can only be requested for prospect inquiries.",
    };
  }

  const subjectId = String(request.subjectRefs?.[0]?.entityId ?? "").trim();
  if (!subjectId) {
    return {
      ok: false,
      reason: "subject_required",
      message: "A property must be linked to this inquiry before requesting a showing.",
    };
  }

  const subject = stack.businessSubjectRuntime?.getSubject?.(subjectId) ?? null;
  if (!subject) {
    return { ok: false, reason: "subject_not_found", message: "Linked property was not found." };
  }
  if (String(subject.status) !== "active") {
    return {
      ok: false,
      reason: "property_inactive",
      message: "Showings can only be requested for active properties.",
    };
  }

  const partyId = String(request.requester ?? "").trim();
  if (!partyId) {
    return { ok: false, reason: "party_not_found", message: "Prospect party could not be resolved." };
  }

  const interactionId = showingInteractionIdForRequest(requestId);
  const showingWorkId = `work_pm_showing_${interactionId}`;

  if (stack.interactionRuntime.getInteraction(interactionId)) {
    return {
      ok: true,
      duplicate: true,
      requestId,
      partyId,
      subjectId,
      interactionId,
      showingCoordinationWork: stack.workRuntime.getWorkItem(showingWorkId) ?? null,
    };
  }

  if (!stack.osInteractionPublisher) {
    return { ok: false, reason: "interaction_unavailable", message: "Interaction recording is not available." };
  }

  const noteText = buildQualificationNote({
    note: showingRequest?.note,
    preferredTiming: showingRequest?.preferredTiming,
    request,
  });

  new RecordInteractionService({ interactionPlatformEventPublisher: stack.osInteractionPublisher }).execute({
    interactionRuntime: stack.interactionRuntime,
    interactionInput: {
      id: interactionId,
      interactionType: "call",
      direction: "outbound",
      channel: "phone",
      occurredAt: nowISO,
      participants: [{ partyId, participantType: "primary" }],
      relatedObjects: [
        createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId }),
        createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
        createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId }),
      ],
      ownerId: PM_RESIDENT_PROSPECT_COORDINATOR_ID,
      status: "active",
      summary: "Showing qualification",
      metadata: { source: "vibetech_app", workspaceId: String(workspaceId ?? "") },
    },
    noteText,
    noteAuthorId: PM_RESIDENT_PROSPECT_COORDINATOR_ID,
    noteTimestampISO: nowISO,
    outcome: "showing_requested",
    nextStep: "showing_requested",
    followUpAt: null,
    nowISO,
    metadata: {},
  });

  const showingCoordinationWork = stack.workRuntime.getWorkItem(showingWorkId) ?? null;
  const interaction = stack.interactionRuntime.getInteraction(interactionId) ?? null;

  return {
    ok: true,
    duplicate: false,
    requestId,
    partyId,
    subjectId,
    interactionId,
    interaction,
    showingCoordinationWork,
  };
}
