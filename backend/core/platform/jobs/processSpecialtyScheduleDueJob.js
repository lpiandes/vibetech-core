/**
 * Process specialty_schedule_due jobs: draft Work + chain next occurrence.
 * Used by the platform job worker (and tests).
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { fireSpecialtyTrigger } from "../../ai-builder/specialty/fireSpecialtyTrigger.js";
import {
  enqueueSpecialtyScheduleJob,
  resolveEmployeeSpecialtySchedule,
} from "../../ai-builder/specialty/specialtyScheduleEngine.js";
import { ensureEmployeeOperatingAutomationRegistered } from "../../ai-builder/specialty/registerEmployeeOperatingAutomation.js";

export async function processSpecialtyScheduleDueJob({
  job,
  queue,
  loadWorkspace,
  nowISO = () => new Date().toISOString(),
} = {}) {
  const businessId = String(job?.businessId ?? "");
  const employeeId = String(job?.payload?.employeeId ?? "");
  if (!businessId || !employeeId) {
    return deepFreeze({ ok: false, reason: "business_or_employee_missing" });
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

  // Ensure automation exists; schedule only fires if Active (unless stub says ACTIVE on install).
  try {
    ensureEmployeeOperatingAutomationRegistered({
      automationRuntime,
      employee,
      nowISO: typeof nowISO === "function" ? nowISO() : nowISO,
    });
  } catch {
    /* continue — fireSpecialtyTrigger will report inactive */
  }

  const draft = await fireSpecialtyTrigger({
    workRuntime,
    automationRuntime,
    approvalRuntime: workspace.approvalRuntime ?? null,
    employee,
    actorId: "specialty_schedule_worker",
    businessId,
    knowledgeDocuments,
    eventType: "SPECIALTY_SCHEDULE_DUE",
    eventLabel: "Scheduled digest",
    forceManual: false,
    nowISO,
    installation: workspace.installation ?? null,
    platformStore: workspace.platformStore ?? null,
  });

  if (draft?.ok && typeof workspace.persistWork === "function") {
    await workspace.persistWork();
  }

  const schedule = resolveEmployeeSpecialtySchedule(employee) ?? job?.payload?.schedule ?? null;
  let next = null;
  if (schedule && queue) {
    next = await enqueueSpecialtyScheduleJob({
      queue,
      businessId,
      employeeId,
      schedule,
      fromISO: typeof nowISO === "function" ? nowISO() : nowISO,
    });
  }

  return deepFreeze({
    ok: Boolean(draft?.ok),
    reason: draft?.ok ? null : draft?.reason,
    workItemId: draft?.workItemId ?? null,
    nextSchedule: next,
    draft,
  });
}
