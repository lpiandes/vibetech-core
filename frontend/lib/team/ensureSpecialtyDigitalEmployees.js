/**
 * Ensure owner-added / specialty AI teammates appear on the Team roster even when
 * activation readiness was built from the industry package only.
 */
export function ensureSpecialtyDigitalEmployees({
  digitalEmployees = [],
  bosEmployees = [],
  businessId = null,
} = {}) {
  const existing = Array.isArray(digitalEmployees) ? [...digitalEmployees] : [];
  const byId = new Set(
    existing.map((entry) => String(entry?.employeeId ?? entry?.id ?? "")).filter(Boolean),
  );
  const base = businessId ? `/b/${encodeURIComponent(String(businessId))}` : "";

  for (const employee of Array.isArray(bosEmployees) ? bosEmployees : []) {
    const employeeId = String(employee?.employeeId ?? employee?.id ?? "").trim();
    if (!employeeId || byId.has(employeeId)) continue;

    const ownerAdded = Boolean(
      employee.ownerAdded
      || employee.customAiWork
      || employee.surfaceKind === "ai_teammate"
      || employeeId.startsWith("owner_emp_"),
    );
    if (!ownerAdded) continue;

    const specialtyHref = base ? `${base}/specialty/${encodeURIComponent(employeeId)}` : null;
    existing.push({
      id: employeeId,
      employeeId,
      name: String(employee.label ?? employee.name ?? employeeId),
      role: String(employee.purpose ?? employee.role ?? "Custom AI teammate"),
      responsibility: String(employee.purpose ?? employee.role ?? "Custom AI teammate"),
      description: employee.purpose ?? null,
      statusKey: "READY",
      status: "READY",
      statusLabel: "Ready to work",
      isReady: true,
      ownerAdded: true,
      customAiWork: true,
      canRunJobs: true,
      askAssisted: true,
      specialtyHref,
      detailHref: specialtyHref,
      runJobHref: specialtyHref,
      askHref: base
        ? `${base}/architect?employeeId=${encodeURIComponent(employeeId)}`
        : null,
      setupHref: null,
      workHref: null,
      openAssignmentCount: 0,
      blockerItems: [],
      blockerSummary: null,
      monitoring: [],
      currentHandling: null,
    });
    byId.add(employeeId);
  }

  return existing;
}
