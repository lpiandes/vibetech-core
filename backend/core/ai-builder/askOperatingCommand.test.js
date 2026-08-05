import assert from "node:assert/strict";
import { test } from "node:test";

import {
  matchOperatingCommandIntent,
  answerOperatingCommand,
  formatOperatingCommandReply,
  OPERATING_ASK_SUGGESTIONS,
} from "./askOperatingCommand.js";
import { RFT_PIPELINE_ID } from "./operating-contract/rft/rftCatalog.js";

test("matches supported operating intents and aligned suggestions", () => {
  assert.equal(matchOperatingCommandIntent("Why was the latest opportunity escalated?")?.intent, "explain_escalation");
  assert.equal(matchOperatingCommandIntent("Why was the latest opportunity escalated?")?.latest, true);
  assert.equal(
    matchOperatingCommandIntent("Show every proposal without a next step.")?.intent,
    "list_proposals_no_next_step",
  );
  assert.equal(matchOperatingCommandIntent("What needs my approval?")?.intent, "list_approvals_needed");
  assert.equal(matchOperatingCommandIntent("What changed today?")?.intent, "what_changed_today");
  assert.equal(matchOperatingCommandIntent("Which rule is causing the most escalations?")?.intent, "rule_escalation_hotspots");
  assert.equal(matchOperatingCommandIntent("Where are we missing evidence?")?.intent, "list_missing_evidence");
  assert.equal(matchOperatingCommandIntent("Change response promise to one hour.")?.intent, "draft_sla_change");
  assert.equal(matchOperatingCommandIntent("Change response promise to one hour.")?.minutes, 60);
  assert.equal(OPERATING_ASK_SUGGESTIONS.length, 7);
});

test("explain escalation refuses without matching evidence", () => {
  const result = answerOperatingCommand({
    text: "Why was Acme escalated?",
    installation: {
      configuration: {
        crm: { pipelines: [{ id: RFT_PIPELINE_ID, cards: [] }], contacts: [], calendarEvents: [] },
        specialtyFireLedger: { entries: [] },
      },
    },
    businessId: "biz_1",
  });
  assert.equal(result.handled, true);
  assert.equal(result.refused, true);
  assert.equal(result.inventedFacts, false);
  assert.match(result.message, /No Exception/i);
});

test("explain escalation cites Exception card evidence", () => {
  const result = answerOperatingCommand({
    text: "Why was Acme escalated?",
    installation: {
      configuration: {
        crm: {
          pipelines: [{
            id: RFT_PIPELINE_ID,
            cards: [{
              id: "card_1",
              title: "Acme Manufacturing",
              rft: {
                state: "Exception",
                contractVersion: "1.0.0",
                contentHash: "abcd".repeat(16),
                evidence: [{ kind: "gmail_message_id", providerId: "msg_9" }],
                history: [{
                  from: "Executing",
                  to: "Exception",
                  eventType: "EXCEPTION_RAISED",
                  note: "Provider bounce",
                  at: "2026-08-05T12:00:00.000Z",
                }],
              },
            }],
          }],
          contacts: [],
          calendarEvents: [],
        },
      },
    },
    businessId: "biz_1",
  });
  assert.equal(result.handled, true);
  assert.equal(result.refused, undefined);
  assert.equal(result.inventedFacts, false);
  assert.match(result.message, /Acme Manufacturing/);
  assert.ok(result.evidence.some((e) => e.providerId === "msg_9"));
  const formatted = formatOperatingCommandReply(result);
  assert.match(formatted, /Sources:/);
});

test("list approvals needed uses ApprovalRequired cards only", () => {
  const result = answerOperatingCommand({
    text: "What needs my approval?",
    installation: {
      configuration: {
        crm: {
          pipelines: [{
            id: RFT_PIPELINE_ID,
            cards: [
              {
                id: "card_waiting",
                title: "Acme Proposal",
                rft: {
                  state: "ApprovalRequired",
                  lastTransitionAt: "2026-08-05T12:10:00.000Z",
                  outcomeType: "ProposalAdvanced",
                  evidence: [],
                },
              },
              {
                id: "card_done",
                title: "Closed deal",
                rft: { state: "Verified", evidence: [{ kind: "gmail_message_id", providerId: "msg_1" }] },
              },
            ],
          }],
          contacts: [],
          calendarEvents: [],
        },
      },
    },
    businessId: "biz_1",
  });
  assert.equal(result.handled, true);
  assert.equal(result.refused, undefined);
  assert.match(result.message, /waiting for your approval/i);
  assert.ok(result.evidence.some((e) => e.providerId === "card_waiting"));
});

test("what changed today lists today's specialty fires and RFT transitions", () => {
  const result = answerOperatingCommand({
    text: "What changed today?",
    nowISO: "2026-08-05T20:00:00.000Z",
    installation: {
      configuration: {
        specialtyFireLedger: {
          entries: [
            {
              id: "fire_today",
              at: "2026-08-05T12:00:00.000Z",
              eventType: "FORM_SUBMIT",
              brief: "Captured Acme inquiry",
              workId: "work_1",
              ok: true,
            },
            {
              id: "fire_old",
              at: "2026-08-04T12:00:00.000Z",
              eventType: "FORM_SUBMIT",
              brief: "Old event",
              ok: true,
            },
          ],
        },
        crm: {
          pipelines: [{
            id: RFT_PIPELINE_ID,
            cards: [{
              id: "card_1",
              title: "Acme Manufacturing",
              rft: {
                history: [
                  { from: "Executing", to: "Verified", at: "2026-08-05T13:30:00.000Z", eventType: "PROOF_ATTACHED" },
                  { from: "Detected", to: "ContextReady", at: "2026-08-04T13:30:00.000Z", eventType: "CONTEXT_ENRICHED" },
                ],
              },
            }],
          }],
          contacts: [],
          calendarEvents: [],
        },
      },
    },
    businessId: "biz_1",
  });
  assert.equal(result.handled, true);
  assert.match(result.message, /Recorded changes today/);
  assert.match(result.message, /Captured Acme inquiry/);
  assert.match(result.message, /Acme Manufacturing/);
  assert.equal(result.message.includes("Old event"), false);
});

test("list missing evidence surfaces unproven and exception outcomes", () => {
  const result = answerOperatingCommand({
    text: "Where are we missing evidence?",
    installation: {
      configuration: {
        crm: {
          pipelines: [{
            id: RFT_PIPELINE_ID,
            cards: [
              {
                id: "card_unproven",
                title: "Open proposal",
                rft: {
                  state: "Verified",
                  lastTransitionAt: "2026-08-05T12:30:00.000Z",
                  evidence: [],
                },
              },
              {
                id: "card_exception",
                title: "Escalated account",
                rft: {
                  state: "Exception",
                  lastTransitionAt: "2026-08-05T12:40:00.000Z",
                  evidence: [],
                },
              },
            ],
          }],
          contacts: [],
          calendarEvents: [],
        },
      },
    },
    businessId: "biz_1",
  });
  assert.equal(result.handled, true);
  assert.match(result.message, /missing provider evidence/i);
  assert.match(result.message, /Open proposal/);
  assert.match(result.message, /Escalated account/);
  assert.ok(result.evidence.some((e) => e.providerId === "card_unproven"));
});

test("rule escalation hotspots summarize recorded reasons honestly", () => {
  const installation = {
    configuration: {
      governedLearning: {
        corrections: [
          { correctionId: "corr_1", reasonCode: "missing_integration", reasonLabel: "Missing integration", evidence: [] },
          { correctionId: "corr_2", reasonCode: "missing_integration", reasonLabel: "Missing integration", evidence: [] },
        ],
      },
      specialtyFireLedger: {
        entries: [
          {
            id: "fire_1",
            at: "2026-08-05T12:00:00.000Z",
            ok: false,
            skipReason: "missing_integration",
            brief: "Could not send acknowledgement",
          },
        ],
      },
      crm: {
        pipelines: [{
          id: RFT_PIPELINE_ID,
          cards: [{
            id: "card_1",
            title: "Acme Manufacturing",
            rft: {
              state: "Exception",
              history: [
                { from: "Executing", to: "Exception", at: "2026-08-05T12:30:00.000Z", eventType: "EXCEPTION_RAISED", note: "sla_breach" },
              ],
            },
          }],
        }],
        contacts: [],
        calendarEvents: [],
      },
    },
  };
  const result = answerOperatingCommand({
    text: "Which rule is causing the most escalations?",
    installation,
    businessId: "biz_1",
  });
  assert.equal(result.handled, true);
  assert.match(result.message, /recorded escalation reasons/i);
  assert.match(result.message, /missing integration/i);
  assert.ok(result.evidence.some((e) => e.providerId === "fire_1"));
});

test("SLA draft needs confirmation and does not claim applied", () => {
  const result = answerOperatingCommand({
    text: "Change response promise to one hour.",
    installation: {
      configuration: {
        employees: [{
          employeeId: "emp_rft",
          operatingContract: {
            rft: {
              sla: { acknowledgeWithinMinutes: 5 },
              approvalRules: {},
              successProof: {},
              retry: {},
              costBoundary: {},
            },
          },
        }],
        crm: { pipelines: [], contacts: [], calendarEvents: [] },
      },
    },
    businessId: "biz_1",
  });
  assert.equal(result.handled, true);
  assert.equal(result.actionDraft?.type, "rft_sla_patch");
  assert.equal(result.actionDraft?.status, "needs_confirmation");
  assert.equal(result.actionDraft?.patch?.rft?.sla?.acknowledgeWithinMinutes, 60);
  assert.match(result.message, /not applied/i);
  assert.match(formatOperatingCommandReply(result), /Nothing was changed yet/);
});

test("reassign draft and approval preview stay non-mutating", () => {
  const installation = {
    configuration: {
      employees: [{
        employeeId: "emp_rft",
        operatingContract: {
          rft: {
            exceptionOwner: "customer_owner",
            sla: { acknowledgeWithinMinutes: 5 },
            approvalRules: { customerFacingRequiresApproval: true, existingCustomerSchedulingMayAuto: false },
            successProof: {},
            retry: {},
            costBoundary: {},
          },
        },
      }],
      crm: { pipelines: [], contacts: [], calendarEvents: [] },
    },
  };
  const reassign = answerOperatingCommand({
    text: "Sarah is on vacation — reassign to Alex.",
    installation,
    businessId: "biz_1",
  });
  assert.equal(reassign.actionDraft?.type, "rft_exception_owner_patch");
  assert.equal(reassign.actionDraft?.status, "needs_confirmation");

  const preview = answerOperatingCommand({
    text: "What if we stop requiring approval for existing customers?",
    installation,
    businessId: "biz_1",
  });
  assert.equal(preview.actionDraft?.status, "preview_only");
  assert.match(preview.message, /Preview only/i);
});

test("unrelated Ask text is not handled as operating command", () => {
  const result = answerOperatingCommand({
    text: "Add a purple theme to the dashboard",
    installation: { configuration: {} },
  });
  assert.equal(result.handled, false);
});
