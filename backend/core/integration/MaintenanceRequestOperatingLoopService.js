import crypto from "node:crypto";

import { InboundAcknowledgmentService } from "../integrations/inbound/InboundAcknowledgmentService.js";
import { RecordInteractionService } from "../interactions/RecordInteractionService.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import {
  recordPartyEmailPreference,
  stablePartyIdFromEmail,
} from "./prospectPartySetup.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";

export const PM_MAINTENANCE_COORDINATOR_ID = "pm_maintenance_coordinator";

const VALID_URGENCIES = ["low", "medium", "high", "critical"];

function businessDisplayName(stack) {
  const companyProfile = stack.companyRuntime?.getCompanyProfile?.() ?? {};
  return (
    companyProfile?.general?.companyName ??
    companyProfile?.companyName ??
    stack.companyRuntime?.getBusinessProfile?.()?.businessName ??
    "our team"
  );
}

function deriveRequestTitle(description) {
  const text = String(description ?? "").trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}

function buildMaintenanceAcknowledgmentBody({ businessName, residentName, propertyName }) {
  const greeting = residentName ? `Hi ${residentName},` : "Hello,";
  const propertyLine = propertyName ? ` for ${propertyName}` : "";
  return `${greeting}

We received your maintenance request${propertyLine}. Our team is coordinating the next steps.

— Maintenance Coordinator, ${businessName}`;
}

function normalizeUrgency(urgency) {
  const value = String(urgency ?? "high").trim().toLowerCase();
  if (!value) return "high";
  if (!VALID_URGENCIES.includes(value)) return null;
  return value;
}

/**
 * Production-shaped maintenance request loop for property-management businesses.
 */
export async function runMaintenanceRequestOperatingLoop({
  stack,
  integrationPlatform,
  workspaceId,
  nowISO,
  request: maintenanceRequest,
} = {}) {
  if (!stack || !integrationPlatform) {
    throw new Error("runMaintenanceRequestOperatingLoop: stack and integrationPlatform required.");
  }

  const name = String(maintenanceRequest?.name ?? "").trim();
  const email = String(maintenanceRequest?.email ?? "").trim().toLowerCase();
  const description = String(maintenanceRequest?.description ?? "").trim();
  const phone = String(maintenanceRequest?.phone ?? "").trim();
  const subjectId = String(maintenanceRequest?.subjectId ?? "").trim();
  const permissionToContact = Boolean(maintenanceRequest?.permissionToContact);
  const urgency = normalizeUrgency(maintenanceRequest?.urgency);

  if (!name || !email || !description) {
    return { ok: false, reason: "validation_error", message: "Name, email, and issue description are required." };
  }
  if (!subjectId) {
    return { ok: false, reason: "validation_error", message: "Property is required." };
  }
  if (maintenanceRequest?.permissionToContact === undefined || maintenanceRequest?.permissionToContact === null) {
    return {
      ok: false,
      reason: "validation_error",
      message: "Permission to contact must be explicitly provided.",
    };
  }
  if (urgency === null) {
    return {
      ok: false,
      reason: "validation_error",
      message: "Urgency must be one of: low, medium, high, critical.",
    };
  }

  const subject = stack.businessSubjectRuntime?.getSubject?.(subjectId) ?? null;
  if (!subject) {
    return { ok: false, reason: "subject_not_found", message: "Selected property was not found." };
  }
  if (String(subject.status) !== "active") {
    return { ok: false, reason: "property_inactive", message: "Maintenance requests can only be submitted for active properties." };
  }

  const submissionId = String(maintenanceRequest?.submissionId ?? crypto.randomUUID());
  const externalEventId = submissionId;
  const requestTitle = deriveRequestTitle(description);
  const subjectType = String(subject.subjectType);
  const subjectDisplayName = String(subject.displayName);

  const ingest = integrationPlatform.webhookIngressService.ingest({
    providerId: "provider_mock_form",
    payload: {
      formId: "vibetech_maintenance_request",
      submissionId: externalEventId,
      name,
      email,
      phone,
      source: "vibetech_app",
      subject: requestTitle,
      message: description,
      priority: urgency,
      submittedAt: nowISO,
      objectId: subjectId,
      subjectType,
      subjectDisplayName,
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

  const party = stack.businessGraphRuntime?.getParty?.(partyId) ?? null;
  if (party && party.displayName !== name) {
    stack.businessGraphRuntime.applyEvent({
      id: `evt_party_maint_name_${submissionId}`,
      timestampISO: nowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_UPDATED,
      source: "maintenance_request_loop",
      payload: {
        partyId,
        patch: { displayName: name },
      },
    });
  }

  recordPartyEmailPreference({
    stack,
    partyId,
    workspaceId,
    nowISO,
    status: permissionToContact ? "opt_in" : "opt_out",
    source: "maintenance_request",
  });

  const routing = stack.installationResult?.inboundRouting?.find(
    (r) => r.eventKind === "maintenance_form_submission",
  );
  const businessName = businessDisplayName(stack);

  let emailResult = { status: "skipped", reason: "permission_not_granted" };
  if (permissionToContact) {
    const acknowledgmentService = new InboundAcknowledgmentService({
      installationResult: stack.installationResult,
      communicationRuntime: stack.communicationRuntime,
      communicationActionService: integrationPlatform.communicationActionService,
      connectionRuntime: integrationPlatform.connectionRuntime,
      preferenceRuntime: stack.communicationPreferenceRuntime,
      nowISO,
    });

    emailResult = await acknowledgmentService.execute({
      acknowledgmentIntentId: routing?.acknowledgmentIntentId ?? "maintenance_acknowledgment",
      partyId,
      requestId,
      workspaceId,
      assigneeId: PM_MAINTENANCE_COORDINATOR_ID,
      subjectLine: `Maintenance request received — ${subjectDisplayName}`,
      body: buildMaintenanceAcknowledgmentBody({
        businessName,
        residentName: name.split(" ")[0],
        propertyName: subjectDisplayName,
      }),
    });
  }

  const interactionId = `int_maintenance_${externalEventId}`;
  let maintenanceCoordinationWork = null;

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
          createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId }),
        ],
        ownerId: PM_MAINTENANCE_COORDINATOR_ID,
        status: "active",
        summary: "Maintenance request",
        metadata: { source: "vibetech_app", urgency },
      },
      noteText: description,
      noteAuthorId: PM_MAINTENANCE_COORDINATOR_ID,
      noteTimestampISO: nowISO,
      outcome: "maintenance_coordination_required",
      nextStep: "maintenance_coordination_required",
      followUpAt: null,
      nowISO,
      metadata: {},
    });

    const maintenanceWorkId = `work_pm_maintenance_${interactionId}`;
    maintenanceCoordinationWork = stack.workRuntime.getWorkItem(maintenanceWorkId) ?? null;
  }

  const canonicalRequest = stack.requestRuntime.getRequest(requestId) ?? null;

  return {
    ok: true,
    duplicate: Boolean(ingest.duplicate),
    ingest,
    partyId,
    requestId,
    interactionId,
    emailResult,
    maintenanceCoordinationWork,
    request: canonicalRequest,
  };
}
