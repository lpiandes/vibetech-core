import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkRuntime } from "../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { evaluateOutboundSendPermission } from "../approvals/OutboundApprovalGate.js";
import { resolveBusinessWorkLinks } from "../work/views/resolveWorkRowLinks.js";
import { UNIVERSAL_KNOWLEDGE_CATEGORIES } from "../platform/knowledge/universalKnowledgeCategories.js";

/**
 * Property design-partner loop:
 * Knowledge policies → prospect / maintenance Work → approve-first outbound.
 */
test("property loop: policy Knowledge categories + Work deep-links + outbound gate", () => {
  assert.ok(UNIVERSAL_KNOWLEDGE_CATEGORIES.some((c) => c.id === "POLICIES"));
  assert.ok(UNIVERSAL_KNOWLEDGE_CATEGORIES.some((c) => c.id === "SOP"));

  const NOW = "2026-07-15T15:00:00.000Z";
  const workRuntime = new WorkRuntime({ nowISO: NOW });

  // Seed a prospect follow-up work item shaped like PM intake.
  const stageId = workRuntime.getStages()[0]?.id;
  const queueId = workRuntime.getQueues()[0]?.id;
  assert.ok(stageId && queueId);

  workRuntime.applyEvent({
    id: "evt_pm_prospect_1",
    timestampISO: NOW,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "property_pilot",
    payload: {
      workItem: {
        id: "work_prospect_1",
        title: "Prospect follow-up — Lakeside unit 2B",
        description: "Respond using leasing policies from Knowledge.",
        workType: "relationship_follow_up",
        status: "ready",
        priority: "high",
        stageId,
        queueId,
        assignedTo: "pm_resident_prospect_coordinator",
        requestedBy: "party_prospect_1",
        source: "meta_lead",
        dueAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
        completedAt: null,
        blockedReason: null,
        relatedObjects: [],
        requirements: [],
        metadata: {
          knowledgeCategories: ["POLICIES", "PRICING"],
          purpose: "Prospect follow-up citing leasing policy",
        },
      },
    },
  });

  const work = workRuntime.getWorkItem("work_prospect_1");
  assert.ok(work);

  const links = resolveBusinessWorkLinks({
    businessId: "biz_pm_pilot",
    workItem: work,
  });
  assert.equal(links.rowHref, "/b/biz_pm_pilot/work?workId=work_prospect_1");

  workRuntime.applyEvent({
    id: "evt_pm_maintenance_1",
    timestampISO: NOW,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "property_pilot",
    payload: {
      workItem: {
        id: "work_maint_1",
        title: "Maintenance acknowledgment — HVAC",
        description: "Ack tenant using maintenance SOP from Knowledge.",
        workType: "maintenance_request",
        status: "ready",
        priority: "urgent",
        stageId,
        queueId,
        assignedTo: "pm_maintenance_coordinator",
        requestedBy: "party_resident_1",
        source: "resident_portal",
        dueAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
        completedAt: null,
        blockedReason: null,
        relatedObjects: [],
        requirements: [],
        metadata: {
          knowledgeCategories: ["SOP", "POLICIES"],
        },
      },
    },
  });

  const maint = workRuntime.getWorkItem("work_maint_1");
  assert.ok(maint);

  const outbound = evaluateOutboundSendPermission({
    capability: "SEND_EMAIL",
    channel: "email",
    outboundApproved: false,
    messageStatus: "draft",
  });
  assert.equal(outbound.allowed, false);
  assert.equal(outbound.forceApproval, true);

  workRuntime.applyEvent({
    id: "evt_complete_maint",
    timestampISO: NOW,
    type: WORK_EVENT_TYPES.WORK_ITEM_COMPLETED,
    source: "property_pilot",
    payload: {
      workItemId: "work_maint_1",
      completedAtISO: NOW,
      outcomeSummary: "Draft ack prepared; awaiting owner approval to send",
      memoryChanges: ["Maintenance policy cited on Work"],
    },
  });
  assert.equal(workRuntime.getWorkItem("work_maint_1").status, "completed");
  assert.match(String(workRuntime.getWorkItem("work_maint_1").outcomeSummary), /awaiting owner approval/i);
});
