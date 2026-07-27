/**
 * Project every installed BOS AI teammate onto the Team roster.
 * Pack defaults, owner-added, and specialty AIs all must appear — not only owner_emp_*.
 */
import {
  resolveCustomAiPublicStatus,
  resolvePackTeammatePublicStatus,
} from "../../../backend/core/ai-builder/custom-ai/buildCustomAiReadyChecklist.js";

function isOwnerAdded(employee, employeeId) {
  return Boolean(
    employee?.ownerAdded
    || employee?.customAiWork
    || employee?.surfaceKind === "ai_teammate"
    || employeeId.startsWith("owner_emp_"),
  );
}

function projectEmployee(employee, { businessId = null, knowledgeCount = 0 } = {}) {
  const employeeId = String(employee?.employeeId ?? employee?.id ?? "").trim();
  if (!employeeId) return null;
  const base = businessId ? `/b/${encodeURIComponent(String(businessId))}` : "";
  const ownerAdded = isOwnerAdded(employee, employeeId);
  const packDefault = Boolean(employee.packDefault || employeeId.startsWith("emp_pack_"));
  // Every installed AI teammate gets a specialty workspace — not Architect.
  const specialtyHref = base
    ? `${base}/specialty/${encodeURIComponent(employeeId)}`
    : null;

  const publicStatus = ownerAdded
    ? resolveCustomAiPublicStatus(employee, {
      knowledgeCount,
      hasRunProve: false,
    })
    : packDefault
      ? resolvePackTeammatePublicStatus(employee, { knowledgeCount })
      : {
        statusKey: String(employee.statusKey ?? employee.status ?? "READY"),
        statusLabel: String(
          employee.statusLabel
          ?? "Ready to work",
        ),
        isReady: employee.isReady !== false,
      };

  return {
    id: employeeId,
    employeeId,
    name: String(employee.label ?? employee.name ?? employeeId),
    role: String(employee.purpose ?? employee.role ?? "AI teammate"),
    responsibility: String(employee.purpose ?? employee.role ?? "AI teammate"),
    description: employee.purpose ?? null,
    statusKey: publicStatus.statusKey,
    status: publicStatus.statusKey,
    statusLabel: publicStatus.statusLabel,
    isReady: publicStatus.isReady,
    ownerAdded,
    packDefault,
    customAiWork: ownerAdded,
    canRunJobs: true,
    askAssisted: true,
    specialtyHref,
    detailHref: specialtyHref,
    runJobHref: specialtyHref,
    // Architect Ask is an owner/admin OS action — not the teammate open path.
    askHref: specialtyHref,
    setupHref: null,
    workHref: null,
    openAssignmentCount: 0,
    blockerItems: [],
    blockerSummary: null,
    monitoring: [],
    currentHandling: null,
  };
}

/**
 * Ensure installed BOS employees (pack + specialty) appear on Team even when
 * readiness was built from an empty/outdated package roster.
 *
 * @param {{digitalEmployees?: Record<string, any>[], bosEmployees?: Record<string, any>[], businessId?: string | null, knowledgeCount?: number}} input
 */
export function ensureSpecialtyDigitalEmployees({
  digitalEmployees = [],
  bosEmployees = [],
  businessId = null,
  knowledgeCount = 0,
} = {}) {
  const existing = Array.isArray(digitalEmployees) ? [...digitalEmployees] : [];
  const byId = new Set(
    existing.map((entry) => String(entry?.employeeId ?? entry?.id ?? "")).filter(Boolean),
  );

  for (const employee of Array.isArray(bosEmployees) ? bosEmployees : []) {
    const employeeId = String(employee?.employeeId ?? employee?.id ?? "").trim();
    if (!employeeId || byId.has(employeeId)) continue;

    const projected = projectEmployee(employee, { businessId, knowledgeCount });
    if (!projected) continue;
    existing.push(projected);
    byId.add(employeeId);
  }

  return existing;
}

/** @deprecated use ensureSpecialtyDigitalEmployees — same behavior, clearer name */
export const ensureInstalledDigitalEmployees = ensureSpecialtyDigitalEmployees;
