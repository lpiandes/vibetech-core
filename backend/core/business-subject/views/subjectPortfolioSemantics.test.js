import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessSubjectRuntime } from "../BusinessSubjectRuntime.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../BusinessSubjectEventTypes.js";
import { createBusinessSubject } from "../BusinessSubject.js";
import { createRequest } from "../../request/Request.js";
import { createWorkItem } from "../../work/WorkItem.js";
import {
  collectSubjectIdentityIds,
  isPortfolioFollowUpWork,
  isPortfolioInquiryRequest,
  requestReferencesSubject,
  resolveRequestSubjectIds,
} from "./subjectPortfolioSemantics.js";
import { ENTITY_TYPES, createEntityRef } from "../../references/EntityRef.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";

const NOW = "2026-07-07T18:00:00.000Z";
const PM_PRESENTATION = PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION;

function seedSubject(subjects, { id, displayName, externalReferences = [] }) {
  subjects.applyEvent({
    id: `evt_${id}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "test",
    payload: {
      subject: createBusinessSubject({
        id,
        workspaceId: "ws_test",
        subjectType: "listing",
        displayName,
        externalReferences,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });
}

test("isPortfolioInquiryRequest: only configured request types count as inquiries", () => {
  assert.equal(isPortfolioInquiryRequest(null, PM_PRESENTATION), false);
  assert.equal(
    isPortfolioInquiryRequest(
      createRequest({
        id: "req_prospect",
        title: "Inquiry",
        description: "Hi",
        requestType: "PROSPECT_INQUIRY",
        status: "received",
        priority: "medium",
        channel: "website",
        source: "app",
        requester: "party_1",
        receivedAt: "2026-07-01T00:00:00.000Z",
      }),
      PM_PRESENTATION,
    ),
    true,
  );
  assert.equal(
    isPortfolioInquiryRequest(
      createRequest({
        id: "req_maint",
        title: "Leak",
        description: "Sink leak",
        requestType: "MAINTENANCE_REQUEST",
        status: "received",
        priority: "high",
        channel: "website",
        source: "app",
        requester: "party_1",
        receivedAt: "2026-07-01T00:00:00.000Z",
        inboundAttribution: {
          inboundEventId: "sub_1",
          providerId: "provider_mock_form",
          channel: "website",
          sourceLabel: "vibetech_app",
        },
        subjectRefs: [createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: "subj_1" })],
      }),
      PM_PRESENTATION,
    ),
    false,
  );
});

test("isPortfolioInquiryRequest: without package semantics no request counts as inquiry", () => {
  assert.equal(
    isPortfolioInquiryRequest(
      createRequest({
        id: "req_prospect",
        title: "Inquiry",
        description: "Hi",
        requestType: "PROSPECT_INQUIRY",
        status: "received",
        priority: "medium",
        channel: "website",
        source: "app",
        requester: "party_1",
        receivedAt: "2026-07-01T00:00:00.000Z",
      }),
      {},
    ),
    false,
  );
});

test("isPortfolioFollowUpWork: only configured work types count as follow-ups", () => {
  const openFollowUp = createWorkItem({
    id: "work_follow",
    title: "Follow up",
    description: "Follow up with prospect",
    workType: "prospect_follow_up",
    status: "ready",
    priority: "medium",
    stageId: "stage_follow_up",
    queueId: "queue_follow_up",
    assignedTo: "tm_leasing",
    requestedBy: "party_1",
    requestId: "req_1",
    source: "test",
    createdAt: NOW,
    updatedAt: NOW,
  });
  const maintenanceWork = createWorkItem({
    id: "work_maint",
    title: "Maintenance",
    description: "Coordinate maintenance",
    workType: "maintenance_coordination",
    status: "ready",
    priority: "high",
    stageId: "stage_execution",
    queueId: "queue_in_progress",
    assignedTo: "pm_maintenance_coordinator",
    requestedBy: "party_1",
    requestId: "req_2",
    source: "test",
    createdAt: NOW,
    updatedAt: NOW,
  });

  assert.equal(isPortfolioFollowUpWork(openFollowUp, PM_PRESENTATION), true);
  assert.equal(isPortfolioFollowUpWork(maintenanceWork, PM_PRESENTATION), false);
});

test("collectSubjectIdentityIds resolves alias and external refs", () => {
  const subjects = new BusinessSubjectRuntime();
  seedSubject(subjects, {
    id: "subj_canonical",
    displayName: "Canonical",
    externalReferences: ["ext_123"],
  });

  const ids = collectSubjectIdentityIds("subj_ext_123", subjects);
  assert.ok(ids.includes("subj_canonical"));
  assert.ok(ids.includes("subj_ext_123"));
  assert.ok(ids.includes("ext_123"));
});

test("requestReferencesSubject matches alias-linked inbound attribution", () => {
  const subjects = new BusinessSubjectRuntime();
  seedSubject(subjects, { id: "subj_page", displayName: "Page subject" });

  const request = createRequest({
    id: "req_1",
    title: "Inquiry",
    description: "Hi",
    requestType: "PROSPECT_INQUIRY",
    status: "received",
    priority: "medium",
    channel: "website",
    source: "app",
    requester: "party_1",
    receivedAt: NOW,
    inboundAttribution: { externalObjectId: "subj_page" },
    subjectRefs: [],
  });

  assert.equal(requestReferencesSubject(request, "subj_page", subjects), true);
  assert.ok(resolveRequestSubjectIds(request, subjects).includes("subj_page"));
});
