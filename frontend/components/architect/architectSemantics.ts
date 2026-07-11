/**
 * Pure Architect UX helpers — no backend mutation.
 * Keeps presentation labels and staged install copy out of React trees for tests.
 */

export const ARCHITECT_HOME_ACTIONS = [
  "continue_session",
  "build_new",
  "browse_examples",
  "browse_blueprints",
  "learn_how",
] as const;

export const ARCHITECT_PROPOSAL_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "business", label: "Business", viewKey: "overview" },
  { id: "departments", label: "Departments", viewKey: "workflows" },
  { id: "employees", label: "Employees", viewKey: "digitalWorkforce" },
  { id: "navigation", label: "Navigation", viewKey: "navigation" },
  { id: "portal", label: "Portal", viewKey: "dashboard" },
  { id: "knowledge", label: "Knowledge", viewKey: "knowledge" },
  { id: "integrations", label: "Integrations", viewKey: "integrations" },
  { id: "reports", label: "Reports", viewKey: "reports" },
  { id: "kpis", label: "KPIs", viewKey: "dashboard" },
  { id: "gaps", label: "Missing Capabilities", viewKey: "capabilityGaps" },
] as const;

export const ARCHITECT_RESEARCH_CARD_KEYS = [
  { key: "locations", label: "Locations", field: "locations" },
  { key: "services", label: "Services", field: "services" },
  { key: "team", label: "Team", field: "teamHints" },
  { key: "contact", label: "Contact methods", field: "contactMethods" },
  { key: "scheduling", label: "Scheduling", field: "schedulingHints" },
  { key: "faqs", label: "FAQs", field: "faqs" },
] as const;

export const ARCHITECT_INSTALL_STAGES = [
  { id: "business", label: "Creating Business" },
  { id: "modules", label: "Installing Modules" },
  { id: "workforce", label: "Preparing Workforce" },
  { id: "permissions", label: "Configuring Permissions" },
  { id: "dashboards", label: "Building Dashboards" },
  { id: "knowledge", label: "Preparing Knowledge" },
  { id: "finalizing", label: "Finalizing" },
] as const;

export const ARCHITECT_PREVIEW_ROLES = [
  { id: "OWNER", label: "Owner" },
  { id: "MANAGER", label: "Manager" },
  { id: "EMPLOYEE", label: "Employee" },
] as const;

export const ARCHITECT_COMPLETION_ACTIONS = [
  { id: "open_portal", label: "Open Business Portal" },
  { id: "invite", label: "Invite Employees" },
  { id: "improve", label: "Continue Improving" },
] as const;

export const UPLOAD_TYPE_HINTS: Record<string, { label: string; plannedUse: string }> = {
  pdf: { label: "PDF document", plannedUse: "Policy / handbook knowledge" },
  docx: { label: "Word document", plannedUse: "SOP / handbook knowledge" },
  txt: { label: "Text file", plannedUse: "Notes & knowledge" },
  csv: { label: "CSV export", plannedUse: "CRM / list import (non-mutating until confirmed)" },
  xlsx: { label: "Excel spreadsheet", plannedUse: "Operations data (review only)" },
  xls: { label: "Excel spreadsheet", plannedUse: "Operations data (review only)" },
  policy: { label: "Policy document", plannedUse: "Compliance knowledge" },
  handbook: { label: "Employee handbook", plannedUse: "Workforce knowledge" },
  sop: { label: "SOP", plannedUse: "Workflow knowledge" },
  crm: { label: "CRM export", plannedUse: "Customer data review (non-mutating)" },
  default: { label: "Document", plannedUse: "Evidence for Architect" },
};

export function detectUploadHint(filename: string, classification?: string) {
  const lower = `${filename} ${classification ?? ""}`.toLowerCase();
  if (/handbook/.test(lower)) return UPLOAD_TYPE_HINTS.handbook;
  if (/policy|policies/.test(lower)) return UPLOAD_TYPE_HINTS.policy;
  if (/\bsop\b|standard operating/.test(lower)) return UPLOAD_TYPE_HINTS.sop;
  if (/crm|export/.test(lower)) return UPLOAD_TYPE_HINTS.crm;
  if (/\.pdf$/i.test(filename) || classification === "pdf") return UPLOAD_TYPE_HINTS.pdf;
  if (/\.docx?$/i.test(filename)) return UPLOAD_TYPE_HINTS.docx;
  if (/\.txt$/i.test(filename)) return UPLOAD_TYPE_HINTS.txt;
  if (/\.csv$/i.test(filename) || classification === "csv") return UPLOAD_TYPE_HINTS.csv;
  if (/\.xlsx?$/i.test(filename)) return UPLOAD_TYPE_HINTS.xlsx;
  return UPLOAD_TYPE_HINTS.default;
}

export function researchFindingCards(findings: Record<string, unknown> | null | undefined) {
  if (!findings) return [];
  return ARCHITECT_RESEARCH_CARD_KEYS.map((entry) => {
    const raw = findings[entry.field];
    const values = Array.isArray(raw)
      ? raw.map(String)
      : raw == null || raw === ""
        ? []
        : [String(raw)];
    return {
      id: entry.key,
      label: entry.label,
      values,
      status: values.length ? "found" : "empty",
      confidence: String(findings.confidence ?? "medium"),
    };
  });
}

export function proposalSectionView(
  sectionId: string,
  proposal: { views?: Record<string, unknown> } | null | undefined,
) {
  const section = ARCHITECT_PROPOSAL_SECTIONS.find((entry) => entry.id === sectionId)
    ?? ARCHITECT_PROPOSAL_SECTIONS[0];
  const viewKey = "viewKey" in section ? section.viewKey : "overview";
  const views = proposal?.views ?? {};
  return {
    section,
    view: (views as Record<string, any>)[viewKey as string] ?? null,
  };
}

export function installStageProgress(activeIndex: number, status: string) {
  return ARCHITECT_INSTALL_STAGES.map((stage, index) => ({
    ...stage,
    state:
      status === "installed" || index < activeIndex
        ? "done"
        : status === "installing" && index === activeIndex
          ? "active"
          : status === "failed" && index === activeIndex
            ? "failed"
            : "pending",
  }));
}

export function confidenceLabel(value: unknown) {
  const n = typeof value === "number" ? value : null;
  if (n != null) {
    if (n >= 0.8) return { label: "High confidence", tone: "success" as const };
    if (n >= 0.5) return { label: "Medium confidence", tone: "warning" as const };
    return { label: "Low confidence", tone: "warning" as const };
  }
  const text = String(value ?? "medium").toLowerCase();
  if (text.includes("high")) return { label: "High confidence", tone: "success" as const };
  if (text.includes("low")) return { label: "Low confidence", tone: "warning" as const };
  return { label: "Medium confidence", tone: "accent" as const };
}

export function discoveryProgress(session: {
  progress?: { percent?: number; label?: string };
  answers?: unknown[];
  questions?: unknown[];
} | null) {
  const percent = Math.max(0, Math.min(100, Number(session?.progress?.percent ?? 0)));
  const answered = Array.isArray(session?.answers) ? session!.answers!.length : 0;
  const remaining = Array.isArray(session?.questions) ? session!.questions!.length : 0;
  return {
    percent,
    label: session?.progress?.label ?? "Getting started",
    answered,
    remaining,
  };
}

export function changeImpactCopy(impact: {
  explanation?: string;
  risk?: string;
  requiresApproval?: boolean;
} | null) {
  if (!impact) return null;
  return {
    explanation: impact.explanation ?? "Architect proposes a change to your Business OS.",
    risk: impact.risk ?? "medium",
    requiresApproval: impact.requiresApproval !== false,
    headline: "Proposed change — nothing installed yet",
  };
}

export function askVibetechContinuity(context: {
  businessId?: string | null;
  hasDna?: boolean;
  hasInstalledOs?: boolean;
  hasHistory?: boolean;
}) {
  return {
    neverRestartDiscovery: true,
    mode: "continuous_improvement",
    knows: {
      businessDna: Boolean(context.hasDna),
      installedBusinessOs: Boolean(context.hasInstalledOs),
      conversationHistory: Boolean(context.hasHistory),
      previousInstalls: Boolean(context.hasInstalledOs),
    },
    entryLabel: "Ask VIBETech",
    openPath: context.businessId
      ? `/api/businesses/${context.businessId}/builder/improve`
      : "/architect",
  };
}

export function humanizeToken(value: unknown) {
  return String(value ?? "").replace(/_/g, " ").trim();
}

export function architectRoutes(sessionId?: string) {
  const base = sessionId ? `/architect/${sessionId}` : "/architect";
  return {
    home: "/architect",
    session: base,
    dryRun: sessionId ? `/architect/${sessionId}/dry-run` : "/architect",
    install: sessionId ? `/architect/${sessionId}/install` : "/architect",
    legacyBuilderHome: "/builder",
  };
}
