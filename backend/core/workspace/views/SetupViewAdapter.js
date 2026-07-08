import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function buildSetupViewModel({
  identity,
  installationResult,
  readinessReport,
  employeeReadinessReport,
  connectedSystemsSnapshot,
  connectionDependencyProjection,
} = {}) {
  const installed = installationResult ?? null;
  const readiness = readinessReport ?? {};
  const employees = employeeReadinessReport ?? { employees: [], summary: {} };

  const sections = [
    {
      id: "your_business",
      title: "Your Business",
      description: "Who you are and how VIBETech represents your company.",
      items: [
        { label: "Business name", value: identity?.businessName ?? "" },
        { label: "Industry", value: identity?.industryDisplayName ?? "None" },
        { label: "Operating mode", value: identity?.workspaceMode ?? "" },
      ],
    },
    {
      id: "your_team",
      title: "Your Team",
      description: "Human team members and digital employees responsible for work.",
      items: safeArray(employees.employees).map((e) => ({
        label: e.name,
        value: e.status,
        detail: safeArray(e.blockers).map((b) => b.message).join("; ") || "Ready to operate",
      })),
    },
    {
      id: "how_work_gets_handled",
      title: "How Work Gets Handled",
      description: "Installed automations and capabilities that execute operational work.",
      items: [
        { label: "Active automations", value: String(readiness.summary?.automationsActive ?? 0) },
        { label: "Capabilities installed", value: String(readiness.summary?.capabilitiesInstalled ?? 0) },
        { label: "Readiness", value: readiness.readinessStatus ?? "NOT_STARTED" },
      ],
    },
    {
      id: "what_requires_approval",
      title: "What Requires Approval",
      description: "Policies that pause execution until you decide.",
      items: safeArray(installed?.approvalPolicies).map((p) => ({
        label: p.description ?? p.id,
        value: p.configured ? "Configured" : "Not configured",
      })),
    },
    {
      id: "your_knowledge",
      title: "Your Knowledge",
      description: "Business policies and procedures VIBETech uses to operate.",
      items: safeArray(readiness.missing?.knowledgeRequirements).length
        ? safeArray(readiness.missing?.knowledgeRequirements).map((k) => ({
            label: String(k.categoryId ?? k.id ?? "knowledge"),
            value: "Missing",
            detail: String(k.description ?? ""),
          }))
        : [{ label: "Knowledge categories", value: String(readiness.summary?.knowledgeCategoriesInstalled ?? 0) }],
    },
    {
      id: "business_subjects",
      title: "Business Subjects",
      description: "Universal subject types installed for this industry package.",
      items: safeArray(installed?.subjectTypes).map((st) => ({
        label: st.displayName ?? st.id,
        value: String(st.id),
        detail: Object.keys(st.attributeSchema ?? {}).join(", ") || "No attributes defined",
      })),
    },
    {
      id: "segments_and_preferences",
      title: "Segments & Communication Policy",
      description: "Installed segment templates and preference enforcement boundaries.",
      items: [
        { label: "Segment templates", value: String(safeArray(installed?.segmentTemplates).length) },
        { label: "Preference enforcement", value: "Outbound blocked when party opts out" },
        ...safeArray(installed?.segmentTemplates).map((seg) => ({
          label: seg.name ?? seg.id,
          value: "Template",
          detail: String(seg.targetEntityType ?? "Party"),
        })),
      ],
    },
    {
      id: "your_connected_systems",
      title: "Your Connected Systems",
      description: "External systems that enable communications and integrations.",
      items: safeArray(connectedSystemsSnapshot?.connections).map((c) => ({
        label: c.displayName,
        value: c.status,
        detail: c.purpose ?? c.requirementLevel,
      })),
    },
    {
      id: "workspace",
      title: "Workspace Identity",
      items: [
        { label: "Workspace ID", value: identity?.workspaceId ?? "" },
        { label: "Activated", value: identity?.activatedAt ?? "Not activated" },
      ],
    },
    {
      id: "operational_activation",
      title: "Operational Activation",
      items: [
        { label: "Ready capabilities", value: String(connectionDependencyProjection?.availableCapabilities?.length ?? 0) },
        { label: "Required connections missing", value: String(connectedSystemsSnapshot?.missingRequired?.length ?? 0) },
        { label: "Blocked employees", value: String(safeArray(employees.employees).filter((e) => e.status !== "ACTIVE").length) },
      ],
    },
  ];

  const nextSteps = [];
  if (!installed) nextSteps.push({ id: "install_package", title: "Install an industry package", priority: "immediate" });
  for (const k of safeArray(readiness.missing?.knowledgeRequirements)) {
    nextSteps.push({ id: `knowledge_${k.categoryId ?? k.id}`, title: `Configure knowledge: ${k.categoryId ?? k.id}`, priority: "soon" });
  }
  for (const c of safeArray(connectedSystemsSnapshot?.connections).filter((x) => x.requirementLevel === "required")) {
    nextSteps.push({ id: `connect_${c.id}`, title: `Connect ${c.displayName}`, priority: "immediate" });
  }
  for (const e of safeArray(employees.employees).filter((x) => x.status !== "ACTIVE")) {
    const why = safeArray(e.blockers).map((b) => b.message).join("; ") || e.status;
    nextSteps.push({ id: `employee_${e.employeeId}`, title: `Resolve blockers for ${e.name}`, detail: why, priority: "soon" });
  }
  for (const dep of safeArray(connectionDependencyProjection?.connections).filter((c) => !c.isConnected && c.requirementLevel === "required")) {
    nextSteps.push({
      id: `unblock_${dep.connectionType}`,
      title: `Connect ${dep.displayName} to unblock operations`,
      detail: `Enables: ${safeArray(dep.enables.capabilities).join(", ")}`,
      priority: "immediate",
    });
  }

  return deepFreeze({
    title: identity?.pageLabels?.setupPageTitle ?? "Workspace Setup",
    overallStatus: readiness.readinessStatus ?? "NOT_STARTED",
    sections: deepFreeze(sections),
    nextSteps: deepFreeze(nextSteps),
    onboardingSchema: installed?.onboardingSchema ?? deepFreeze({}),
    installed: Boolean(installed),
  });
}

export class SetupViewAdapter {
  translate(input = {}) {
    return buildSetupViewModel(input);
  }
}
