import assert from "node:assert/strict";
import { test } from "node:test";

import { assertRootCauseRequired, presentRootCauseOptions } from "./operatorRootCause.js";
import {
  openOperatorIntervention,
  closeOperatorIntervention,
  readOperatorInterventions,
  summarizeRootCauseRoadmap,
} from "./operatorInterventions.js";
import {
  buildOperatorCasesForInstallation,
  buildRftOperatorQueue,
} from "./buildRftOperatorQueue.js";
import { RFT_PIPELINE_ID } from "../ai-builder/operating-contract/rft/rftCatalog.js";

test("root cause is mandatory and validated", () => {
  const missing = assertRootCauseRequired(null);
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "root_cause_required");

  const bad = assertRootCauseRequired("made_up");
  assert.equal(bad.ok, false);

  const ok = assertRootCauseRequired("provider_failure");
  assert.equal(ok.ok, true);
  assert.equal(ok.rootCause, "provider_failure");
  assert.ok(presentRootCauseOptions().length >= 8);
});

test("closeOperatorIntervention refuses without root cause", () => {
  const result = closeOperatorIntervention({
    caseId: "rft_exception:biz:card1",
    kind: "rft_exception",
    rootCause: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "root_cause_required");
});

test("closeOperatorIntervention records closed case with root cause", () => {
  const result = closeOperatorIntervention({
    caseId: "rft_exception:biz:card1",
    kind: "rft_exception",
    rootCause: "missing_integration",
    note: "Gmail reconnect",
    actorId: "admin_1",
    nowISO: "2026-08-05T16:00:00.000Z",
  });
  assert.equal(result.ok, true);
  assert.equal(result.intervention.rootCause, "missing_integration");
  assert.equal(result.state.closed.length, 1);
  assert.equal(result.intervention.partnerId, "biz");
  const read = readOperatorInterventions({
    configuration: { operatorInterventions: result.state },
  });
  assert.equal(read.closed[0].caseId, "rft_exception:biz:card1");
});

test("operator interventions compute minutes from start and end and preserve open metadata", () => {
  const opened = openOperatorIntervention({
    installation: { businessId: "biz_minutes" },
    caseId: "sla_risk:biz_minutes:card_1",
    kind: "sla_risk",
    workflowRunId: "wf_1",
    operatorId: "admin_minutes",
    startedAt: "2026-08-05T15:00:00.000Z",
    actionPerformed: "Owner callback",
    category: "customer_delay",
    nowISO: "2026-08-05T15:00:00.000Z",
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.state.open[0].workflowRunId, "wf_1");
  assert.equal(opened.state.open[0].actionPerformed, "Owner callback");

  const closed = closeOperatorIntervention({
    installation: { businessId: "biz_minutes", configuration: { operatorInterventions: opened.state } },
    caseId: "sla_risk:biz_minutes:card_1",
    kind: "sla_risk",
    rootCause: "customer_delay",
    endedAt: "2026-08-05T15:12:00.000Z",
    resolutionOutcome: "Completed after owner callback",
    wasNecessary: true,
    canAutomate: false,
    laborCostClass: "medium",
    linkedTraceRef: "card_1",
  });
  assert.equal(closed.ok, true);
  assert.equal(closed.intervention.operatorId, "admin_minutes");
  assert.equal(closed.intervention.minutesSpent, 12);
  assert.equal(closed.intervention.actionPerformed, "Owner callback");
  assert.equal(closed.intervention.wasNecessary, true);
  assert.equal(closed.intervention.canAutomate, false);
  assert.equal(closed.intervention.laborCostClass, "medium");
  assert.equal(closed.intervention.linkedTraceRef, "card_1");
});

test("queue surfaces RFT Exception and hides resolved cases", async () => {
  const installation = {
    businessId: "biz_1",
    configuration: {
      employees: [{
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
      crm: {
        version: 1,
        contacts: [],
        calendarEvents: [],
        pipelines: [{
          id: RFT_PIPELINE_ID,
          name: "RFT",
          stages: [],
          cards: [{
            id: "card_ex",
            title: "Acme stuck",
            rft: {
              state: "Exception",
              contractVersion: "1.0.0",
              contentHash: "abc",
              evidence: [{ kind: "gmail_message_id", providerId: "m1" }],
              history: [{ from: "Executing", to: "Exception", at: "2026-08-05T10:00:00.000Z" }],
              lastTransitionAt: "2026-08-05T10:00:00.000Z",
              createdAt: "2026-08-05T09:00:00.000Z",
            },
          }],
        }],
      },
      specialtyFireLedger: {
        entries: [{
          id: "fire_1",
          ok: false,
          skipReason: "email_not_connected",
          eventType: "INBOUND_SALES_EMAIL",
          at: "2026-08-05T11:00:00.000Z",
        }],
      },
    },
  };

  const open = buildOperatorCasesForInstallation({
    business: { id: "biz_1", name: "Northline" },
    installation,
    nowISO: "2026-08-05T16:00:00.000Z",
  });
  assert.ok(open.some((c) => c.kind === "rft_exception"));
  assert.ok(open.some((c) => c.kind === "specialty_fire_failed"));

  const closed = closeOperatorIntervention({
    installation,
    caseId: "rft_exception:biz_1:card_ex",
    kind: "rft_exception",
    rootCause: "ai_quality_failure",
  });
  const after = buildOperatorCasesForInstallation({
    business: { id: "biz_1", name: "Northline" },
    installation: {
      ...installation,
      configuration: {
        ...installation.configuration,
        operatorInterventions: closed.state,
      },
    },
    nowISO: "2026-08-05T16:00:00.000Z",
  });
  assert.equal(after.some((c) => c.id === "rft_exception:biz_1:card_ex"), false);
});

test("SLA risk appears when acknowledge window exceeded", () => {
  const installation = {
    businessId: "biz_2",
    configuration: {
      employees: [{
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
      crm: {
        version: 1,
        contacts: [],
        calendarEvents: [],
        pipelines: [{
          id: RFT_PIPELINE_ID,
          cards: [{
            id: "card_sla",
            title: "Slow ack",
            rft: {
              state: "Detected",
              createdAt: "2026-08-05T15:00:00.000Z",
              lastTransitionAt: "2026-08-05T15:00:00.000Z",
              evidence: [],
              history: [],
            },
          }],
        }],
      },
    },
  };
  const cases = buildOperatorCasesForInstallation({
    business: { id: "biz_2", name: "SLA Co" },
    installation,
    nowISO: "2026-08-05T15:20:00.000Z",
  });
  assert.ok(cases.some((c) => c.kind === "sla_risk"));
});

test("buildRftOperatorQueue aggregates across businesses", async () => {
  const queue = await buildRftOperatorQueue({
    businesses: [{ id: "biz_a", name: "A" }, { id: "biz_b", name: "B" }],
    getInstallation: async (id) => ({
      businessId: id,
      configuration: {
        employees: [{ operatingContract: { rft: { sla: { acknowledgeWithinMinutes: 5 } } } }],
        crm: {
          pipelines: [{
            id: RFT_PIPELINE_ID,
            cards: [{
              id: `card_${id}`,
              title: "Ex",
              rft: {
                state: "Exception",
                lastTransitionAt: "2026-08-05T10:00:00.000Z",
                evidence: [],
                history: [],
              },
            }],
          }],
        },
      },
    }),
  });
  assert.equal(queue.length, 2);
  assert.ok(queue.every((c) => c.kind === "rft_exception"));
});

test("roadmap feed ranks root causes", () => {
  const feed = summarizeRootCauseRoadmap([
    {
      businessId: "b1",
      closed: [
        { rootCause: "provider_failure" },
        { rootCause: "provider_failure" },
        { rootCause: "missing_integration" },
      ],
    },
  ]);
  assert.equal(feed.ranked[0].rootCause, "provider_failure");
  assert.equal(feed.ranked[0].count, 2);
  assert.equal(feed.totalClosed, 3);
});
