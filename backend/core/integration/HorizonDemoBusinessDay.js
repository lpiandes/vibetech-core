import { buildWebsiteFormPayload } from "./FirstClientOperatingLoopRunner.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { PREFERENCE_EVENT_TYPES } from "../communications/preferences/CommunicationPreferenceEventTypes.js";
import { createCommunicationPreference } from "../communications/preferences/CommunicationPreference.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const HORIZON_DEMO_SECOND_SUBMISSION_ID = "form_sub_horizon_demo_2";
export const HORIZON_DEMO_SECOND_EMAIL = "maria.chen@example.com";

export function getHorizonMariaPartyId() {
  return `party_${HORIZON_DEMO_SECOND_EMAIL.toLowerCase().replace(/[@.]/g, "_")}`;
}

function buildMariaFormPayload({ nowISO }) {
  return {
    formId: "horizon_inquiry",
    submissionId: HORIZON_DEMO_SECOND_SUBMISSION_ID,
    name: "Maria Chen",
    email: HORIZON_DEMO_SECOND_EMAIL,
    phone: "8605550142",
    source: "website",
    pageUrl: "/units/4a",
    objectId: "horizon_unit_4a",
    subjectType: "unit",
    subjectDisplayName: "Unit 4A — Harbor View",
    message: "Interested in a 1-bedroom and availability this month.",
    qualification: { intent: "leasing", timeline: "this month" },
    submittedAt: nowISO,
  };
}

/**
 * Additional Horizon demo inputs through real inbound boundaries — not final-state seeding.
 */
export function runHorizonDemoBusinessDayInputs({ stack, integrationPlatform, workspaceId, nowISO }) {
  const effectiveNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const wid = String(workspaceId ?? stack.workspaceId);
  const results = [];

  const requestId2 = `req_inbound_${HORIZON_DEMO_SECOND_SUBMISSION_ID}`;
  if (!stack.requestRuntime.getRequest(requestId2)) {
    const ingest = integrationPlatform.webhookIngressService.ingest({
      providerId: "provider_mock_form",
      payload: buildMariaFormPayload({ nowISO: effectiveNowISO }),
    });
    results.push({ scenario: "second_prospect_inquiry", ingest });
  }

  const blockedPartyId = "party_blocked_sms_demo";
  if (!stack.businessGraphRuntime.getParty(blockedPartyId)) {
    stack.businessGraphRuntime.applyEvent({
      id: "evt_party_blocked_sms",
      timestampISO: effectiveNowISO,
      type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
      source: "horizon_demo_business_day",
      payload: {
        party: {
          id: blockedPartyId,
          partyType: "PERSON",
          displayName: "Alex Rivera",
          status: "active",
          contactMethods: [{ type: "phone", value: "8605550100" }],
          externalReferences: [],
          metadata: {},
          createdAt: effectiveNowISO,
          updatedAt: effectiveNowISO,
        },
      },
    });
    stack.communicationPreferenceRuntime.applyEvent({
      id: "evt_pref_sms_opt_out",
      timestampISO: effectiveNowISO,
      type: PREFERENCE_EVENT_TYPES.PREFERENCE_RECORDED,
      source: "horizon_demo_business_day",
      payload: {
        preference: createCommunicationPreference({
          id: "pref_blocked_sms",
          partyId: blockedPartyId,
          workspaceId: wid,
          channel: "sms",
          status: "opt_out",
          recordedAt: effectiveNowISO,
        }),
      },
    });
    results.push({ scenario: "blocked_sms_preference", partyId: blockedPartyId });
  }

  return deepFreeze({ results, partyIds: [getHorizonMariaPartyId(), blockedPartyId] });
}
