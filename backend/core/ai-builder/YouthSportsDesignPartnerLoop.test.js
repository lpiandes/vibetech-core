import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkRuntime } from "../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { CustomAiWorkerService } from "./custom-ai/CustomAiWorkerService.js";
import { evaluateOutboundSendPermission } from "../approvals/OutboundApprovalGate.js";
import { resolveBusinessWorkLinks } from "../work/views/resolveWorkRowLinks.js";
import { composeOperatingHomeSupervision } from "../operating-home/composeOperatingHomeSupervision.js";

const NOW = "2026-07-15T12:00:00.000Z";

/**
 * Youth sports design-partner loop:
 * Knowledge (curriculum) → specialty Work with citations → approval before outbound.
 */
test("youth sports loop: Knowledge-backed specialty Work deep-links and outbound stays gated", async () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  const knowledgeDocuments = [
    {
      id: "doc_usa_hockey_curriculum",
      title: "USA Hockey Adventurer practice plan",
      categoryIds: ["CURRICULUM"],
      contentText:
        "Stations: skating balance, edge control, small-area game. Cite USA Hockey Adventurer materials.",
    },
  ];

  const worker = new CustomAiWorkerService({
    nowISO: () => NOW,
    fetchImpl: async () => ({ ok: false, status: 404, text: async () => "" }),
  });

  const result = await worker.runJob({
    workRuntime,
    employee: {
      employeeId: "owner_emp_practice_builder",
      label: "Practice & Workout Plan Builder",
      purpose: "Build youth hockey practice plans from curriculum Knowledge",
      specialtyVocabularyId: "athletic_session",
      ownerAdded: true,
      capabilities: ["custom_ai_work"],
    },
    brief: "Build Wednesday practice for U10 Adventurer",
    actorId: "owner",
    businessId: "biz_sports_pilot",
    knowledgeDocuments,
  });

  assert.equal(result.ok, true);
  assert.ok(result.workHref?.includes("/work?workId="), "specialty deliverable must deep-link Work");
  assert.ok(result.workItemId);

  const work = workRuntime.getWorkItem(result.workItemId);
  assert.ok(work);
  assert.equal(String(work.status) !== "sent", true);

  const links = resolveBusinessWorkLinks({
    businessId: "biz_sports_pilot",
    workItem: work,
  });
  assert.equal(links.rowHref, `/b/biz_sports_pilot/work?workId=${encodeURIComponent(String(work.id))}`);

  workRuntime.applyEvent({
    id: `evt_complete_${work.id}`,
    timestampISO: NOW,
    type: WORK_EVENT_TYPES.WORK_ITEM_COMPLETED,
    source: "sports_pilot",
    payload: {
      workItemId: work.id,
      completedAtISO: NOW,
      outcomeSummary: "Practice plan reviewed; parent email still pending approval",
      memoryChanges: ["Curriculum citation recorded on Work"],
    },
  });
  const completed = workRuntime.getWorkItem(work.id);
  assert.equal(completed.status, "completed");
  assert.match(String(completed.outcomeSummary), /Practice plan/);

  const gate = evaluateOutboundSendPermission({
    capability: "SEND_EMAIL",
    channel: "email",
    outboundApproved: false,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.forceApproval, true);

  const supervision = composeOperatingHomeSupervision({
    experience: {
      waitingOnYou: [{
        id: "attention_approval_1",
        sourceType: "approval",
        approvalId: "apr_1",
        title: "Approve send to parent group",
        reason: "Outbound parent email",
        channel: "email",
        requestedBy: "Practice Builder",
        knowledgeCited: ["USA Hockey Adventurer practice plan"],
        workId: work.id,
        availableActions: [{ id: "open", label: "Open Work", href: `/work?workId=${work.id}` }],
      }],
      activeBusinessEpisodes: [],
      aiWorkforceActivity: { digitalEmployees: [], handledByVibeTech: [] },
      businessTimeline: [],
      recentlyImproved: [],
      recentCommunications: [],
      criticalMetrics: [],
    },
    businessId: "biz_sports_pilot",
  });

  assert.equal(supervision.approvalsInbox.items.length, 1);
  assert.match(supervision.approvalsInbox.items[0].auditSummary, /Knowledge/i);
  assert.match(String(supervision.approvalsInbox.items[0].workHref), /workId=/);
});
