import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export class MockFormSubmissionProvider extends IntegrationProvider {
  constructor({ nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._nowISO = String(nowISO);
  }

  get id() {
    return "provider_mock_form";
  }

  get displayName() {
    return "Mock Form Submission Provider";
  }

  get supportedConnectionTypes() {
    return ["website_forms"];
  }

  get supportedCapabilities() {
    return [INTEGRATION_CAPABILITIES.INGEST_FORM_SUBMISSION, INTEGRATION_CAPABILITIES.RECEIVE_WEBHOOK];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Website Forms",
      summary: "Receive website form submissions via webhook.",
      estimatedTime: "10 minutes",
      prerequisites: ["Website form endpoint"],
      steps: ["Configure webhook URL", "Submit test form"],
      permissionsRequested: [],
      verificationMethod: "Submit a test form submission.",
      commonProblems: ["Invalid webhook signature."],
      reconnectInstructions: "Rotate webhook secret.",
    });
  }

  validateWebhook({ payload } = {}) {
    if (!payload?.formId) return { valid: false, reason: "missing_form_id" };
    return { valid: true };
  }

  normalizeInboundEvent({ payload } = {}) {
    const externalEventId = String(payload.submissionId ?? payload.id ?? "");
    if (!externalEventId) return null;
    const formId = String(payload.formId ?? "");
    const eventKind =
      String(payload.eventKind ?? "").trim() ||
      (formId === "vibetech_maintenance_request" ? "maintenance_form_submission" : "form_submission");
    return deepFreeze({
      externalEventId,
      eventType: eventKind,
      occurredAt: payload.submittedAt ?? this._nowISO,
      channel: "website",
      normalizedFacts: deepFreeze({
        eventKind,
        identityHints: {
          name: payload.name ?? "",
          email: payload.email ?? "",
          phone: payload.phone ?? "",
        },
        attribution: {
          sourceLabel: payload.source ?? "website",
          landingPage: payload.pageUrl ?? null,
          externalObjectId: payload.objectId ?? null,
          subjectType: payload.subjectType ?? "listing",
          subjectDisplayName: payload.subjectDisplayName ?? payload.objectDisplayName ?? null,
        },
        title: payload.subject ?? "Website inquiry",
        message: payload.message ?? "",
        priority: payload.priority ?? null,
        qualification: payload.qualification ?? {},
      }),
    });
  }
}
