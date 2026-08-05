import assert from "node:assert/strict";
import { test } from "node:test";

import { composePilotScorecard } from "./composePilotScorecard.js";
import { RFT_PIPELINE_ID } from "../ai-builder/operating-contract/rft/rftCatalog.js";

test("composePilotScorecard keeps automatic and operator-rescued outcomes separate", () => {
  const scorecard = composePilotScorecard({
    businessId: "biz_1",
    nowISO: "2026-08-05T16:00:00.000Z",
    windowDays: 7,
    installation: {
      businessId: "biz_1",
      configuration: {
        businessProfile: { businessName: "Pilot One" },
        rftObservation: {
          importedAt: "2026-08-03T12:00:00.000Z",
          events: [
            { id: "obs_1", kind: "rft_opportunity", evidence: [{ kind: "gmail_message_id", providerId: "g_1" }] },
          ],
          baseline: {
            metrics: {
              opportunitiesDetected: {
                status: "observable",
                count: 2,
                evidence: [{ kind: "gmail_message_id", providerId: "g_1" }],
              },
              firstResponse: {
                status: "observable",
                medianMinutes: 9,
                slaMinutes: 15,
                sampleSize: 2,
              },
            },
          },
        },
        crm: {
          version: 1,
          contacts: [],
          calendarEvents: [],
          pipelines: [
            {
              id: RFT_PIPELINE_ID,
              cards: [
                {
                  id: "card_auto",
                  title: "Auto path",
                  createdAt: "2026-08-04T12:00:00.000Z",
                  rft: {
                    state: "Verified",
                    createdAt: "2026-08-04T12:00:00.000Z",
                    lastTransitionAt: "2026-08-04T12:10:00.000Z",
                    evidence: [{ kind: "gmail_message_id", providerId: "msg_auto" }],
                    history: [
                      { from: null, to: "Detected", at: "2026-08-04T12:00:00.000Z", actorId: "system" },
                      { from: "Detected", to: "ActionProposed", at: "2026-08-04T12:05:00.000Z", actorId: "system" },
                      { from: "ActionProposed", to: "Verified", at: "2026-08-04T12:10:00.000Z", actorId: "system" },
                    ],
                  },
                },
                {
                  id: "card_rescue",
                  title: "Rescued path",
                  createdAt: "2026-08-04T13:00:00.000Z",
                  rft: {
                    state: "Verified",
                    createdAt: "2026-08-04T13:00:00.000Z",
                    lastTransitionAt: "2026-08-04T13:25:00.000Z",
                    evidence: [{ kind: "gmail_message_id", providerId: "msg_rescue" }],
                    history: [
                      { from: null, to: "Detected", at: "2026-08-04T13:00:00.000Z", actorId: "system" },
                      { from: "Detected", to: "Exception", at: "2026-08-04T13:12:00.000Z", actorId: "system" },
                      { from: "Exception", to: "Verified", at: "2026-08-04T13:25:00.000Z", actorId: "admin_1" },
                    ],
                  },
                },
              ],
            },
          ],
        },
        specialtyFireLedger: {
          version: 1,
          entries: [
            {
              id: "fire_1",
              at: "2026-08-04T14:00:00.000Z",
              ok: false,
              eventType: "INBOUND_SALES_EMAIL",
              skipReason: "provider_failure",
            },
          ],
        },
        operatorInterventions: {
          version: 1,
          open: [],
          closed: [
            {
              caseId: "rft_exception:biz_1:card_rescue",
              kind: "rft_exception",
              rootCause: "provider_failure",
              businessId: "biz_1",
              workflowRunId: "card_rescue",
              operatorId: "admin_1",
              startedAt: "2026-08-04T13:10:00.000Z",
              closedAt: "2026-08-04T13:25:00.000Z",
              minutesSpent: 15,
              resolutionOutcome: "Completed after operator rescue",
              linkedTraceRef: "card_rescue",
            },
          ],
        },
      },
    },
  });

  assert.equal(scorecard.eligibleEvents.status, "observable");
  assert.equal(scorecard.eligibleEvents.count, 2);
  assert.equal(scorecard.completed.count, 2);
  assert.equal(scorecard.automaticCompletions.count, 1);
  assert.equal(scorecard.operatorRescueCompletions.count, 1);
  assert.equal(scorecard.operatorInterventions.count, 1);
  assert.equal(scorecard.failedExternalActions.count, 1);
  assert.equal(scorecard.humanMinutesTotal.count, 15);
  assert.equal(scorecard.humanMinutesPerOutcome.status, "observable");
  assert.equal(scorecard.humanMinutesPerOutcome.minutes, 7.5);
  assert.match(scorecard.honesty.message, /separately/i);
});

test("composePilotScorecard leaves median response not_observable without baseline", () => {
  const scorecard = composePilotScorecard({
    businessId: "biz_2",
    nowISO: "2026-08-05T16:00:00.000Z",
    installation: {
      businessId: "biz_2",
      configuration: {
        crm: { version: 1, contacts: [], calendarEvents: [], pipelines: [] },
      },
    },
  });

  assert.equal(scorecard.eligibleEvents.status, "not_observable");
  assert.equal(scorecard.medianResponseMinutes.status, "not_observable");
});
