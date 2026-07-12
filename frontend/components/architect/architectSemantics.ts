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
  { id: "how_work_flows", label: "How work flows", viewKey: "workflows" },
  { id: "employees", label: "Your team", viewKey: "digitalWorkforce" },
  { id: "roles", label: "Who sees what", viewKey: "rolesAccess" },
  { id: "navigation", label: "Workspaces", viewKey: "navigation" },
  { id: "portal", label: "Home screens", viewKey: "dashboard" },
  { id: "knowledge", label: "Knowledge", viewKey: "knowledge" },
  { id: "integrations", label: "Connections", viewKey: "integrations" },
  { id: "campaigns", label: "Campaigns", viewKey: "campaigns" },
  { id: "reports", label: "Reports", viewKey: "reports" },
  { id: "readiness", label: "Readiness", viewKey: "readiness" },
  { id: "gaps", label: "Still needed", viewKey: "capabilityGaps" },
] as const;

export const ARCHITECT_RESEARCH_CARD_KEYS = [
  { key: "locations", label: "Locations", fields: ["locations"] },
  { key: "services", label: "Services", fields: ["services"] },
  { key: "team", label: "Team", fields: ["teamMembers", "teamHints", "team"] },
  { key: "contact", label: "Contact methods", fields: ["contactMethods"] },
  { key: "scheduling", label: "Scheduling", fields: ["schedulingHints", "scheduling"] },
  { key: "faqs", label: "FAQs", fields: ["faqs"] },
] as const;

export const ARCHITECT_INSTALL_STAGES = [
  { id: "business", label: "Creating your business" },
  { id: "modules", label: "Setting up workspaces" },
  { id: "workforce", label: "Preparing your team" },
  { id: "permissions", label: "Configuring access" },
  { id: "dashboards", label: "Building home screens" },
  { id: "knowledge", label: "Preparing knowledge" },
  { id: "finalizing", label: "Finishing touches" },
] as const;

export const ARCHITECT_ASSEMBLY_STAGES = [
  { id: "navigation", label: "Laying out workspaces", viewKey: "navigation" },
  { id: "workforce", label: "Assembling your team", viewKey: "digitalWorkforce" },
  { id: "workflows", label: "Connecting how work flows", viewKey: "workflows" },
  { id: "dashboard", label: "Designing home screens", viewKey: "dashboard" },
  { id: "integrations", label: "Planning connections", viewKey: "integrations" },
  { id: "knowledge", label: "Organizing knowledge", viewKey: "knowledge" },
] as const;

export const ARCHITECT_PREVIEW_ROLES = [
  { id: "OWNER", label: "Owner" },
  { id: "MANAGER", label: "Manager" },
  { id: "EMPLOYEE", label: "Employee" },
] as const;

export const ARCHITECT_COMPLETION_ACTIONS = [
  { id: "open_portal", label: "Open your business" },
  { id: "invite", label: "Invite your team" },
  { id: "improve", label: "Keep improving" },
] as const;

export const ARCHITECT_DNA_RINGS = [
  { id: "company", label: "Company", keys: ["businessName", "description", "industry", "locations"] },
  { id: "work", label: "Work", keys: ["services", "repetitiveWork", "salesProcess", "scheduling"] },
  { id: "people", label: "People", keys: ["roles", "teamSize", "customerTypes", "ownerOversight"] },
  { id: "systems", label: "Systems", keys: ["currentSystems", "channels", "integrationNeeds", "software"] },
  { id: "outcomes", label: "Outcomes", keys: ["goals", "painPoints", "reportingNeeds", "complianceConcerns"] },
] as const;

export const UNDERSTANDING_FIELDS = [
  { id: "identity", label: "Who you are", keys: ["businessName", "description", "industry"] },
  { id: "services", label: "What you offer", keys: ["services"] },
  { id: "customers", label: "Who you serve", keys: ["customerTypes"] },
  { id: "team", label: "Your people", keys: ["roles", "teamSize"] },
  { id: "systems", label: "Tools you use", keys: ["currentSystems", "channels", "software"] },
  { id: "goals", label: "Where you're headed", keys: ["goals", "painPoints"] },
] as const;

export const UPLOAD_TYPE_HINTS: Record<string, { label: string; plannedUse: string }> = {
  pdf: { label: "PDF document", plannedUse: "Policy and handbook knowledge" },
  docx: { label: "Word document", plannedUse: "Process and handbook knowledge" },
  txt: { label: "Text file", plannedUse: "Notes and knowledge" },
  csv: { label: "Spreadsheet export", plannedUse: "Customer list review — nothing imported until you confirm" },
  xlsx: { label: "Excel spreadsheet", plannedUse: "Operations data for review only" },
  xls: { label: "Excel spreadsheet", plannedUse: "Operations data for review only" },
  policy: { label: "Policy document", plannedUse: "Compliance knowledge" },
  handbook: { label: "Employee handbook", plannedUse: "Team knowledge" },
  sop: { label: "Process guide", plannedUse: "Workflow knowledge" },
  crm: { label: "Customer export", plannedUse: "Customer data review — nothing imported until you confirm" },
  default: { label: "Document", plannedUse: "Evidence for Architect" },
};

export const HUMAN_COPY = {
  prepareLaunch: "Prepare to launch",
  previewPortal: "Preview your portal",
  launchReadiness: "Launch readiness",
  approveLaunch: "Approve and launch",
  recordApproval: "Confirm approval",
  approved: "Approved",
  installing: "Creating your operating system…",
  launchComplete: "Your business is running",
  rethink: "Architect is thinking",
  shareWebsite: "Share a website",
  addDocuments: "Add documents",
  proposePlan: "Show me the plan",
} as const;

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

function valuesFromFields(source: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    const raw = source[field];
    if (Array.isArray(raw) && raw.length) return raw.map(String);
    if (raw != null && raw !== "") return [String(raw)];
  }
  return [];
}

export function researchFindingCards(findings: Record<string, unknown> | null | undefined) {
  if (!findings) return [];
  return ARCHITECT_RESEARCH_CARD_KEYS.map((entry) => {
    const values = valuesFromFields(findings, entry.fields);
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
  return ARCHITECT_INSTALL_STAGES.map((stage, index) => {
    const state =
      status === "installed" || index < activeIndex
        ? "done"
        : status === "installing" && index === activeIndex
          ? "active"
          : status === "failed" && index === activeIndex
            ? "failed"
            : "pending";
    return {
      ...stage,
      state,
      stateLabel: humanInstallState(state),
    };
  });
}

export function humanInstallState(state: string) {
  switch (state) {
    case "done": return "Complete";
    case "active": return "In progress";
    case "failed": return "Needs attention";
    default: return "Waiting";
  }
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
    label: session?.progress?.label ?? "Getting to know your business",
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
  const risk = String(impact.risk ?? "medium").toLowerCase();
  const riskLabel = risk.includes("high")
    ? "Higher impact"
    : risk.includes("low")
      ? "Low impact"
      : "Moderate impact";
  return {
    explanation: impact.explanation ?? "Architect proposes a change to your business system.",
    risk: impact.risk ?? "medium",
    riskLabel,
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
      ? `/b/${context.businessId}/architect`
      : "/architect",
  };
}

export function humanizeToken(value: unknown) {
  return String(value ?? "").replace(/_/g, " ").trim();
}

function hasSummaryValue(summary: Record<string, unknown>, keys: readonly string[]) {
  return keys.some((key) => {
    const value = summary[key];
    if (Array.isArray(value)) return value.length > 0;
    return value != null && String(value).trim() !== "";
  });
}

export function businessUnderstandingCards(summary: Record<string, unknown> | null | undefined) {
  const source = summary ?? {};
  return UNDERSTANDING_FIELDS.map((field) => {
    const found = hasSummaryValue(source, field.keys);
    const snippets: string[] = [];
    for (const key of field.keys) {
      const value = source[key];
      if (Array.isArray(value) && value.length) snippets.push(...value.slice(0, 3).map(String));
      else if (value != null && String(value).trim()) snippets.push(String(value));
    }
    return {
      id: field.id,
      label: field.label,
      status: found ? "found" : "empty",
      snippets: snippets.slice(0, 4),
    };
  });
}

export function businessDnaPortrait(summary: Record<string, unknown> | null | undefined) {
  const source = summary ?? {};
  const rings = ARCHITECT_DNA_RINGS.map((ring) => {
    const filled = ring.keys.filter((key) => hasSummaryValue(source, [key])).length;
    const total = ring.keys.length;
    const ratio = total ? filled / total : 0;
    return {
      id: ring.id,
      label: ring.label,
      filled,
      total,
      ratio,
      status: ratio >= 0.6 ? "strong" : ratio > 0 ? "forming" : "empty",
    };
  });
  const overall = rings.reduce((sum, ring) => sum + ring.ratio, 0) / Math.max(rings.length, 1);
  return {
    rings,
    overall,
    label: overall >= 0.7 ? "Business DNA coming into focus" : overall > 0.25 ? "Business DNA forming" : "Beginning to understand your business",
  };
}

export function reasoningMoments({
  nextQuestion,
  proposal,
  assumptions = [],
  recommendations = [],
  changeImpact = null,
}: {
  nextQuestion?: { why?: string; text?: string } | null;
  proposal?: { explanation?: { summary?: string; sections?: Array<{ title?: string; body?: string }> } } | null;
  assumptions?: Array<{ text?: string; label?: string } | string>;
  recommendations?: Array<{ label?: string; why?: string }>;
  changeImpact?: { explanation?: string } | null;
}) {
  const moments: Array<{ id: string; title: string; body: string }> = [];
  if (nextQuestion?.why) {
    moments.push({ id: "why_question", title: "Why this question", body: String(nextQuestion.why) });
  }
  if (proposal?.explanation?.summary) {
    moments.push({ id: "proposal_summary", title: "What Architect understands", body: String(proposal.explanation.summary) });
  }
  for (const section of proposal?.explanation?.sections ?? []) {
    if (section?.body) {
      moments.push({
        id: `section_${section.title ?? moments.length}`,
        title: String(section.title ?? "Insight"),
        body: String(section.body),
      });
    }
  }
  if (changeImpact?.explanation) {
    moments.push({ id: "change", title: "Proposed change", body: String(changeImpact.explanation) });
  }
  for (const recommendation of recommendations.slice(0, 3)) {
    if (recommendation?.why || recommendation?.label) {
      moments.push({
        id: `rec_${recommendation.label ?? moments.length}`,
        title: String(recommendation.label ?? "Recommendation"),
        body: String(recommendation.why ?? recommendation.label),
      });
    }
  }
  for (const assumption of assumptions.slice(0, 2)) {
    const text = typeof assumption === "string" ? assumption : assumption.text ?? assumption.label;
    if (text) moments.push({ id: `assume_${moments.length}`, title: "Assumption", body: String(text) });
  }
  return moments.slice(0, 6);
}

export function assemblyStagesFromProposal(proposal: { views?: Record<string, unknown> } | null | undefined) {
  const views = proposal?.views ?? {};
  return ARCHITECT_ASSEMBLY_STAGES.map((stage, index) => {
    const view = (views as Record<string, any>)[stage.viewKey];
    const count = Array.isArray(view?.items) ? view.items.length : view ? 1 : 0;
    return {
      ...stage,
      ready: Boolean(view),
      count,
      order: index,
    };
  });
}

export function aiEmployeePersonas(source: {
  portalWorkforce?: Array<Record<string, unknown>>;
  proposalWorkforce?: { items?: Array<Record<string, unknown>> } | null;
} = {}) {
  const fromPortal = Array.isArray(source.portalWorkforce) ? source.portalWorkforce : [];
  const fromProposal = Array.isArray(source.proposalWorkforce?.items) ? source.proposalWorkforce!.items! : [];
  const rows = fromPortal.length ? fromPortal : fromProposal;
  return rows.map((entry, index) => {
    const name = String(entry.name ?? entry.label ?? `Team member ${index + 1}`);
    return {
      id: String(entry.id ?? entry.employeeId ?? `ai_${index}`),
      name,
      purpose: String(entry.purpose ?? entry.role ?? "Supports approved work"),
      responsibilities: Array.isArray(entry.responsibilities)
        ? entry.responsibilities.map(String)
        : [],
      approvals: Array.isArray(entry.approvals)
        ? entry.approvals.map(String)
        : entry.approvals
          ? [String(entry.approvals)]
          : ["Human approval before important actions"],
      knowledge: Array.isArray(entry.knowledgeNeeded)
        ? entry.knowledgeNeeded.map(String)
        : Array.isArray(entry.knowledge)
          ? entry.knowledge.map(String)
          : [],
      readiness: humanizeToken(entry.readiness ?? "ready when knowledge is present"),
    };
  });
}

export function executiveBriefing(proposal: {
  businessName?: string;
  views?: Record<string, any>;
  explanation?: { summary?: string };
} | null | undefined) {
  const views = proposal?.views ?? {};
  const highlights = [
    { id: "workspaces", label: "Workspaces", value: views.navigation?.items?.length ?? 0 },
    { id: "team", label: "Team roles", value: views.digitalWorkforce?.items?.length ?? 0 },
    { id: "homes", label: "Home screens", value: views.dashboard?.items?.length ?? views.dashboard?.cards?.length ?? 0 },
    { id: "connections", label: "Connections planned", value: views.integrations?.items?.length ?? 0 },
  ];
  return {
    headline: "Your business is running",
    businessName: proposal?.businessName ?? "Your business",
    summary: proposal?.explanation?.summary
      ?? "Architect installed a working operating system tailored to how you work.",
    highlights,
    actions: ARCHITECT_COMPLETION_ACTIONS,
  };
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
