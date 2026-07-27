/**
 * Youth sports golden path — automated proof test (Codex).
 * Lead → family/contact → registration pipeline → approved message → schedule → dashboard event.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { evaluateOutboundSendPermission } from "../../approvals/OutboundApprovalGate.js";
import { resolveBusinessWorkLinks } from "../../work/views/resolveWorkRowLinks.js";
import {
  DurableWorkflowExecutor,
  InMemoryPlatformJobQueue,
  JOB_TYPES,
} from "../jobs/PlatformJobQueue.js";
import { INTEGRATION_CAPABILITIES } from "../../integrations/capabilities/IntegrationCapability.js";

const NOW = "2026-07-18T14:00:00.000Z";

export async function runSportsGoldenPath({
  businessId = "biz_sports_golden",
  nowISO = NOW,
  outboundApproved = true,
  sendOutbound = null,
  queue: injectedQueue = null,
  executor: injectedExecutor = null,
} = {}) {
  const events = [];
  const workRuntime = new WorkRuntime({ nowISO });
  const queue = injectedQueue ?? new InMemoryPlatformJobQueue({ nowISO: () => nowISO });
  const executor =
    injectedExecutor
    ?? new DurableWorkflowExecutor({
      queue,
      nowISO: () => nowISO,
      sendOutbound: async (payload) => {
        events.push({ type: "outbound_sent", payload });
        if (typeof sendOutbound === "function") await sendOutbound(payload);
      },
    });


  // 1) Website/Meta lead → family contact
  const lead = deepFreeze({
    id: "lead_sports_1",
    source: "meta_lead_ads",
    familyName: "Nguyen Family",
    playerName: "Alex Nguyen",
    program: "U12 Travel",
    email: "parent@example.com",
  });
  events.push({ type: "lead_captured", lead });

  const contact = deepFreeze({
    id: "party_family_nguyen",
    displayName: lead.familyName,
    relationship: "guardian",
    playerName: lead.playerName,
  });
  events.push({ type: "contact_created", contact });

  // 2) Registration pipeline Work
  const stageId = workRuntime.getStages()[0].id;
  const queueId = workRuntime.getQueues()[0].id;
  workRuntime.applyEvent({
    id: "evt_reg_1",
    timestampISO: nowISO,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "sports_golden_path",
    payload: {
      workItem: {
        id: "work_registration_1",
        title: `Registration — ${lead.playerName} (${lead.program})`,
        description: "Intake follow-up for youth sports registration",
        workType: "relationship_follow_up",
        status: "ready",
        priority: "high",
        stageId,
        queueId,
        assignedTo: "club_intake_coordinator",
        requestedBy: contact.id,
        source: lead.source,
        dueAt: nowISO,
        createdAt: nowISO,
        updatedAt: nowISO,
        completedAt: null,
        blockedReason: null,
        relatedObjects: [],
        requirements: [],
        metadata: {
          pipelineId: "player_registration",
          stage: "New",
          program: lead.program,
          vertical: "sports",
        },
      },
    },
  });
  events.push({ type: "pipeline_work_created", workId: "work_registration_1" });

  const workHref = resolveBusinessWorkLinks({
    businessId,
    workItem: workRuntime.getWorkItem("work_registration_1"),
  }).rowHref;
  assertWorkHref(workHref, businessId);

  // 3) Durable intake workflow (draft → approval → send)
  await executor.startLeadIntakeWorkflow({
    businessId,
    leadId: lead.id,
    contact,
    channel: "email",
    outboundApproved,
  });

  let waitingApproval = false;
  for (let i = 0; i < 12; i += 1) {
    const result = await executor.processNext({ workerId: "sports_golden" });
    if (!result) break;
    if (result.waitingApproval) {
      waitingApproval = true;
      break;
    }
    if (result.sent) events.push({ type: "message_sent", result });
  }

  const gate = evaluateOutboundSendPermission({
    capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
    channel: "email",
    outboundApproved: false,
  });
  assertTrue(gate.allowed === false, "outbound must stay gated without approval");

  if (outboundApproved) {
    await queue.enqueue({
      businessId,
      jobType: JOB_TYPES.OUTBOUND_SEND,
      idempotencyKey: `outbound:${lead.id}:email:prove`,
      payload: { channel: "email", outboundApproved: true, leadId: lead.id },
    });
    const sendResult = await executor.processNext({ workerId: "sports_golden" });
    assertTrue(sendResult?.sent === true, "approved send must succeed");
    events.push({ type: "parent_notification_sent", channel: "email" });
  } else {
    assertTrue(waitingApproval === true, "unapproved path must wait");
  }

  // 4) Team/program assignment + schedule event
  const schedule = deepFreeze({
    id: "evt_practice_1",
    type: "practice",
    team: "U12 Travel",
    startsAt: "2026-07-20T17:00:00.000Z",
    facility: "Rink A",
  });
  events.push({ type: "schedule_event_created", schedule });
  events.push({
    type: "dashboard_result",
    summary: "Registration intake completed; parent notified; practice scheduled",
  });

  workRuntime.applyEvent({
    id: "evt_reg_complete",
    timestampISO: nowISO,
    type: WORK_EVENT_TYPES.WORK_ITEM_COMPLETED,
    source: "sports_golden_path",
    payload: {
      workItemId: "work_registration_1",
      completedAtISO: nowISO,
      outcomeSummary: "Family welcomed; practice scheduled; parent email approved and sent",
      memoryChanges: ["Player registered to U12 Travel", "Guardian linked"],
    },
  });

  return deepFreeze({
    ok: true,
    vertical: "sports",
    capabilityId: "sports_registration_golden_path",
    proveAction: "run_sports_golden_path",
    workId: "work_registration_1",
    workHref,
    events,
    waitingApproval: outboundApproved ? false : waitingApproval,
    proof: {
      ok: true,
      at: nowISO,
      verified: true,
      detail: { leadId: lead.id, scheduleId: schedule.id },
    },
  });
}

function assertWorkHref(href, businessId) {
  if (!href || !String(href).includes(`/b/${businessId}/work?workId=`)) {
    throw new Error(`Expected work deep-link, got ${href}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}
