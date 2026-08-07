/**
 * Pure Architect UX helpers — no backend mutation.
 * Keeps presentation labels and staged install copy out of React trees for tests.
 */

function isUsableBusinessName(value: string | null | undefined): boolean {
  const text = String(value ?? "").trim();
  if (text.length < 2) return false;
  const lower = text.toLowerCase();
  if (["ok", "okay", "yes", "y", "no", "n", "idk", "n/a", "na", "none", "test", "asdf"].includes(lower)) {
    return false;
  }
  if (/^(ok|okay|yes|no)([!.]?)$/i.test(text)) return false;
  return true;
}

function resolveBusinessDisplayName(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (isUsableBusinessName(candidate)) return String(candidate).trim();
  }
  return "Your business";
}

export const ARCHITECT_HOME_ACTIONS = [
  "continue_session",
  "build_new",
  "browse_examples",
  "browse_blueprints",
  "learn_how",
] as const;

export const ARCHITECT_PROPOSAL_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "employees", label: "Digital Workforce", viewKey: "digitalWorkforce" },
  { id: "navigation", label: "Workspaces", viewKey: "navigation" },
  { id: "business", label: "Business", viewKey: "overview" },
  { id: "how_work_flows", label: "How work flows", viewKey: "workflows" },
  { id: "roles", label: "Who sees what", viewKey: "rolesAccess" },
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
  { id: "core", label: "Setting up workspaces" },
  { id: "blueprint", label: "Applying your industry plan" },
  { id: "capabilities", label: "Preparing what VIBETech can handle" },
  { id: "employees", label: "Preparing operating responsibilities" },
  { id: "knowledge", label: "Organizing business knowledge" },
  { id: "integrations", label: "Preparing connections" },
  { id: "finalizing", label: "Opening your business" },
] as const;

export const ARCHITECT_ASSEMBLY_STAGES = [
  { id: "navigation", label: "Laying out workspaces", viewKey: "navigation" },
  { id: "workforce", label: "Preparing your AI team", viewKey: "digitalWorkforce" },
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
] as const;

export const ARCHITECT_DNA_RINGS = [
  { id: "company", label: "Company", keys: ["businessName", "description", "industry", "locations"] },
  { id: "work", label: "Work", keys: ["services", "repetitiveWork", "salesProcess", "scheduling"] },
  { id: "people", label: "Customers & roles", keys: ["roles", "teamSize", "customerTypes", "ownerOversight"] },
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
  default: { label: "Document", plannedUse: "Evidence for your recommendation" },
};

export const HUMAN_COPY = {
  prepareLaunch: "Check readiness",
  previewPortal: "Review before you approve",
  launchReadiness: "Readiness check",
  approveLaunch: "Approve",
  recordApproval: "Confirm approval",
  approved: "Approved",
  installing: "Building your workspace…",
  launchComplete: "Open your business",
  rethink: "VIBETech is thinking",
  shareWebsite: "Share a website",
  addDocuments: "Add documents",
  proposePlan: "Show me the recommendation",
  reviewContinue: "Looks good — continue",
  reviewApply: "Looks good — apply",
  requestChanges: "Tell us what we should change",
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

const INSTALL_OP_STAGE: Record<string, string> = {
  INSTALL_MODULE: "core",
  INSTALL_NAVIGATION: "core",
  INSTALL_ROLE: "core",
  INSTALL_PIPELINE: "blueprint",
  INSTALL_WORKFLOW: "blueprint",
  INSTALL_WORK_TYPE: "capabilities",
  INSTALL_REQUEST_TYPE: "capabilities",
  INSTALL_DASHBOARD: "capabilities",
  INSTALL_EMPLOYEE: "employees",
  INSTALL_KNOWLEDGE_SCOPE: "knowledge",
  REQUIRE_SETUP: "integrations",
  REQUIRE_PLATFORM_CAPABILITY: "integrations",
  INSTALL_INTEGRATION_REQUIREMENT: "integrations",
};

/**
 * Map real install action checkpoints → stage completion + 0–100% progress.
 */
export function summarizeInstallProgress(actionResults: Array<{
  type?: string;
  status?: string;
}> | null | undefined = []) {
  const results = Array.isArray(actionResults) ? actionResults : [];
  const stageIds = ARCHITECT_INSTALL_STAGES.map((stage) => stage.id);
  const stageStats = Object.fromEntries(stageIds.map((id) => [id, { total: 0, done: 0, failed: 0 }]));

  // Always seed structural stages so empty plans still show a path.
  stageStats.business.total = 1;
  stageStats.finalizing.total = 1;

  for (const result of results) {
    const type = String(result?.type ?? "");
    const stageId = INSTALL_OP_STAGE[type] ?? "capabilities";
    if (!stageStats[stageId]) continue;
    stageStats[stageId].total += 1;
    const status = String(result?.status ?? "");
    if (status === "failed") stageStats[stageId].failed += 1;
    else if (["applied", "noop", "deferred", "requires_setup", "recorded_gap"].includes(status)) {
      stageStats[stageId].done += 1;
    }
  }

  const completedOps = results.filter((result) => {
    const status = String(result?.status ?? "");
    return ["applied", "noop", "deferred", "requires_setup", "recorded_gap"].includes(status);
  }).length;
  const failedOps = results.filter((result) => String(result?.status ?? "") === "failed").length;
  const totalOps = Math.max(results.length, 1);

  let activeIndex = 0;
  const stages = ARCHITECT_INSTALL_STAGES.map((stage, index) => {
    const stats = stageStats[stage.id] ?? { total: 0, done: 0, failed: 0 };
    let state: "done" | "active" | "failed" | "pending" = "pending";
    if (stage.id === "business") {
      state = failedOps && !completedOps ? "failed" : "done";
    } else if (stage.id === "finalizing") {
      state = failedOps && completedOps < totalOps ? "pending" : (failedOps ? "failed" : "done");
    } else if (stats.failed > 0 && stats.done === 0) {
      state = "failed";
    } else if (stats.total > 0 && stats.done >= stats.total) {
      state = "done";
    } else if (stats.done > 0 || (stats.total > 0 && completedOps > 0)) {
      state = stats.failed > 0 ? "failed" : "active";
    }
    if (state === "active" || state === "failed") activeIndex = index;
    else if (state === "done") activeIndex = Math.max(activeIndex, index);
    return {
      ...stage,
      state,
      stateLabel: humanInstallState(state),
      done: stats.done,
      total: stats.total,
    };
  });

  // Mark trailing finalizing done when install succeeded overall.
  const allApplied = failedOps === 0 && completedOps === results.length;
  if (allApplied) {
    for (const stage of stages) {
      if (stage.state !== "failed") {
        stage.state = "done";
        stage.stateLabel = humanInstallState("done");
      }
    }
    activeIndex = stages.length - 1;
  }

  const percent = Math.max(
    0,
    Math.min(100, Math.round((completedOps / totalOps) * 100)),
  );

  return {
    percent: allApplied ? 100 : percent,
    completedOps,
    failedOps,
    totalOps: results.length,
    activeIndex,
    stages,
  };
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
    label: overall >= 0.7 ? "Your business coming into focus" : overall > 0.25 ? "Building understanding" : "Beginning to understand your business",
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
    const rawPurpose = String(entry.purpose ?? entry.role ?? "Supports approved work");
    return {
      id: String(entry.id ?? entry.employeeId ?? `ai_${index}`),
      name,
      purpose: scrubProposalPurpose(rawPurpose, name),
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

/** Scrub junk "for ok" / builder jargon left in persisted proposal purposes. */
export function scrubProposalPurpose(text: string | null | undefined, roleLabel?: string | null): string {
  let out = String(text ?? "").trim();
  if (!out) return roleLabel ? `${roleLabel} helps run this business.` : "Supports approved work";
  out = out.replace(/\bfor\s+(ok|okay|yes|y|no|n|idk|n\/a|na|none|test|asdf|foo|bar)\b/gi, "for this business");
  out = out.replace(/\s*—\s*never invent a ['']?one-off['']? agent\.?/gi, "");
  out = out.replace(/^Specialize reusable\s+/i, "");
  out = out.replace(/\s+archetype\b/gi, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  if (!out || out.length < 12) {
    return roleLabel ? `${roleLabel} helps run this business.` : "Supports approved work";
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export type ApproveWalkthroughStep = {
  id: string;
  kind: "nav" | "teammate" | "approvals" | "confirm";
  title: string;
  body: string;
  items: string[];
};

/** One concrete proposal fact per step — no fake dashboard tiles. */
export function buildApproveWalkthroughSteps({
  proposal = null,
  continuous = false,
}: {
  proposal?: {
    businessName?: string;
    explanation?: { summary?: string };
    views?: Record<string, any>;
  } | null;
  continuous?: boolean;
} = {}): ApproveWalkthroughStep[] {
  const steps: ApproveWalkthroughStep[] = [];
  const businessName = resolveBusinessDisplayName(proposal?.businessName);
  const views = proposal?.views ?? {};
  const navLabels = collectProposalLabels(views.navigation?.items, ["label", "title", "name"]);
  const homeLabels = collectProposalLabels(
    views.dashboard?.items ?? views.dashboard?.cards,
    ["label", "title", "name"],
  ).filter((label) => !/business health|kpi cards?/i.test(label));

  const workspaceItems = uniqueStrings([
    ...navLabels,
    ...homeLabels,
  ]).slice(0, 10);

  steps.push({
    id: "nav",
    kind: "nav",
    title: continuous ? "What this change covers" : "What your team will use",
    body: continuous
      ? `These are the workspaces and surfaces involved for ${businessName}.`
      : `These are the workspaces ${businessName} will open with.`,
    items: workspaceItems.length
      ? workspaceItems
      : ["Today", "Decisions", "Work", "Ask VIBETech"],
  });

  const personas = aiEmployeePersonas({
    proposalWorkforce: views.digitalWorkforce ?? null,
  });
  for (const persona of personas.slice(0, 6)) {
    const items = uniqueStrings([
      ...persona.responsibilities.slice(0, 4),
      ...(persona.knowledge.length ? [`Uses: ${persona.knowledge.slice(0, 3).join(", ")}`] : []),
    ]);
    steps.push({
      id: `teammate_${persona.id}`,
      kind: "teammate",
      title: persona.name,
      body: persona.purpose,
      items: items.length ? items : ["Ready once knowledge and connections are in place"],
    });
  }

  const approvalItems = uniqueStrings(
    personas.flatMap((persona) => persona.approvals.map((entry) => `${persona.name}: ${entry}`)),
  ).slice(0, 8);
  if (approvalItems.length) {
    steps.push({
      id: "approvals",
      kind: "approvals",
      title: "What waits on you",
      body: continuous
        ? "These are the moments VIBETech will still ask for your judgment."
        : "VIBETech handles the work — these are the moments that still need your approval.",
      items: approvalItems,
    });
  }

  const summary = String(proposal?.explanation?.summary ?? "").trim();
  steps.push({
    id: "confirm",
    kind: "confirm",
    title: continuous ? "Ready to apply this change?" : "Ready to continue?",
    body: summary
      || (continuous
        ? "Nothing changes in the live business until you approve the next step."
        : "Next you’ll check readiness, then go live when it looks right."),
    items: [],
  });

  return steps;
}

export function approveWalkthroughCopy(continuous = false) {
  return {
    badge: continuous ? "Review change" : "Before you approve",
    headline: continuous ? "Review this change" : "Review what you’re approving",
    primaryCta: continuous ? HUMAN_COPY.reviewApply : HUMAN_COPY.reviewContinue,
    keepTalking: "Keep talking",
    backToRecommendation: "Back to recommendation",
  } as const;
}

function collectProposalLabels(
  items: unknown,
  keys: string[],
): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (item == null) return "";
      if (typeof item === "string" || typeof item === "number") return String(item);
      const row = item as Record<string, unknown>;
      for (const key of keys) {
        if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function executiveBriefing(proposal: {
  businessName?: string;
  views?: Record<string, any>;
  explanation?: { summary?: string };
} | null | undefined) {
  const views = proposal?.views ?? {};
  const businessName = resolveBusinessDisplayName(proposal?.businessName);
  const highlights = [
    { id: "navigation", label: "Navigation areas", value: views.navigation?.items?.length ?? 0 },
    { id: "workforce", label: "Responsibilities", value: views.digitalWorkforce?.items?.length ?? 0 },
    { id: "roles", label: "Roles", value: views.rolesAccess?.items?.length ?? 0 },
    { id: "connections", label: "Connections to set up", value: views.integrations?.items?.length ?? 0 },
  ];
  const rawSummary = String(proposal?.explanation?.summary ?? "").trim();
  void rawSummary;
  const summary = `${businessName} is ready. Open Home to connect channels and prove each capability.`;
  return {
    headline: "Open your business",
    businessName,
    summary,
    highlights,
    actions: ARCHITECT_COMPLETION_ACTIONS,
  };
}

/** Canonical Architect routes. Legacy `/builder/*` redirects still exist; do not surface them to owners. */
export function architectRoutes(sessionId?: string, businessId?: string | null) {
  if (businessId && sessionId) {
    const base = `/b/${encodeURIComponent(businessId)}/architect`;
    return {
      home: base,
      session: `${base}?sessionId=${encodeURIComponent(sessionId)}`,
      // Approve/install still live on the global Architect install trail.
      dryRun: `/architect/${sessionId}/dry-run`,
      install: `/architect/${sessionId}/install`,
    };
  }
  const base = sessionId ? `/architect/${sessionId}` : "/architect";
  return {
    home: "/architect",
    session: base,
    dryRun: sessionId ? `/architect/${sessionId}/dry-run` : "/architect",
    install: sessionId ? `/architect/${sessionId}/install` : "/architect",
  };
}
