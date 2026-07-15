/**
 * Merge installed configuration + specification employees for Team readiness.
 * Owner-added / specialty AIs often live on the specification while thin config
 * still has package employees — Team must union them, not take only config.
 */
export function mergeBosEmployeesForTeam({
  configuration = null,
  specification = null,
} = {}) {
  const byId = new Map();

  const push = (entry) => {
    if (!entry || typeof entry !== "object") return;
    const id = String(entry.employeeId ?? entry.id ?? "").trim();
    if (!id) return;
    const prev = byId.get(id) ?? {};
    byId.set(id, {
      ...prev,
      ...entry,
      employeeId: id,
      id,
      label: entry.label ?? entry.name ?? prev.label ?? prev.name ?? id,
      ownerAdded: Boolean(
        entry.ownerAdded
        || prev.ownerAdded
        || entry.customAiWork
        || prev.customAiWork
        || id.startsWith("owner_emp_")
        || entry.surfaceKind === "ai_teammate"
        || prev.surfaceKind === "ai_teammate",
      ),
    });
  };

  for (const entry of Array.isArray(configuration?.employees) ? configuration.employees : []) {
    push(entry);
  }
  for (const entry of Array.isArray(specification?.employeeDefinitions)
    ? specification.employeeDefinitions
    : []) {
    push(entry);
  }
  for (const entry of Array.isArray(specification?.employees) ? specification.employees : []) {
    push(entry);
  }

  const modules = [
    ...(Array.isArray(configuration?.modules) ? configuration.modules : []),
    ...(Array.isArray(specification?.modules) ? specification.modules : []),
  ];
  for (const module of modules) {
    const moduleId = String(module?.moduleId ?? module?.id ?? "");
    const isSpecialtyAi = module?.surfaceKind === "ai_teammate"
      || moduleId.startsWith("specialty_ai_");
    if (!isSpecialtyAi) continue;
    const employeeId = String(
      module.employeeId
      ?? (moduleId.startsWith("specialty_ai_") ? moduleId.slice("specialty_ai_".length) : ""),
    ).trim();
    if (!employeeId) continue;
    push({
      employeeId,
      label: module.label ?? module.name ?? employeeId,
      purpose: module.purpose ?? null,
      ownerAdded: true,
      surfaceKind: "ai_teammate",
      capabilities: ["custom_ai_work"],
      readinessState: "custom_ai_ready",
    });
  }

  return [...byId.values()];
}
