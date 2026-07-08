import crypto from "node:crypto";

import { InboundAcknowledgmentService } from "../integrations/inbound/InboundAcknowledgmentService.js";
import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { resolveExactSubjectInterestFromText } from "../business-subject/SubjectInterestTextResolver.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import {
  ensureProspectRelationship,
  recordPartyEmailOptIn,
  stablePartyIdFromEmail,
} from "./prospectPartySetup.js";

export const PM_RESIDENT_PROSPECT_COORDINATOR_ID = "pm_resident_prospect_coordinator";

function businessDisplayName(stack) {
  const companyProfile = stack.companyRuntime?.getCompanyProfile?.() ?? {};
  return (
    companyProfile?.general?.companyName ??
    companyProfile?.companyName ??
    stack.companyRuntime?.getBusinessProfile?.()?.businessName ??
    "our team"
  );
}

function buildFollowUpEmailBody({ businessName, prospectName }) {
  const greeting = prospectName ? `Hi ${prospectName},` : "Hello,";
  return `${greeting}

Thank you for contacting ${businessName}. We received your inquiry and will follow up shortly.

— Resident & Prospect Coordinator`;
}

/**
 * Production-shaped prospect inquiry loop for normal businesses (no demo fixtures).
 */
export async function runProspectInquiryOperatingLoop({
  stack,
  integrationPlatform,
  workspaceId,
  nowISO,
  inquiry,
} = {}) {
  if (!stack || !integrationPlatform) {
    throw new Error("runProspectInquiryOperatingLoop: stack and integrationPlatform required.");
  }

  const name = String(inquiry?.name ?? "").trim();
  const email = String(inquiry?.email ?? "").trim().toLowerCase();
  const message = String(inquiry?.message ?? "").trim();
  const phone = String(inquiry?.phone ?? "").trim();

  if (!name || !email || !message) {
    return { ok: false, reason: "validation_error", message: "Name, email, and message are required." };
  }

  const submissionId = String(inquiry?.submissionId ?? crypto.randomUUID());
  const externalEventId = submissionId;
  const submittedSubjectId = String(inquiry?.subjectId ?? "").trim();
  const inferredSubject = submittedSubjectId
    ? null
    : resolveExactSubjectInterestFromText({
        text: message,
        businessSubjectRuntime: stack.businessSubjectRuntime,
      });
  const subjectId = submittedSubjectId || (inferredSubject?.matched ? inferredSubject.subjectId : "");

  let subjectType = "listing";
  let subjectDisplayName = null;
  if (subjectId) {
    const subject = stack.businessSubjectRuntime?.getSubject?.(subjectId) ?? null;
    if (!subject) {
      return { ok: false, reason: "subject_not_found", message: "Selected property was not found." };
    }
    subjectType = String(subject.subjectType);
    subjectDisplayName = String(subject.displayName);
  }

  const ingest = integrationPlatform.webhookIngressService.ingest({
    providerId: "provider_mock_form",
    payload: {
      formId: "vibetech_prospect_inquiry",
      submissionId: externalEventId,
      name,
      email,
      phone,
      source: "vibetech_app",
      message,
      submittedAt: nowISO,
      ...(subjectId
        ? {
            objectId: subjectId,
            subjectType,
            subjectDisplayName,
          }
        : {}),
    },
  });

  if (!ingest.accepted && !ingest.duplicate) {
    return { ok: false, reason: ingest.reason ?? "ingest_failed" };
  }

  const partyId = stablePartyIdFromEmail(email);
  const requestId = `req_inbound_${externalEventId}`;
  if (!partyId) {
    return { ok: false, reason: "party_resolution_failed" };
  }

  recordPartyEmailOptIn({ stack, partyId, workspaceId, nowISO });
  ensureProspectRelationship({ stack, partyId, nowISO });

  const routing = stack.installationResult?.inboundRouting?.find((r) => r.eventKind === "form_submission");
  const businessName = businessDisplayName(stack);

  const acknowledgmentService = new InboundAcknowledgmentService({
    installationResult: stack.installationResult,
    communicationRuntime: stack.communicationRuntime,
    communicationActionService: integrationPlatform.communicationActionService,
    connectionRuntime: integrationPlatform.connectionRuntime,
    preferenceRuntime: stack.communicationPreferenceRuntime,
    nowISO,
  });

  const emailResult = await acknowledgmentService.execute({
    acknowledgmentIntentId: routing?.acknowledgmentIntentId ?? "initial_prospect_response",
    partyId,
    requestId,
    workspaceId,
    assigneeId: PM_RESIDENT_PROSPECT_COORDINATOR_ID,
    subjectLine: `Re: Your inquiry to ${businessName}`,
    body: buildFollowUpEmailBody({ businessName, prospectName: name.split(" ")[0] }),
  });

  const interactionId = `int_prospect_${externalEventId}`;
  let prospectFollowUpWork = null;

  if (!stack.interactionRuntime.getInteraction(interactionId) && stack.osInteractionPublisher) {
    new RecordInteractionService({ interactionPlatformEventPublisher: stack.osInteractionPublisher }).execute({
      interactionRuntime: stack.interactionRuntime,
      interactionInput: {
        id: interactionId,
        interactionType: "message",
        direction: "inbound",
        channel: "website",
        occurredAt: nowISO,
        participants: [{ partyId, participantType: "primary" }],
        relatedObjects: [
          createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId }),
          createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: partyId }),
          ...(subjectId
            ? [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId })]
            : []),
        ],
        ownerId: PM_RESIDENT_PROSPECT_COORDINATOR_ID,
        status: "active",
        summary: "Prospect inquiry",
        metadata: { source: "vibetech_app" },
      },
      noteText: message,
      noteAuthorId: PM_RESIDENT_PROSPECT_COORDINATOR_ID,
      noteTimestampISO: nowISO,
      outcome: "follow_up_required",
      nextStep: "follow_up_required",
      followUpAt: null,
      nowISO,
      metadata: {},
    });

    const prospectWorkId = `work_pm_prospect_${interactionId}`;
    prospectFollowUpWork = stack.workRuntime.getWorkItem(prospectWorkId) ?? null;
  }

  return {
    ok: true,
    duplicate: Boolean(ingest.duplicate),
    ingest,
    partyId,
    requestId,
    interactionId,
    inferredSubjectInterest: inferredSubject?.matched
      ? {
          subjectId: inferredSubject.subjectId,
          reason: inferredSubject.reason,
        }
      : null,
    emailResult,
    prospectFollowUpWork,
  };
}
