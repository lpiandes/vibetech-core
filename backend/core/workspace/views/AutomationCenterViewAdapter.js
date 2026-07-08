import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

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

export function buildAutomationCenterViewModel({
  identity,
  installationResult,
  automationRuntime,
} = {}) {
  const installedIds = safeArray(installationResult?.installedArtifacts?.automationIds).map(String);
  const automations = safeArray(automationRuntime?.getAutomations?.());
  const runs = safeArray(automationRuntime?.getRuns?.());

  const installed = automations
    .filter((a) => !installedIds.length || installedIds.includes(String(a.id)))
    .map((automation) => {
      const automationId = String(automation.id);
      const automationRuns = runs.filter((r) => String(r.automationId) === automationId);
      const lastRun = automationRuns[automationRuns.length - 1] ?? null;
      const config = safeArray(installationResult?.installedArtifacts?.automationConfigurationIds);

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

  return deepFreeze({
    title: identity?.pageLabels?.automationsPageTitle ?? "Automations",
    summary: deepFreeze({
      installed: installed.length,
      active: installed.filter((a) => String(a.status).toUpperCase() === "ACTIVE").length,
      totalRuns: runs.length,
      pendingApprovals: runs.filter((r) => r.status === "WAITING_FOR_APPROVAL").length,
      failedRuns: runs.filter((r) => r.status === "FAILED").length,
    }),
    automations: deepFreeze(installed),
    recentRuns: deepFreeze(
      runs
        .slice(-10)
        .reverse()
        .map((r) => ({
          id: r.id,
          automationId: r.automationId,
          status: r.status,
          startedAt: r.startedAt,
          completedAt: r.completedAt ?? null,
        })),
    ),
    attention: deepFreeze(attention),
    recommendedNextStep: attention[0]?.title ?? "Monitor automation runs and resolve approval gates promptly.",
  });
}

export class AutomationCenterViewAdapter {
  translate(input = {}) {
    return buildAutomationCenterViewModel(input);
  }
}
