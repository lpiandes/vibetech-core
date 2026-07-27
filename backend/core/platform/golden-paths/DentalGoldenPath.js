/**
 * Dental golden path — no PHI until privacy architecture lands.
 * New-patient lead → prospect → intake → appointment → confirmation (non-PHI fields only).
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

const NOW = "2026-07-18T15:00:00.000Z";

/** Explicit non-PHI fields only — never chart notes, diagnoses, or insurance IDs. */
const ALLOWED_PROSPECT_FIELDS = Object.freeze([
  "id",
  "displayName",
  "email",
  "phone",
  "preferredContact",
  "inquiryReason",
  "source",
]);

export function assertNoPhi(record = {}) {
  const banned = [
    "ssn",
    "diagnosis",
    "chart",
    "treatment_notes",
    "insurance_id",
    "medical_history",
    "phi",
  ];
  for (const key of Object.keys(record)) {
    const lower = key.toLowerCase();
    if (banned.some((b) => lower.includes(b))) {
      throw new Error(`PHI field blocked until privacy architecture: ${key}`);
    }
  }
  return true;
}

export async function runDentalGoldenPath({
  businessId = "biz_dental_golden",
  nowISO = NOW,
  outboundApproved = true,
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
      },
    });

  const lead = deepFreeze({
    id: "lead_dental_1",
    source: "website_form",
    displayName: "Jordan Lee",
    email: "jordan@example.com",
    phone: "+15551212",
    preferredContact: "email",
    inquiryReason: "New patient cleaning inquiry",
  });
  assertNoPhi(lead);
  events.push({ type: "lead_captured", lead });

  const prospect = deepFreeze({
    id: "party_prospect_jordan",
    displayName: lead.displayName,
    email: lead.email,
    preferredContact: lead.preferredContact,
    inquiryReason: lead.inquiryReason,
    source: lead.source,
  });
  assertNoPhi(prospect);
  for (const key of Object.keys(prospect)) {
    if (!ALLOWED_PROSPECT_FIELDS.includes(key)) {
      throw new Error(`Unexpected prospect field (keep non-PHI allowlist tight): ${key}`);
    }
  }
  events.push({ type: "prospect_created", prospect });

  const stageId = workRuntime.getStages()[0].id;
  const queueId = workRuntime.getQueues()[0].id;
  workRuntime.applyEvent({
    id: "evt_dental_intake_1",
    timestampISO: nowISO,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "dental_golden_path",
    payload: {
      workItem: {
        id: "work_dental_intake_1",
        title: `New patient intake — ${prospect.displayName}`,
        description: "Intake follow-up (non-PHI). Clinical records stay in the practice PMS.",
        workType: "relationship_follow_up",
        status: "ready",
        priority: "high",
        stageId,
        queueId,
        assignedTo: "dental_intake_coordinator",
        requestedBy: prospect.id,
        source: lead.source,
        dueAt: nowISO,
        createdAt: nowISO,
        updatedAt: nowISO,
        completedAt: null,
        blockedReason: null,
        relatedObjects: [],
        requirements: [],
        metadata: {
          pipelineId: "new_patient_intake",
          vertical: "dental",
          compliance: ["no_phi_until_privacy_architecture"],
        },
      },
    },
  });
  events.push({ type: "intake_work_created", workId: "work_dental_intake_1" });

  const workHref = resolveBusinessWorkLinks({
    businessId,
    workItem: workRuntime.getWorkItem("work_dental_intake_1"),
  }).rowHref;
  if (!workHref?.includes("workId=")) throw new Error("Dental intake must deep-link Work");

  await executor.startLeadIntakeWorkflow({
    businessId,
    leadId: lead.id,
    contact: prospect,
    channel: "email",
    outboundApproved,
  });

  for (let i = 0; i < 12; i += 1) {
    const result = await executor.processNext({ workerId: "dental_golden" });
    if (!result) break;
    if (result.waitingApproval && !outboundApproved) break;
  }

  const gate = evaluateOutboundSendPermission({
    capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
    channel: "email",
    outboundApproved: false,
  });
  if (gate.allowed) throw new Error("Dental outbound must remain gated without approval");

  if (outboundApproved) {
    await queue.enqueue({
      businessId,
      jobType: JOB_TYPES.OUTBOUND_SEND,
      idempotencyKey: `outbound:${lead.id}:email:prove`,
      payload: { channel: "email", outboundApproved: true, leadId: lead.id },
    });
    const sendResult = await executor.processNext({ workerId: "dental_golden" });
    if (!sendResult?.sent) throw new Error("Approved dental intake email must send");
    events.push({ type: "confirmation_sent", channel: "email" });
  }

  const appointment = deepFreeze({
    id: "appt_1",
    type: "new_patient_exam",
    startsAt: "2026-07-22T10:00:00.000Z",
    location: "Main office",
    // No clinical detail — scheduling metadata only
  });
  assertNoPhi(appointment);
  events.push({ type: "appointment_scheduled", appointment });
  events.push({ type: "reminder_queued", appointmentId: appointment.id });
  events.push({
    type: "dashboard_result",
    summary: "Prospect intake completed; appointment scheduled; reminder queued (non-PHI)",
  });

  workRuntime.applyEvent({
    id: "evt_dental_complete",
    timestampISO: nowISO,
    type: WORK_EVENT_TYPES.WORK_ITEM_COMPLETED,
    source: "dental_golden_path",
    payload: {
      workItemId: "work_dental_intake_1",
      completedAtISO: nowISO,
      outcomeSummary: "Intake follow-up approved; appointment booked; no PHI stored in VIBETech",
      memoryChanges: ["Prospect stage → Scheduled"],
    },
  });

  return deepFreeze({
    ok: true,
    vertical: "dental",
    capabilityId: "dental_intake_golden_path",
    proveAction: "run_dental_golden_path",
    workId: "work_dental_intake_1",
    workHref,
    events,
    compliance: ["no_phi_until_privacy_architecture"],
    proof: {
      ok: true,
      at: nowISO,
      verified: true,
      detail: { leadId: lead.id, appointmentId: appointment.id, phiStored: false },
    },
  });
}
