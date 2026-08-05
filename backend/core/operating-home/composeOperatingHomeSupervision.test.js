import assert from "node:assert/strict";
import { test } from "node:test";

import {
  composeOperatingHomeSupervision,
  DEFAULT_SECTION_ORDER,
} from "./composeOperatingHomeSupervision.js";
import { presentEmployeeOperatingStatus } from "./presentEmployeeOperatingStatus.js";

test("Home supervision prioritizes decisions and active operations above analytics", () => {
  const supervision = composeOperatingHomeSupervision({
    experience: {
      waitingOnYou: [{
        id: "intel_1",
        title: "Follow up stalled",
        reason: "No outcome in 7 days",
        summary: "Evidence from Work queue",
        intelligenceCandidateId: "intel_1",
        sourceType: "intelligence",
        availableActions: [{ id: "review", label: "Review", href: "/intelligence" }],
      }],
      activeBusinessEpisodes: [{
        id: "ep1",
        title: "Inquiry in progress",
        currentState: "IN_PROGRESS",
        whatVibeTechHandled: [{ id: "s1", label: "Request identified" }],
        nextStepLabel: "Confirm visit",
        journeyLine: "Contacting vendor",
      }],
      aiWorkforceActivity: {
        digitalEmployees: [{
          id: "emp_1",
          name: "Coordinator",
          status: "ACTIVE",
          operatingLabel: "Working",
          currentHandling: "Inquiry",
          responsibility: "Intake",
        }],
        handledByVibeTech: [{
          id: "h1",
          title: "Maintenance follow-up was completed",
          result: "sent",
          providerId: "gmail_msg_1",
          proven: true,
          actorName: "Coordinator",
          occurredAt: "2026-07-01T12:00:00.000Z",
        }],
      },
      businessTimeline: [{ id: "a1", title: "Work created", actorName: "VIBETech" }],
      recentlyImproved: [],
      recentCommunications: [{ id: "c1", label: "Alex", summary: "Draft reply", status: "draft" }],
      criticalMetrics: [{ id: "open_work", label: "Open work", value: 2 }],
      businessControlStatus: { tone: "warning", label: "Needs attention", reason: "Decisions waiting" },
      executiveBriefing: { summary: "Busy day", nextHumanStep: "Review stalled follow-up", whatChanged: [] },
    },
    ownerFirstName: "Teddy",
    businessId: "biz_1",
    setupChecklist: [{ id: "email", title: "Connect email", actionLabel: "Connect", href: "/integrations", complete: false }],
  });

  assert.match(supervision.greeting.headline, /Teddy\./);
  assert.match(supervision.operatingSummary.headline, /needs? your decision/i);
  assert.equal(supervision.needsDecision.items.length, 1);
  assert.equal(supervision.needsDecision.items[0].id, "intel_1");
  assert.match(String(supervision.needsDecision.items[0].actions[0]?.href ?? ""), /\/b\/biz_1\/intelligence/);
  assert.equal(supervision.workingNow.length, 1);
  assert.equal(supervision.workingNow[0].completedSteps[0].label, "Request identified");
  assert.equal(supervision.recentOutcomes[0].result, "Sent");
  assert.equal(supervision.conversations[0].direction, "Drafted — not sent");
  assert.match(supervision.conversations[0].href, /\/b\/biz_1\/inbox$/);
  assert.equal(supervision.setup.visible, true);
  assert.match(supervision.digitalWorkforce[0].askHref, /employeeId=emp_1/);
  assert.match(supervision.digitalWorkforce[0].askHref, /prompt=/);
  assert.equal(supervision.workingNow[0].openWorkHref, "/b/biz_1/work");
  assert.match(supervision.recentOutcomes[0].href, /\/b\/biz_1\/work$/);
  assert.deepEqual(supervision.sectionOrder, DEFAULT_SECTION_ORDER);
  assert.ok(supervision.sectionOrder.indexOf("approvalsInbox") < supervision.sectionOrder.indexOf("needsDecision"));
  assert.ok(supervision.sectionOrder.indexOf("needsDecision") < supervision.sectionOrder.indexOf("businessOverview"));
  assert.ok(supervision.sectionOrder.indexOf("workingNow") < supervision.sectionOrder.indexOf("businessOverview"));
  assert.equal(supervision.approvalsInbox.items.length, 0);
  const rendered = JSON.stringify(supervision);
  assert.ok(!/canonical evidence/i.test(rendered));
  assert.ok(!/IN_PROGRESS/.test(supervision.workingNow[0].currentState));
});

test("empty attention section remains visible with reassuring copy", () => {
  const supervision = composeOperatingHomeSupervision({
    experience: {
      waitingOnYou: [],
      activeBusinessEpisodes: [],
      aiWorkforceActivity: { digitalEmployees: [], handledByVibeTech: [] },
      businessTimeline: [],
      recentlyImproved: [],
      recentCommunications: [],
      criticalMetrics: [],
      businessControlStatus: { tone: "success", label: "Under control", reason: "Quiet" },
    },
    ownerFirstName: "Sam",
  });
  assert.equal(supervision.needsDecision.items.length, 0);
  assert.match(supervision.needsDecision.emptyTitle, /Nothing needs your judgment/i);
  assert.match(supervision.operatingSummary.headline, /running normally|under control/i);
  assert.equal(supervision.setup.visible, false);
});

test("draft communication is not labeled sent and outcomes require evidence", () => {
  const supervision = composeOperatingHomeSupervision({
    experience: {
      waitingOnYou: [],
      activeBusinessEpisodes: [],
      aiWorkforceActivity: {
        digitalEmployees: [],
        handledByVibeTech: [
          { id: "d1", title: "Draft outreach", result: "handled", actorName: "Coordinator" },
          { id: "s1", title: "Owner update", result: "sent", actorName: "VIBETech", occurredAt: "2026-07-01T10:00:00.000Z" },
        ],
      },
      businessTimeline: [],
      recentlyImproved: [{ id: "imp1", label: "Workflow change installed", at: "2026-07-01T11:00:00.000Z" }],
      recentCommunications: [{ id: "c1", label: "Jordan", status: "draft", summary: "Pending review" }],
      criticalMetrics: [],
    },
  });
  assert.equal(supervision.conversations[0].direction, "Drafted — not sent");
  assert.ok(supervision.recentOutcomes.some((row) => row.result === "Sent"));
  assert.ok(supervision.recentOutcomes.some((row) => /installed/i.test(row.title)));
  assert.ok(!supervision.recentActivity.some((row) => /fabricat/i.test(row.title)));
});

test("AI employee status derives from assignment and readiness evidence", () => {
  assert.equal(presentEmployeeOperatingStatus({
    status: "READY",
    currentHandling: null,
  }).label, "Standing by");
  assert.equal(presentEmployeeOperatingStatus({
    status: "ACTIVE",
    currentHandling: "Lease follow-up",
  }).label, "Working now");
  assert.equal(presentEmployeeOperatingStatus({
    status: "NEEDS_CONFIGURATION",
    blockedCapability: "Email",
  }).label, "Getting ready");
  assert.equal(presentEmployeeOperatingStatus({
    status: "READY",
    needsFromOwner: "2 owner approvals blocking continuation",
  }).label, "Needs your approval");
});

test("teammates needing approval get Ask VIBETech destinations with purpose", () => {
  const supervision = composeOperatingHomeSupervision({
    experience: {
      waitingOnYou: [],
      activeBusinessEpisodes: [],
      aiWorkforceActivity: {
        digitalEmployees: [{
          id: "emp_approve",
          name: "Maintenance Coordinator",
          status: "READY",
          needsFromOwner: "Approve draft reply",
          responsibility: "Maintenance",
        }, {
          id: "emp_idle",
          name: "Resident Coordinator",
          status: "READY",
          responsibility: "Residents",
        }],
        handledByVibeTech: [],
      },
      businessTimeline: [],
      recentlyImproved: [],
      recentCommunications: [],
      criticalMetrics: [],
    },
    businessId: "biz_1",
  });
  const approval = supervision.digitalWorkforce.find((emp) => emp.id === "emp_approve");
  const idle = supervision.digitalWorkforce.find((emp) => emp.id === "emp_idle");
  assert.equal(approval.status, "needs_approval");
  assert.match(approval.askHref, /employeeId=emp_approve/);
  assert.match(decodeURIComponent(approval.askHref.replace(/\+/g, " ")), /needs approved/i);
  assert.equal(approval.nextAction, "Approve draft reply");
  assert.equal(idle.status, "idle");
  assert.match(idle.askHref, /employeeId=emp_idle/);
  assert.match(decodeURIComponent(idle.askHref.replace(/\+/g, " ")), /take on next/i);
  assert.equal(idle.nextAction, null);
});

test("setup banner hides when no required readiness blockers remain", () => {
  const supervision = composeOperatingHomeSupervision({
    experience: {
      waitingOnYou: [],
      activeBusinessEpisodes: [],
      aiWorkforceActivity: { digitalEmployees: [], handledByVibeTech: [] },
      businessTimeline: [],
      recentlyImproved: [],
      recentCommunications: [],
      criticalMetrics: [],
    },
    setupChecklist: [
      { id: "team", title: "Invite team", actionLabel: "Invite", href: "/team", complete: true },
      { id: "email", title: "Connect email", actionLabel: "Connect", href: "/integrations", complete: true },
    ],
  });
  assert.equal(supervision.setup.visible, false);
  assert.equal(supervision.setup.incomplete.length, 0);
});

test("connection attention links resolve into the business integrations route", () => {
  const supervision = composeOperatingHomeSupervision({
    experience: {
      waitingOnYou: [{
        id: "attention_conn_1",
        title: "Connect Business Email for production",
        reason: "Real business provider is not yet connected.",
        priority: "medium",
        priorityBadge: "neutral",
        recommendedAction: "Complete production provider setup in Connections.",
        availableActions: [{ id: "connect_system", label: "Open connections", href: "/connections" }],
        sourceType: "connection",
      }],
      activeBusinessEpisodes: [],
      aiWorkforceActivity: { digitalEmployees: [], handledByVibeTech: [] },
      businessTimeline: [],
      recentlyImproved: [],
      recentCommunications: [],
      criticalMetrics: [],
    },
    businessId: "biz_mm",
  });
  const item = supervision.needsDecision.items[0];
  assert.equal(item.priority, "medium");
  assert.equal(item.actions[0].href, "/b/biz_mm/integrations");
  assert.match(item.actions[0].label, /connections|Connect/i);
});

test("specialty draft attention surfaces on Home needsDecision with Open draft href", () => {
  const supervision = composeOperatingHomeSupervision({
    experience: {
      waitingOnYou: [{
        id: "attention_specialty_draft_w1",
        title: "Intake specialist: Jane Lead",
        summary: "Meta / Facebook lead · Jane Lead",
        reason: "Open the draft and decide what happens next.",
        priority: "high",
        sourceType: "specialty_draft",
        sourceId: "w1",
        workId: "w1",
        workHref: "/b/biz_1/work?workId=w1",
        availableActions: [{ id: "review_draft", label: "Open draft", href: "/b/biz_1/work?workId=w1" }],
      }],
      activeBusinessEpisodes: [],
      aiWorkforceActivity: { digitalEmployees: [], handledByVibeTech: [] },
      businessTimeline: [],
      recentlyImproved: [],
      recentCommunications: [],
      criticalMetrics: [],
    },
    businessId: "biz_1",
  });
  assert.equal(supervision.approvalsInbox.items.length, 0);
  assert.equal(supervision.needsDecision.items.length, 1);
  const item = supervision.needsDecision.items[0];
  assert.equal(item.title, "Intake specialist: Jane Lead");
  assert.match(item.why, /Meta \/ Facebook lead/);
  assert.match(item.why, /Open the draft/);
  assert.equal(item.actions[0].href, "/b/biz_1/work?workId=w1");
  assert.match(item.actions[0].label, /Open draft/i);
});
