import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Universal workspace attention signals composed from package readiness facts.
 */
export function composeWorkspaceAttentionSignals({
  readinessReport,
  connectedSystemsSnapshot,
  employeeReadinessReport,
  automationRuntime,
  connectionDependencyProjection,
  integrationPlatform,
} = {}) {
  const signals = [];

  for (const conn of safeArray(connectedSystemsSnapshot?.connections).filter(
    (c) => c.requirementLevel === "required" && c.status === "NOT_CONNECTED",
  )) {
    signals.push({
      id: `signal_conn_${conn.id}`,
      title: `Required connection missing: ${conn.displayName}`,
      detail: conn.purpose || "Connect this system to unblock operations.",
      priority: "immediate",
      source: "connections",
    });
  }

  for (const conn of safeArray(connectedSystemsSnapshot?.connections).filter(
    (c) => c.health?.level === "ERROR" || c.health?.level === "NEEDS_ATTENTION",
  )) {
    if (conn.requirementLevel !== "required" && conn.status === "NOT_CONNECTED") continue;
    signals.push({
      id: `signal_conn_health_${conn.id}`,
      title: `Connection needs attention: ${conn.displayName}`,
      detail: safeArray(conn.health?.reasons).join("; ") || conn.health?.level,
      priority: conn.health?.level === "ERROR" ? "immediate" : "soon",
      source: "connections",
    });
  }

  for (const dep of safeArray(connectionDependencyProjection?.connections).filter((c) => !c.isConnected && c.blockedWithout?.employees?.length)) {
    signals.push({
      id: `signal_dep_${dep.connectionType}`,
      title: `${dep.displayName} blocks ${dep.blockedWithout.employees.length} digital employee(s)`,
      detail: dep.blockedWithout.employees.map((e) => e.name ?? e.id).join(", "),
      priority: dep.requirementLevel === "required" ? "immediate" : "soon",
      source: "connections",
    });
  }

  for (const req of safeArray(readinessReport?.missing?.knowledgeRequirements)) {
    signals.push({
      id: `signal_knowledge_${req.categoryId ?? req.id}`,
      title: `Knowledge required: ${req.categoryId ?? req.id}`,
      detail: String(req.description ?? ""),
      priority: "soon",
      source: "knowledge",
    });
  }

  for (const employee of safeArray(employeeReadinessReport?.employees).filter((e) => e.status !== "ACTIVE")) {
    signals.push({
      id: `signal_employee_${employee.employeeId}`,
      title: `Digital employee blocked: ${employee.name}`,
      detail: safeArray(employee.blockers).map((b) => b.message).join("; ") || employee.status,
      priority: "soon",
      source: "team",
    });
  }

  const runs = safeArray(automationRuntime?.getRuns?.());
  const pendingApprovals = runs.filter((r) => r.status === "WAITING_FOR_APPROVAL");
  if (pendingApprovals.length) {
    signals.push({
      id: "signal_pending_approvals",
      title: `${pendingApprovals.length} automation(s) awaiting approval`,
      detail: "Review approval gates in Automations or Engagement history.",
      priority: "immediate",
      source: "automations",
    });
  }

  const failedRuns = runs.filter((r) => r.status === "FAILED");
  if (failedRuns.length) {
    signals.push({
      id: "signal_failed_automations",
      title: `${failedRuns.length} automation run(s) failed`,
      detail: "Inspect automation run history for remediation.",
      priority: "immediate",
      source: "automations",
    });
  }

  const failedActions = safeArray(integrationPlatform?.connectionRuntime?.getActionHistory?.()).filter(
    (a) => a.status === "FAILED",
  );
  if (failedActions.length) {
    signals.push({
      id: "signal_external_action_failed",
      title: `${failedActions.length} external action(s) failed`,
      detail: "Review connection health and retry blocked actions.",
      priority: "immediate",
      source: "integrations",
    });
  }
  if (readinessReport && readinessReport.readinessStatus !== "READY") {
    signals.push({
      id: "signal_package_readiness",
      title: `Package readiness: ${readinessReport.readinessStatus}`,
      detail: "Complete setup, knowledge, and connections to reach operational readiness.",
      priority: "soon",
      source: "setup",
    });
  }

  return deepFreeze(signals);
}

export function mergeMissionControlAttention({ missionControlViewModel, workspaceSignals } = {}) {
  const vm = missionControlViewModel ?? {};
  const existingCards = safeArray(vm.cards);
  const signalCards = safeArray(workspaceSignals).map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.detail,
    priority: s.priority,
    badge: "attention",
    actions: [],
    metadata: { source: s.source },
  }));

  return deepFreeze({
    ...vm,
    cards: deepFreeze([...signalCards, ...existingCards]),
    workspaceSignals: deepFreeze(workspaceSignals),
  });
}
