/**
 * Process calendar_reminder_due jobs → EVENT_REMINDER_DUE specialty draft.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { fireSpecialtyTrigger } from "../../ai-builder/specialty/fireSpecialtyTrigger.js";
import { ensureEmployeeOperatingAutomationRegistered } from "../../ai-builder/specialty/registerEmployeeOperatingAutomation.js";
import {
  CALENDAR_REMINDER_EMPLOYEE_ID,
  EVENT_REMINDER_DUE,
} from "../../ai-builder/specialty/calendarReminderEngine.js";
import { markCalendarReminderFired, readCrmState, writeCrmState } from "../../crm/CrmStore.js";

const OFFSET_LABELS = Object.freeze({
  "24h": "24 hours",
  "1h": "1 hour",
  "10m": "10 minutes",
});

export async function processCalendarReminderDueJob({
  job,
  loadWorkspace,
  platformStore = null,
  nowISO = () => new Date().toISOString(),
} = {}) {
  const businessId = String(job?.businessId ?? "");
  const employeeId = String(job?.payload?.employeeId ?? CALENDAR_REMINDER_EMPLOYEE_ID);
  const eventId = String(job?.payload?.eventId ?? "");
  const offset = String(job?.payload?.offset ?? "");
  if (!businessId || !eventId || !offset) {
    return deepFreeze({ ok: false, reason: "payload_incomplete" });
  }
  if (typeof loadWorkspace !== "function") {
    return deepFreeze({ ok: false, reason: "load_workspace_required" });
  }

  const workspace = await loadWorkspace(businessId);
  if (!workspace?.ok) {
    return deepFreeze({ ok: false, reason: workspace?.reason ?? "workspace_load_failed" });
  }

  const {
    workRuntime,
    automationRuntime,
    employee,
    knowledgeDocuments = [],
  } = workspace;

  try {
    ensureEmployeeOperatingAutomationRegistered({
      automationRuntime,
      employee,
      nowISO: typeof nowISO === "function" ? nowISO() : nowISO,
    });
  } catch {
    /* fireSpecialtyTrigger reports inactive */
  }

  const title = String(job?.payload?.eventTitle ?? "Club event");
  const start = String(job?.payload?.eventStart ?? "");
  const whenLabel = OFFSET_LABELS[offset] || offset;
  const brief = [
    `Calendar reminder (${whenLabel} before).`,
    `Event: ${title}`,
    start ? `Starts: ${new Date(start).toLocaleString()}` : null,
    "Audience: everyone in the organization who can see this club calendar event.",
    "Draft a short reminder notification. Outbound email/SMS stays approval-gated.",
  ].filter(Boolean).join("\n");

  const draft = await fireSpecialtyTrigger({
    workRuntime,
    automationRuntime,
    approvalRuntime: workspace.approvalRuntime ?? null,
    employee,
    actorId: "calendar_reminder_worker",
    businessId,
    knowledgeDocuments,
    eventType: EVENT_REMINDER_DUE,
    eventLabel: `Reminder · ${whenLabel} before`,
    forceManual: false,
    brief,
    nowISO,
    installation: workspace.installation ?? null,
    platformStore: platformStore ?? workspace.platformStore ?? null,
  });

  if (draft?.ok && typeof workspace.persistWork === "function") {
    await workspace.persistWork();
  }

  // Mark fired on CRM event when platformStore available
  if (platformStore && draft?.ok) {
    try {
      const installation = await platformStore.getBusinessOSInstallation(businessId);
      if (installation) {
        let crm = readCrmState(installation);
        crm = markCalendarReminderFired(crm, { eventId, offset });
        await writeCrmState({
          platformStore,
          installation,
          crm,
          actorId: "calendar_reminder_worker",
        });
      }
    } catch {
      /* best effort */
    }
  }

  return deepFreeze({
    ok: Boolean(draft?.ok),
    reason: draft?.ok ? null : draft?.reason,
    workItemId: draft?.workItemId ?? null,
    eventId,
    offset,
    draft,
  });
}
