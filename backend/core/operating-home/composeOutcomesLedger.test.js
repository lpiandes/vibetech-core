import assert from "node:assert/strict";
import { test } from "node:test";

import { composeOutcomesLedger } from "./composeOutcomesLedger.js";
import { RFT_PIPELINE_ID } from "../ai-builder/operating-contract/rft/rftCatalog.js";

test("composeOutcomesLedger lists specialty fires and RFT traces without inventing proof", () => {
  const view = composeOutcomesLedger({
    businessId: "biz_1",
    installation: {
      configuration: {
        specialtyFireLedger: {
          version: 1,
          entries: [
            {
              id: "fire_1",
              at: "2026-08-05T12:00:00.000Z",
              eventType: "FORM_SUBMIT",
              eventLabel: "Form submitted",
              ok: true,
              workId: "work_1",
              approvalIds: ["appr_1"],
              brief: "Acknowledged Acme inquiry",
              gmailMessageId: "gmail_msg_proven_1",
              pathNotes: [
                "Captured in pipeline",
                { detail: "Drafted email", evidenceKind: "gmail_message_id", providerId: "gmail_msg_proven_1" },
              ],
            },
            {
              id: "fire_2",
              at: "2026-08-05T11:00:00.000Z",
              eventType: "META_LEAD",
              ok: false,
              skipReason: "business_email not connected",
              brief: "Could not send acknowledgement",
            },
          ],
        },
        crm: {
          pipelines: [
            {
              id: RFT_PIPELINE_ID,
              name: "Revenue Follow-Through",
              stages: [],
              cards: [
                {
                  id: "card_1",
                  title: "Acme Manufacturing",
                  rft: {
                    state: "Verified",
                    contractVersion: "1.0.0",
                    contentHash: "abc123",
                    outcomeType: "Acknowledged",
                    lastTransitionAt: "2026-08-05T12:30:00.000Z",
                    evidence: [{ kind: "gmail_message_id", providerId: "msg_9" }],
                    history: [
                      { from: "Executing", to: "Verified", at: "2026-08-05T12:30:00.000Z", actorId: "system" },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    },
    recentOutcomes: [{ id: "ro_1", title: "Follow-up sent", timestamp: "2026-08-05T10:00:00.000Z" }],
  });

  assert.equal(view.summary.total >= 3, true);
  assert.ok(view.items.some((i) => i.id === "fire_fire_1" && i.status === "completed"));
  assert.ok(view.items.some((i) => i.id === "fire_fire_2" && i.status === "exception"));
  assert.ok(view.items.some((i) => i.id === "rft_card_1" && i.evidence?.[0]?.providerId === "msg_9"));
  assert.match(view.honesty.message, /provider evidence/i);
});

test("composeOutcomesLedger excludes unproven recent outcomes from completed counts", () => {
  const view = composeOutcomesLedger({
    businessId: "biz_1",
    installation: null,
    recentOutcomes: [
      { id: "ro_proven", title: "Email sent", timestamp: "2026-08-05T10:00:00.000Z", providerId: "msg_1", evidenceKind: "gmail_message_id" },
      { id: "ro_unproven", title: "Maybe done", timestamp: "2026-08-05T09:00:00.000Z" },
    ],
  });

  assert.equal(view.summary.completed, 1);
  assert.equal(view.summary.unproven, 1);
  assert.equal(view.summary.proofBackedCompleted, 1);
  assert.ok(view.items.some((i) => i.id === "recent_ro_unproven" && i.status === "unproven"));
});

test("composeOutcomesLedger exposes proof metrics with honest not_observable", () => {
  const view = composeOutcomesLedger({ businessId: "biz_empty", installation: null });
  assert.equal(view.metrics.baselineDelta.status, "not_observable");
  assert.equal(view.metrics.slaAttainment.status, "not_observable");
  assert.equal(view.metrics.conversionMovement.status, "not_observable");
  assert.equal(view.metrics.proofBackedCompleted, 0);
  assert.deepEqual(view.metrics.autoVsHuman, { auto: 0, human: 0, not_observable: "No completed outcomes yet." });
});

test("composeOutcomesLedger counts proof-backed won and lost conversion movement", () => {
  const view = composeOutcomesLedger({
    businessId: "biz_1",
    installation: {
      configuration: {
        crm: {
          pipelines: [
            {
              id: RFT_PIPELINE_ID,
              cards: [
                {
                  id: "won_1",
                  title: "Won handoff",
                  rft: {
                    state: "OutcomeRecorded",
                    outcomeType: "WonHandoffCompleted",
                    lastTransitionAt: "2026-08-05T12:30:00.000Z",
                    evidence: [{ kind: "crm_record_id", providerId: "crm_1" }],
                    history: [],
                  },
                },
                {
                  id: "lost_1",
                  title: "Lost with reason",
                  rft: {
                    state: "Closed",
                    outcomeType: "LostReasonRecorded",
                    lastTransitionAt: "2026-08-05T11:30:00.000Z",
                    evidence: [{ kind: "crm_record_id", providerId: "crm_2" }],
                    history: [],
                  },
                },
                {
                  id: "unproven_won",
                  title: "Unproven win",
                  rft: {
                    state: "OutcomeRecorded",
                    outcomeType: "WonHandoffCompleted",
                    lastTransitionAt: "2026-08-05T10:30:00.000Z",
                    evidence: [],
                    history: [],
                  },
                },
              ],
            },
          ],
        },
      },
    },
  });

  assert.deepEqual(view.metrics.conversionMovement, {
    status: "observable",
    won: 1,
    lost: 1,
    reason: null,
  });
});
