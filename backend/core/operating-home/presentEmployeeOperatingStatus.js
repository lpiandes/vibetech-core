import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Map workforce readiness + assignment evidence to owner-facing status labels.
 * Never invents activity — only reflects recorded assignment/readiness state.
 */
export function presentEmployeeOperatingStatus(emp = {}) {
  const status = String(emp.status ?? "").toUpperCase();
  const operatingLabel = String(emp.operatingLabel ?? "").toUpperCase();
  const needsOwner = Boolean(
    emp.needsFromOwner
    && !/^nothing$/i.test(String(emp.needsFromOwner).trim()),
  );
  const hasAssignment = Boolean(emp.currentHandling)
    || Number(emp.monitoring?.[0]?.count ?? 0) > 0;

  if (needsOwner || /WAITING ON YOU|NEEDS APPROVAL|APPROVAL/.test(operatingLabel)) {
    return deepFreeze({ id: "needs_approval", label: "Needs your approval" });
  }
  if (["BLOCKED", "DEGRADED", "UNAVAILABLE"].includes(status) || /BLOCK/.test(operatingLabel)) {
    return deepFreeze({ id: "blocked", label: "Blocked" });
  }
  if (
    ["NEEDS_CONFIGURATION", "CONFIGURING"].includes(status)
    || /CONFIG|SETUP/.test(operatingLabel)
    || Boolean(emp.blockedCapability)
  ) {
    return deepFreeze({ id: "needs_setup", label: "Getting ready" });
  }
  if (status === "WAITING" || /WAIT/.test(operatingLabel)) {
    return deepFreeze({ id: "waiting", label: "Waiting" });
  }
  if (hasAssignment || status === "ACTIVE" || /HANDLING|WORKING/.test(operatingLabel)) {
    return deepFreeze({ id: "working", label: "Working now" });
  }
  if (status === "READY") {
    return deepFreeze({ id: "idle", label: "Standing by" });
  }
  return deepFreeze({ id: "idle", label: "Standing by" });
}
