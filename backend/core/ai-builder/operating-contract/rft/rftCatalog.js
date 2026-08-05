import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";

/**
 * Canonical Revenue Follow-Through catalogs (Plan 2).
 * States, events, outcomes, and proof requirements for the managed service.
 */

export const RFT_CONTRACT_KIND = "revenue_follow_through";
export const RFT_SCHEMA_ID = "revenue_follow_through";
export const RFT_CONTRACT_VERSION = "1.0.0";
export const RFT_PIPELINE_ID = "pipe_revenue_follow_through";

/** Opportunity lifecycle states (ordered happy path where applicable). */
export const RFT_STATES = Object.freeze([
  "Detected",
  "ContextReady",
  "ActionProposed",
  "ApprovalRequired",
  "AutoEligible",
  "Executing",
  "WaitingExternally",
  "Verified",
  "Exception",
  "OutcomeRecorded",
  "Closed",
]);

export const RFT_STATE_SET = Object.freeze(new Set(RFT_STATES));

/** First event types for Revenue Follow-Through. */
export const RFT_EVENT_TYPES = Object.freeze([
  "WEBSITE_INQUIRY",
  "META_LEAD",
  "INBOUND_SALES_EMAIL",
  "MISSED_SALES_CALL",
  "MEETING_BOOKED",
  "MEETING_COMPLETED",
  "PROPOSAL_SENT",
  "PROPOSAL_INACTIVE",
  "PROSPECT_REPLIED",
  "OPPORTUNITY_WON",
  "OPPORTUNITY_LOST",
  "CONTEXT_ENRICHED",
  "ACTION_PROPOSED",
  "APPROVAL_GRANTED",
  "APPROVAL_REJECTED",
  "EXTERNAL_ACTION_STARTED",
  "EXTERNAL_WAIT",
  "PROOF_ATTACHED",
  "EXCEPTION_RAISED",
  "EXCEPTION_RESOLVED",
  "OUTCOME_RECORDED",
  "CLOSED",
]);

/** Specialty / platform event aliases that map into RFT. */
export const RFT_SPECIALTY_EVENT_ALIASES = Object.freeze({
  NEW_INQUIRY: "WEBSITE_INQUIRY",
  FORM_SUBMIT: "WEBSITE_INQUIRY",
  META_LEAD: "META_LEAD",
  INBOUND_VOICE_CALL: "MISSED_SALES_CALL",
  CONTACT_CREATED: "WEBSITE_INQUIRY",
});

/** Outcome types for the proof ledger. */
export const RFT_OUTCOME_TYPES = Object.freeze([
  "Acknowledged",
  "Qualified",
  "Disqualified",
  "MeetingBooked",
  "FollowUpCompleted",
  "ProposalAdvanced",
  "ProposalStalled",
  "WonHandoffCompleted",
  "LostReasonRecorded",
  "HumanInterventionRequired",
]);

/**
 * Evidence kinds accepted as proof for Verified / OutcomeRecorded.
 * At least one provider-backed id is required before Verified.
 */
export const RFT_EVIDENCE_KINDS = Object.freeze([
  "gmail_message_id",
  "outlook_message_id",
  "calendar_event_id",
  "crm_record_id",
  "hubspot_record_id",
  "highlevel_record_id",
  "twilio_message_sid",
  "twilio_call_sid",
  "form_submission_id",
  "work_item_id",
  "approval_id",
  "specialty_fire_id",
  "webhook_delivery_id",
]);

/** Provider-backed evidence kinds required to enter Verified. */
export const RFT_PROVIDER_PROOF_KINDS = Object.freeze([
  "gmail_message_id",
  "outlook_message_id",
  "calendar_event_id",
  "crm_record_id",
  "hubspot_record_id",
  "highlevel_record_id",
  "twilio_message_sid",
  "twilio_call_sid",
  "form_submission_id",
  "webhook_delivery_id",
]);

export const RFT_PROVIDER_PROOF_SET = Object.freeze(new Set(RFT_PROVIDER_PROOF_KINDS));

/**
 * Default service-standard fields for RFT v1 (Northline-shaped B2B services).
 */
export function defaultRftServiceStandard() {
  return deepFreeze({
    kind: RFT_CONTRACT_KIND,
    contractVersion: RFT_CONTRACT_VERSION,
    name: "Revenue Follow-Through",
    sla: {
      acknowledgeWithinMinutes: 5,
      operatingHoursOnly: true,
      proposalReviewCadenceDays: 3,
      assignmentRequired: true,
      meetingNextStepRequired: true,
      wonHandoffRequired: true,
    },
    permittedActions: [
      "detect_opportunity",
      "capture_in_crm",
      "classify",
      "draft_acknowledgement",
      "send_acknowledgement_after_approval",
      "assign_owner",
      "propose_schedule",
      "draft_follow_up",
      "monitor_proposal",
      "escalate_stalled",
      "update_crm",
      "prepare_handoff",
    ],
    approvalRules: {
      customerFacingRequiresApproval: true,
      pricingOutsidePolicyRequiresApproval: true,
      newProspectOutboundRequiresApproval: true,
      existingCustomerSchedulingMayAuto: false,
    },
    successProof: {
      requireProviderIdsBeforeVerified: true,
      acceptedEvidenceKinds: [...RFT_EVIDENCE_KINDS],
      providerProofKinds: [...RFT_PROVIDER_PROOF_KINDS],
    },
    failureConditions: [
      "missing_required_evidence",
      "integration_delivery_failed",
      "ambiguous_classification",
      "pricing_outside_policy",
      "no_assignment_owner",
      "sla_breach",
    ],
    exceptionOwner: "customer_owner",
    retry: {
      safeTechnicalRetries: 2,
      backoffSeconds: 60,
    },
    costBoundary: {
      maxAutoOutboundPerOpportunity: 3,
      maxShadowDaysBeforeProve: 14,
    },
    metrics: [
      "first_response_minutes",
      "follow_ups_on_time_rate",
      "meetings_booked",
      "proposals_requiring_action",
      "auto_completed_share",
      "exception_rate",
    ],
    eventTypes: [...RFT_EVENT_TYPES],
    outcomeTypes: [...RFT_OUTCOME_TYPES],
    states: [...RFT_STATES],
  });
}

/** Pipeline stages aligned to RFT states (CRM presentation; card.rft.state is authoritative). */
export function defaultRftPipelineStages() {
  return deepFreeze([
    { id: "rft_detected", label: "Detected", order: 0, rftState: "Detected" },
    { id: "rft_context_ready", label: "Context ready", order: 1, rftState: "ContextReady" },
    { id: "rft_action_proposed", label: "Action proposed", order: 2, rftState: "ActionProposed" },
    { id: "rft_approval", label: "Needs approval", order: 3, rftState: "ApprovalRequired" },
    { id: "rft_auto", label: "Auto eligible", order: 4, rftState: "AutoEligible" },
    { id: "rft_executing", label: "Executing", order: 5, rftState: "Executing" },
    { id: "rft_waiting", label: "Waiting externally", order: 6, rftState: "WaitingExternally" },
    { id: "rft_verified", label: "Verified", order: 7, rftState: "Verified" },
    { id: "rft_exception", label: "Exception", order: 8, rftState: "Exception" },
    { id: "rft_outcome", label: "Outcome recorded", order: 9, rftState: "OutcomeRecorded" },
    { id: "rft_closed", label: "Closed", order: 10, rftState: "Closed" },
  ]);
}

export function stageIdForRftState(state) {
  const hit = defaultRftPipelineStages().find((s) => s.rftState === state);
  return hit?.id ?? "rft_detected";
}

export function rftStateForStageId(stageId) {
  const hit = defaultRftPipelineStages().find((s) => s.id === String(stageId));
  return hit?.rftState ?? null;
}

export function normalizeRftEvidence(entry = {}) {
  const kind = String(entry.kind ?? "").trim();
  const providerId = String(entry.providerId ?? entry.id ?? "").trim();
  if (!kind || !providerId) return null;
  if (!RFT_EVIDENCE_KINDS.includes(kind)) return null;
  return deepFreeze({
    kind,
    providerId,
    source: String(entry.source ?? "").trim() || null,
    at: entry.at ?? new Date().toISOString(),
    note: String(entry.note ?? "").trim() || null,
  });
}

export function hasProviderProof(evidenceList = []) {
  return (Array.isArray(evidenceList) ? evidenceList : []).some(
    (e) => e && RFT_PROVIDER_PROOF_SET.has(String(e.kind)) && String(e.providerId ?? "").trim(),
  );
}
