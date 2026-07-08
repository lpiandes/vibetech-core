import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function roleDisplayLabel(presentation, roleKey) {
  return presentation?.roleLabels?.[roleKey] ?? null;
}

function resolveOperatingLabel({ emp, presentation, waitingOnOwner, assignedWork, assignedRuns }) {
  const workforceLabels = presentation?.workforceLabels ?? {};
  const statusLabels = {
    ACTIVE: workforceLabels.ready ?? "READY",
    READY: workforceLabels.ready ?? "READY",
    DEGRADED: presentation?.team?.statusLabels?.DEGRADED ?? "DEGRADED",
    CONFIGURING: presentation?.team?.statusLabels?.CONFIGURING ?? "CONFIGURING",
    UNAVAILABLE: presentation?.team?.statusLabels?.UNAVAILABLE ?? workforceLabels.blocked ?? "BLOCKED",
    BLOCKED: workforceLabels.blocked ?? "BLOCKED",
    NEEDS_CONFIGURATION: presentation?.team?.statusLabels?.CONFIGURING ?? "CONFIGURING",
    ...(presentation?.team?.statusLabels ?? {}),
  };

  if (waitingOnOwner) return workforceLabels.waitingOnYou ?? "WAITING ON YOU";

  const status = String(emp.status ?? "").toUpperCase();
  if (["DEGRADED", "CONFIGURING", "UNAVAILABLE", "BLOCKED", "NEEDS_CONFIGURATION"].includes(status)) {
    return statusLabels[status] ?? status;
  }

  if (assignedWork.length || assignedRuns.length) return workforceLabels.handling ?? "HANDLING";
  if (statusLabels[status]) return String(statusLabels[status]);
  return workforceLabels.ready ?? "READY";
}

/**
 * Digital workforce — only evidence-backed attribution per employee.
 * No workspace-wide totals attributed to individuals.
 */
export function presentDigitalWorkforce({
  employeeReadinessReport,
  workRuntime,
  automationRuntime,
  teamRuntime,
  presentation,
  nowISO,
  approvalRuntime,
} = {}) {
  const employees = safeArray(employeeReadinessReport?.employees);
  const workItems = safeArray(workRuntime?.getWorkItems?.());
  const runs = safeArray(automationRuntime?.getRuns?.());
  const pendingApprovals = safeArray(approvalRuntime?.getRequests?.()).filter((a) => a.status === "PENDING").length;

  const presented = employees.map((emp) => {
    const employeeId = String(emp.employeeId);
    const roleKey = String(emp.role ?? "");
    const roleLabel = roleDisplayLabel(presentation, roleKey) ?? String(emp.name ?? employeeId);

    const assignedWork = workItems.filter(
      (w) => String(w.assignedTo) === employeeId && w.status !== "completed" && w.status !== "cancelled",
    );

    const assignedRuns = runs.filter(
      (r) => r.status === "RUNNING" && String(r.definitionId ?? "").includes(employeeId.replace("pm_", "")),
    );

    const monitoring = [];
    if (assignedWork.length) {
      monitoring.push({
        label: presentation?.workforceLabels?.openAssignments ?? "Open assignments",
        count: assignedWork.length,
      });
    }
    if (assignedRuns.length) {
      monitoring.push({
        label: presentation?.workforceLabels?.activeAutomations ?? "Active automations",
        count: assignedRuns.length,
      });
    }

    const waitingOnOwner =
      (employeeId.includes("owner") || roleKey.includes("owner")) && pendingApprovals > 0;

    let operatingLabel = resolveOperatingLabel({
      emp,
      presentation,
      waitingOnOwner,
      assignedWork,
      assignedRuns,
    });

    const blockedCapability = safeArray(emp.blockers)
      .filter((b) => b.type === "capability" || b.type === "connection")
      .map((b) => b.message)[0] ?? null;

    return deepFreeze({
      id: employeeId,
      name: String(emp.name ?? employeeId),
      role: roleLabel,
      roleKey,
      responsibility: emp.responsibility ?? roleLabel,
      status: normalizeStatus(emp.status),
      operatingLabel,
      currentHandling: assignedWork[0]?.title ?? assignedWork[0]?.id ?? null,
      handledToday: deepFreeze([]),
      monitoring: deepFreeze(monitoring),
      watching: deepFreeze(monitoring),
      blockedCapability,
      needsFromOwner:
        waitingOnOwner
          ? `${pendingApprovals} owner approval${pendingApprovals === 1 ? "" : "s"} blocking continuation`
          : blockedCapability ?? (presentation?.workforceLabels?.nothingNeeded ?? "Nothing"),
      needsFromYou:
        waitingOnOwner
          ? `${pendingApprovals} owner approval${pendingApprovals === 1 ? "" : "s"} blocking continuation`
          : presentation?.workforceLabels?.nothingNeeded ?? "Nothing",
      enablingAction: blockedCapability ? "Connect production email or SMS in Connections" : null,
    });
  });

  void teamRuntime;
  void nowISO;

  const humanMembers = safeArray(teamRuntime?.getMembers?.()).filter((m) => m.memberType !== "digital_employee");

  return deepFreeze({
    digitalEmployees: presented,
    humanTeamSummary: deepFreeze({
      memberCount: humanMembers.length,
      activeWorkCount: workItems.filter((w) => w.status !== "completed" && w.status !== "cancelled").length,
      generatedAt: nowISO,
    }),
  });
}

function normalizeStatus(status) {
  const s = String(status ?? "READY").toUpperCase();
  if (
    ["ACTIVE", "READY", "WAITING", "BLOCKED", "NEEDS_CONFIGURATION", "CONFIGURING", "DEGRADED", "UNAVAILABLE"].includes(
      s,
    )
  ) {
    return s;
  }
  if (s === "INACTIVE") return "BLOCKED";
  return s;
}
