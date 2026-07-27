import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { readSpecialtyFireLedger } from "../../ai-builder/specialty/specialtyFireLedger.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function summarizeTrigger(automation) {
  const triggers = safeArray(automation?.triggers);
  if (!triggers.length) return "Event-driven";
  return triggers.map((t) => String(t.eventType ?? t.type ?? "event")).join(", ");
}

function summarizeConditions(automation) {
  const conditions = safeArray(automation?.conditions);
  if (!conditions.length) return "No conditions";
  return `${conditions.length} condition(s)`;
}

function summarizeActions(automation) {
  const actions = safeArray(automation?.actions);
  if (!actions.length) return "No actions";
  return actions.map((a) => String(a.type ?? a.actionType ?? "action")).join(", ");
}

function explainClassicRun(run) {
  const matched = safeArray(run?.matchedConditions);
  const why = matched.length
    ? `Matched: ${matched.map((c) => String(c.conditionId ?? c.id ?? c.description ?? "condition")).slice(0, 3).join(", ")}`
    : (run?.message ? String(run.message) : "Rule matched event");
  return why;
}

export function buildAutomationCenterViewModel({
  identity,
  installationResult,
  automationRuntime,
  installation = null,
} = {}) {
  const installedIds = safeArray(installationResult?.installedArtifacts?.automationIds).map(String);
  const automations = safeArray(automationRuntime?.getAutomations?.());
  const runs = safeArray(automationRuntime?.getRuns?.());
  const specialtyLedger = readSpecialtyFireLedger(installation);

  const installed = automations
    .filter((a) => !installedIds.length || installedIds.includes(String(a.id)))
    .map((automation) => {
      const automationId = String(automation.id);
      const automationRuns = runs.filter((r) => String(r.automationId) === automationId);
      const lastRun = automationRuns[automationRuns.length - 1] ?? null;

      return deepFreeze({
        id: automationId,
        name: String(automation.name ?? automationId),
        status: String(automation.status ?? "UNKNOWN"),
        triggerSummary: summarizeTrigger(automation),
        conditionSummary: summarizeConditions(automation),
        actionSummary: summarizeActions(automation),
        requiresApproval: Boolean(automation.metadata?.requiresApproval),
        runCount: automationRuns.length,
        lastRunAt: lastRun?.startedAt ?? null,
        lastRunStatus: lastRun?.status ?? null,
        recentRuns: deepFreeze(
          automationRuns.slice(-5).map((r) => ({
            id: r.id,
            status: r.status,
            startedAt: r.startedAt,
            completedAt: r.completedAt ?? null,
            explanation: explainClassicRun(r),
            matchedConditions: safeArray(r.matchedConditions).map((c) => ({
              id: String(c.conditionId ?? c.id ?? ""),
              result: c.result,
            })),
          })),
        ),
        pendingApprovals: automationRuns.filter((r) => r.status === "WAITING_FOR_APPROVAL").length,
      });
    });

  const attention = installed
    .filter((a) => a.lastRunStatus === "FAILED" || a.pendingApprovals > 0)
    .map((a) => ({
      id: `automation_attention_${a.id}`,
      title: a.pendingApprovals > 0 ? `${a.name} awaiting approval` : `${a.name} last run failed`,
      priority: "immediate",
    }));

  const classicRecent = runs
    .slice(-10)
    .reverse()
    .map((r) => ({
      id: r.id,
      automationId: r.automationId,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt ?? null,
      source: "classic",
      explanation: explainClassicRun(r),
      workId: r.workItemId ?? r.metadata?.workItemId ?? null,
    }));

  const specialtyRecent = (specialtyLedger.entries ?? []).slice(0, 10).map((e) => ({
    id: e.id,
    automationId: e.employeeId,
    status: e.ok ? (e.skipReason ? "SKIPPED" : "SUCCESS") : "FAILED",
    startedAt: e.at,
    completedAt: e.at,
    source: "specialty",
    explanation: [
      e.eventLabel || e.eventType,
      e.employeeName ? `· ${e.employeeName}` : null,
      e.skipReason ? `· ${e.skipReason}` : null,
      e.workId ? `· Work ${e.workId}` : null,
    ].filter(Boolean).join(" "),
    workId: e.workId,
    approvalIds: e.approvalIds ?? [],
    eventType: e.eventType,
  }));

  const mergedRecent = [...specialtyRecent, ...classicRecent]
    .sort((a, b) => String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")))
    .slice(0, 15);

  return deepFreeze({
    title: identity?.pageLabels?.automationsPageTitle ?? "Automations",
    summary: deepFreeze({
      installed: installed.length,
      active: installed.filter((a) => String(a.status).toUpperCase() === "ACTIVE").length,
      totalRuns: runs.length + (specialtyLedger.entries?.length ?? 0),
      pendingApprovals: runs.filter((r) => r.status === "WAITING_FOR_APPROVAL").length,
      failedRuns: runs.filter((r) => r.status === "FAILED").length,
      specialtyFires: specialtyLedger.entries?.length ?? 0,
    }),
    automations: deepFreeze(installed),
    recentRuns: deepFreeze(mergedRecent),
    specialtyFireLedger: deepFreeze(specialtyLedger.entries?.slice(0, 25) ?? []),
    attention: deepFreeze(attention),
    recommendedNextStep: attention[0]?.title ?? "Monitor automation runs and resolve approval gates promptly.",
  });
}

export class AutomationCenterViewAdapter {
  translate(input = {}) {
    return buildAutomationCenterViewModel(input);
  }
}
