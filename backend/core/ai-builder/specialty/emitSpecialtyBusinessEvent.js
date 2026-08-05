/**
 * Fan-out a specialty business event to all ACTIVE employees subscribed to that eventType.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { fireSpecialtyTrigger, publishSpecialtyPlatformEvent } from "./fireSpecialtyTrigger.js";
import { specialtyAutomationMatchesEvent } from "./registerEmployeeOperatingAutomation.js";
import { specialtyEventLabel } from "./specialtyEventCatalog.js";

/**
 * @param {object} params
 * @param {object} params.installation - Business OS installation
 * @param {object} params.workRuntime
 * @param {object} [params.automationRuntime]
 * @param {string} params.businessId
 * @param {string} params.eventType
 * @param {string} [params.brief]
 * @param {object} [params.payload]
 * @param {string} [params.actorId]
 * @param {object[]} [params.knowledgeDocuments]
 * @param {boolean} [params.forceManual] - only for explicit Test; LIVE emits use false
 * @param {Function} [params.fireFn] - injectable for tests
 * @param {typeof fetch|null} [params.fetchImpl]
 */
export async function emitSpecialtyBusinessEvent({
  installation = null,
  workRuntime,
  automationRuntime = null,
  approvalRuntime = null,
  businessId,
  eventType,
  brief = "",
  payload = {},
  actorId = "system",
  knowledgeDocuments = [],
  forceManual = false,
  fireFn = fireSpecialtyTrigger,
  fetchImpl = null,
  nowISO = () => new Date().toISOString(),
  platformStore = null,
  platformEventBus = null,
  platformEventStore = null,
} = {}) {
  const type = String(eventType ?? "").trim();
  if (!type) {
    return deepFreeze({ ok: false, reason: "event_type_required", fired: [], skipped: [] });
  }
  // Specialty teammate paths need workRuntime; Zapier-style workflows can still run without it.

  const employees = Array.isArray(installation?.configuration?.employees)
    ? installation.configuration.employees
    : [];

  const label = specialtyEventLabel(type);
  const composedBrief = [
    String(brief ?? "").trim() || `${label}`,
    Object.keys(payload || {}).length
      ? `Context: ${JSON.stringify(payload)}`
      : "",
  ].filter(Boolean).join("\n");

  publishSpecialtyPlatformEvent({
    platformEventBus,
    platformEventStore,
    businessId,
    employeeId: "fanout",
    eventType: type,
    payload,
    nowISO: typeof nowISO === "function" ? nowISO() : nowISO,
  });

  const fired = [];
  const skipped = [];

  if (!workRuntime) {
    skipped.push({ employeeId: "*", reason: "work_runtime_required" });
  }

  for (const employee of employees) {
    if (!workRuntime) continue;
    const employeeId = String(employee?.employeeId ?? employee?.id ?? "").trim();
    if (!employeeId) continue;

    const autos = Array.isArray(employee?.automationDefinitions)
      ? employee.automationDefinitions
      : [];
    const stubActive = autos.some((a) => String(a?.status ?? "").toUpperCase() === "ACTIVE");
    const runtimeAutos = automationRuntime?.getAutomations?.() ?? [];
    const linked = runtimeAutos.filter((auto) => {
      const linkedId = String(auto?.metadata?.employeeId ?? "");
      return linkedId === employeeId || String(auto?.id ?? "").includes(employeeId);
    });
    const runtimeActive = linked.some((a) => String(a?.status ?? "").toUpperCase() === "ACTIVE");
    // Prefer runtime status when registered; stubs alone must not override Off.
    const isActive = forceManual || (linked.length ? runtimeActive : stubActive);

    if (!isActive) {
      skipped.push({ employeeId, reason: "automation_inactive" });
      continue;
    }

    const contractEvents = Array.isArray(employee?.operatingContract?.trigger?.eventTypes)
      ? employee.operatingContract.trigger.eventTypes.map(String)
      : [];
    const metaEvents = autos.flatMap((a) => (
      Array.isArray(a?.metadata?.eventTypes) ? a.metadata.eventTypes.map(String) : []
    ));
    const subscribed = new Set([...contractEvents, ...metaEvents]);

    // Always allow manual/test job + schedule due if they have any ACTIVE automation
    if (type === "SPECIALTY_JOB_REQUESTED" || type === "SPECIALTY_SCHEDULE_DUE") {
      /* subscription always ok when active — fireSpecialtyTrigger gates */
    } else if (!forceManual && subscribed.size && !subscribed.has(type)) {
      skipped.push({ employeeId, reason: "event_not_subscribed" });
      continue;
    } else if (!forceManual && !subscribed.size) {
      // No explicit subscription list — try match via automationRuntime defs
      const match = linked.find((auto) => specialtyAutomationMatchesEvent(auto, type));
      if (!match && !stubActive) {
        skipped.push({ employeeId, reason: "no_subscription" });
        continue;
      }
      if (linked.length && !match) {
        skipped.push({ employeeId, reason: "event_not_subscribed" });
        continue;
      }
    }

    try {
      const result = await fireFn({
        workRuntime,
        automationRuntime,
        approvalRuntime,
        employee,
        brief: composedBrief,
        actorId,
        businessId,
        knowledgeDocuments,
        eventType: type,
        eventLabel: label,
        forceManual,
        nowISO,
        fetchImpl,
        eventPayload: payload,
        installation,
        platformStore,
      });
      if (result?.ok) {
        fired.push({
          employeeId,
          workId: result.workId ?? result.work?.id ?? null,
          pathExecution: result.pathExecution ?? null,
        });
      } else {
        skipped.push({ employeeId, reason: result?.reason ?? "fire_failed" });
      }
    } catch (err) {
      skipped.push({
        employeeId,
        reason: err instanceof Error ? err.message : "fire_error",
      });
    }
  }

  let workflowResult = null;
  if (platformStore && installation) {
    try {
      const { runWorkflowsForEvent } = await import("../../workflows/WorkflowAutomationRunner.js");
      workflowResult = await runWorkflowsForEvent({
        platformStore,
        installation,
        eventType: type,
        payload,
        actorId,
        workRuntime,
      });
    } catch {
      workflowResult = { ok: false, reason: "workflow_runner_error", ran: [] };
    }
  }

  // Plan 13 — continuous RFT loop (inbound → seed/progress), independent of specialty draft success.
  let rftIngest = null;
  if (platformStore && installation) {
    try {
      const { ingestRftInboundEvent, RFT_INBOUND_EVENT_TYPES } = await import(
        "../operating-contract/rft/rftInboundIngest.js"
      );
      if (RFT_INBOUND_EVENT_TYPES.includes(type)) {
        // Refresh installation after specialty fires may have written CRM.
        const fresh = await platformStore.getBusinessOSInstallation(businessId).catch(() => installation);
        rftIngest = await ingestRftInboundEvent({
          platformStore,
          installation: fresh ?? installation,
          eventType: type,
          payload,
          actorId,
        });
      }
    } catch (err) {
      rftIngest = {
        ok: false,
        code: "ingest_error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return deepFreeze({
    ok: true,
    eventType: type,
    eventLabel: label,
    fired,
    skipped,
    firedCount: fired.length,
    workflows: workflowResult,
    rftIngest,
  });
}
