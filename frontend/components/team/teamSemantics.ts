export type TeamDigitalEmployee = {
  employeeId?: string;
  id?: string;
  name?: string;
  role?: string;
  responsibility?: string;
  description?: string | null;
  statusKey?: string;
  status?: string;
  statusLabel?: string;
  isReady?: boolean;
  ownerAdded?: boolean;
  customAiWork?: boolean;
  assistedMode?: boolean;
  askAssisted?: boolean;
  canRunJobs?: boolean;
  specialtyHref?: string | null;
  detailHref?: string | null;
  askHref?: string | null;
  runJobHref?: string | null;
  blockerItems?: string[];
  blockerSummary?: string | null;
  setupHref?: string | null;
  workHref?: string | null;
  openAssignmentCount?: number;
  monitoring?: Array<{ label: string; count: number }>;
  currentHandling?: string | null;
  needsFromOwner?: string | null;
  partyName?: string | null;
  primaryParty?: { displayName?: string | null } | null;
};

export type PlatformMember = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
};

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function isEmployeeReady(statusKey: string) {
  const status = String(statusKey ?? "").toUpperCase();
  return status === "READY" || status === "ACTIVE";
}

export function deriveTeamCounts(members: unknown, digitalEmployees: unknown) {
  const humanRows = safeArray<PlatformMember>(members);
  const digitalRows = safeArray<TeamDigitalEmployee>(digitalEmployees);

  let ready = 0;
  let needsSetup = 0;

  for (const employee of digitalRows) {
    const statusKey = String(employee.statusKey ?? employee.status ?? "").toUpperCase();
    if (employee.isReady === true || isEmployeeReady(statusKey)) {
      ready += 1;
    } else {
      needsSetup += 1;
    }
  }

  return {
    humanTeam: humanRows.length,
    digitalEmployees: digitalRows.length,
    ready,
    needsSetup,
  };
}

export function employeeStatusTone(employee: TeamDigitalEmployee): "success" | "warning" | "neutral" {
  const statusKey = String(employee.statusKey ?? employee.status ?? "").toUpperCase();
  if (employee.isReady === true || isEmployeeReady(statusKey)) return "success";
  if (statusKey === "BLOCKED" || statusKey === "UNAVAILABLE") return "warning";
  return "warning";
}

export function primaryEmployeeAction(employee: TeamDigitalEmployee): { label: string; href: string } | null {
  if (employee.isReady === false && employee.setupHref) {
    return { label: "Finish setup", href: employee.setupHref };
  }
  if (employee.specialtyHref) {
    return { label: "Open specialty page", href: employee.specialtyHref };
  }
  if ((employee.ownerAdded || employee.customAiWork || employee.canRunJobs) && employee.detailHref) {
    return { label: "Open specialty page", href: employee.detailHref };
  }
  if (employee.askAssisted && employee.askHref) {
    return { label: "Ask about this responsibility", href: employee.askHref };
  }
  if (employee.detailHref) {
    return { label: "View contract", href: employee.detailHref };
  }
  if ((employee.openAssignmentCount ?? 0) > 0 && employee.workHref) {
    return { label: "View work", href: employee.workHref };
  }
  return null;
}

export function monitoringSummary(employee: TeamDigitalEmployee) {
  return safeArray<{ label: string; count: number }>(employee.monitoring).filter((item) => Number(item.count ?? 0) > 0);
}
