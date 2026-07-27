import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { runSpecialtyDraftJob } from "./runSpecialtyDraftJob.js";
import { specialtyAutomationMatchesEvent } from "./registerEmployeeOperatingAutomation.js";
import { executeSpecialtyPathSteps } from "./executeSpecialtyPathSteps.js";
import { specialtyEventLabel } from "./specialtyEventCatalog.js";
import { buildSpecialtyDraftGlance } from "./buildSpecialtyDraftGlance.js";
import {
  appendSpecialtyFireEntry,
  persistSpecialtyFireLedger,
  readSpecialtyFireLedger,
  summarizePayload,
} from "./specialtyFireLedger.js";

/**
 * Fire a specialty trigger: if employee automation is ACTIVE (or forceManual),
 * create a specialty draft Work item and run non-outbound path steps.
 */
export async function fireSpecialtyTrigger({
  workRuntime,
  automationRuntime = null,
  approvalRuntime = null,
  employee,
  brief = "",
  actorId = "system",
  businessId = null,
  knowledgeDocuments = [],
  eventType = "SPECIALTY_JOB_REQUESTED",
  eventLabel = null,
  forceManual = false,
  nowISO = () => new Date().toISOString(),
  fetchImpl = null,
  eventPayload = {},
  installation = null,
  platformStore = null,
} = {}) {
  const employeeId = String(employee?.employeeId ?? employee?.id ?? "").trim();
  const at = typeof nowISO === "function" ? nowISO() : String(nowISO);
  if (!employeeId) {
    return deepFreeze({ ok: false, reason: "employee_required" });
  }

  const type = String(eventType ?? "SPECIALTY_JOB_REQUESTED");
  const autos = automationRuntime?.getAutomations?.() ?? [];
  const linked = autos.filter((auto) => {
    const linkedId = String(auto?.metadata?.employeeId ?? "");
    return linkedId === employeeId || String(auto?.id ?? "").includes(employeeId);
  });

  const stubActive = Array.isArray(employee?.automationDefinitions)
    && employee.automationDefinitions.some((a) => String(a?.status ?? "").toUpperCase() === "ACTIVE");

  // Runtime automation status is the source of truth when automations are registered.
  // Installation stubs alone must not keep firing after the owner turns automations Off.
  const runtimeActive = linked.some((a) => String(a.status).toUpperCase() === "ACTIVE");
  const anyActive = linked.length
    ? runtimeActive
    : stubActive;
  const activeMatch = linked.find((auto) => specialtyAutomationMatchesEvent(auto, type));

  async function recordLedger(partial) {
    if (!platformStore || !installation) return null;
    try {
      const current = readSpecialtyFireLedger(installation);
      const { ledger, entry } = appendSpecialtyFireEntry(current, {
        at,
        eventType: type,
        eventLabel: eventLabel ?? specialtyEventLabel(type),
        employeeId,
        employeeName: employee?.displayName ?? employee?.name ?? employeeId,
        payloadSummary: summarizePayload(eventPayload),
        brief: String(brief ?? "").slice(0, 400),
        ...partial,
      });
      await persistSpecialtyFireLedger({
        platformStore,
        installation,
        ledger,
        actorId,
      });
      installation.configuration = {
        ...(installation.configuration ?? {}),
        specialtyFireLedger: ledger,
      };
      return entry;
    } catch {
      return null;
    }
  }

  if (!forceManual) {
    if (!linked.length && !stubActive) {
      await recordLedger({ ok: false, skipReason: "automation_not_registered" });
      return deepFreeze({ ok: false, reason: "automation_not_registered" });
    }
    if (!anyActive) {
      await recordLedger({ ok: false, skipReason: "automation_inactive" });
      return deepFreeze({ ok: false, reason: "automation_inactive" });
    }
    if (linked.length && !activeMatch && type !== "SPECIALTY_JOB_REQUESTED" && type !== "SPECIALTY_SCHEDULE_DUE" && type !== "EVENT_REMINDER_DUE") {
      const contractEvents = Array.isArray(employee?.operatingContract?.trigger?.eventTypes)
        ? employee.operatingContract.trigger.eventTypes.map(String)
        : [];
      const metaEvents = (employee?.automationDefinitions ?? []).flatMap((a) => (
        Array.isArray(a?.metadata?.eventTypes) ? a.metadata.eventTypes.map(String) : []
      ));
      if (![...contractEvents, ...metaEvents].includes(type)) {
        await recordLedger({ ok: false, skipReason: "event_not_subscribed" });
        return deepFreeze({ ok: false, reason: "event_not_subscribed", eventType: type });
      }
    }
  }

  const label = eventLabel ?? specialtyEventLabel(type);

  const result = await runSpecialtyDraftJob({
    workRuntime,
    employee,
    brief,
    actorId,
    businessId,
    knowledgeDocuments,
    triggerEventType: type,
    triggerLabel: label,
    nowISO,
    fetchImpl,
  });

  if (!result.ok) {
    await recordLedger({ ok: false, skipReason: result.reason ?? "draft_failed" });
    return deepFreeze({
      ...result,
      automationActive: anyActive,
      firedEventType: type,
    });
  }

  const workId = result.workItemId ?? result.workItem?.id ?? null;
  // Keep lead fields on the Work item so email/SMS tokens resolve at send time.
  if (workId && workRuntime?.applyEvent && eventPayload && typeof eventPayload === "object") {
    try {
      const existing = workRuntime.getWorkItem?.(workId) ?? null;
      workRuntime.applyEvent({
        id: `evt_${workId}_personalization_${Date.now()}`,
        type: "WORK_ITEM_UPDATED",
        at: typeof nowISO === "function" ? nowISO() : String(nowISO ?? new Date().toISOString()),
        actorId: String(actorId || "system"),
        payload: {
          workItemId: workId,
          patch: {
            metadata: {
              ...(existing?.metadata ?? {}),
              eventPayload,
              personalization: eventPayload,
              contact: {
                name: eventPayload.name ?? null,
                email: eventPayload.email ?? null,
                phone: eventPayload.phone ?? null,
              },
            },
          },
        },
      });
    } catch {
      /* personalization attach is best-effort */
    }
  }

  let pathExecution = null;
  try {
    const existingWork = workId && workRuntime?.getWorkItem ? workRuntime.getWorkItem(workId) : null;
    pathExecution = await executeSpecialtyPathSteps({
      employee,
      installation,
      platformStore,
      businessId,
      actorId,
      eventPayload,
      brief,
      approvalRuntime,
      workItemId: workId,
      workItem: existingWork,
      nowISO,
    });
  } catch (err) {
    pathExecution = {
      ok: false,
      reason: err instanceof Error ? err.message : "path_exec_failed",
      notes: [],
      needsYou: false,
    };
  }

  const approvalIds = (pathExecution?.notes ?? [])
    .map((n) => n.approvalId)
    .filter(Boolean);
  const needsYou = Boolean(pathExecution?.needsYou || approvalIds.length);

  // Generic Home glance card — what happened + why the owner should look.
  if (workId && workRuntime?.applyEvent) {
    try {
      const existing = workRuntime.getWorkItem?.(workId) ?? null;
      const glance = buildSpecialtyDraftGlance({
        employee,
        triggerLabel: label,
        triggerEventType: type,
        eventPayload,
        brief,
        artifact: existing?.metadata?.artifact ?? result.artifact ?? null,
        approvalIds,
        businessId,
        workId,
        needsYou,
      });
      workRuntime.applyEvent({
        id: `evt_${workId}_glance_${Date.now()}`,
        type: "WORK_ITEM_UPDATED",
        at: typeof nowISO === "function" ? nowISO() : String(nowISO ?? new Date().toISOString()),
        actorId: String(actorId || "system"),
        payload: {
          workItemId: workId,
          patch: {
            metadata: {
              ...(existing?.metadata ?? {}),
              eventPayload: existing?.metadata?.eventPayload ?? eventPayload ?? null,
              personalization: existing?.metadata?.personalization ?? eventPayload ?? null,
              contact: existing?.metadata?.contact ?? (eventPayload ? {
                name: eventPayload.name ?? null,
                email: eventPayload.email ?? null,
                phone: eventPayload.phone ?? null,
              } : null),
              glance,
              needsYou,
              triggerEventType: type,
              triggerLabel: label,
            },
          },
        },
      });
    } catch {
      /* glance attach is best-effort */
    }
  }

  await recordLedger({
    ok: true,
    workId,
    approvalIds,
    pathNotes: (pathExecution?.notes ?? []).map((n) => ({
      stepId: n.stepId,
      type: n.type,
      ok: n.ok,
      reason: n.reason,
      label: n.label,
      approvalId: n.approvalId ?? null,
    })),
  });

  return deepFreeze({
    ...result,
    automationActive: anyActive,
    firedEventType: type,
    pathExecution,
  });
}

export function publishSpecialtyPlatformEvent({
  platformEventBus = null,
  platformEventStore = null,
  businessId,
  employeeId,
  eventType,
  payload = {},
  nowISO = null,
} = {}) {
  const at = String(nowISO ?? new Date().toISOString());
  const eventId = `evt_specialty_${String(eventType).toLowerCase()}_${employeeId}_${at.replace(/[^0-9]/g, "").slice(0, 14)}`;
  const event = deepFreeze({
    eventId,
    eventType: String(eventType),
    occurredAt: at,
    workspaceId: String(businessId),
    payload: deepFreeze({
      businessId: String(businessId),
      employeeId: String(employeeId),
      ...payload,
    }),
    metadata: deepFreeze({ source: "specialty_trigger" }),
  });

  if (platformEventStore?.append) {
    try {
      platformEventStore.append(event);
    } catch {
      /* best effort */
    }
  }
  if (platformEventBus?.publish) {
    try {
      platformEventBus.publish(event);
    } catch {
      /* best effort */
    }
  }
  return event;
}
