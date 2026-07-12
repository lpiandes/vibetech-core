export type PlatformKnowledgeDocument = {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  sourceType: string;
  sizeBytes: number;
  status: string;
  textExtractionStatus: string;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeEmployeeImpact = {
  employeeId: string;
  name: string;
  roleLabel: string;
  helped: boolean;
  missingCategories: string[];
};

export type KnowledgeSetupNeed = {
  categoryId: string;
  label: string;
  employeeNames: string[];
};

export type KnowledgeExecutiveContext = {
  employeeImpacts: KnowledgeEmployeeImpact[];
  setupNeeds: KnowledgeSetupNeed[];
  helpedEmployeeCount: number;
  employeesWithKnowledgeRequirements: number;
  fallbackExplanation: string;
  presentation: Record<string, unknown>;
};

export type KnowledgePresentation = {
  categoryLabels?: Record<string, string>;
  sourceTypeLabels?: Record<string, string>;
  documentStatusLabels?: Record<string, string>;
  extractionStatusLabels?: Record<string, string>;
  emptyStates?: {
    documents?: string;
  };
  fallbackExplanation?: string;
};

type ConnectedKnowledgeSource = {
  employeeReadinessReport?: { employees?: unknown[] } | null;
  installationResult?: {
    executiveExperience?: { dashboardPresentation?: Record<string, unknown> };
    dashboardPresentation?: Record<string, unknown>;
  } | null;
};

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function dashboardPresentation(connected: ConnectedKnowledgeSource) {
  return (
    connected.installationResult?.executiveExperience?.dashboardPresentation ??
    connected.installationResult?.dashboardPresentation ??
    {}
  );
}

function humanizeCategoryId(categoryId: string) {
  return String(categoryId ?? "")
    .replace(/^PM_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function categoryLabel(categoryId: string, presentation: KnowledgePresentation = {}) {
  const labels = presentation.categoryLabels ?? {};
  return labels[categoryId] ?? humanizeCategoryId(categoryId);
}

export function buildKnowledgeExecutiveContext(connected: ConnectedKnowledgeSource): KnowledgeExecutiveContext {
  const presentation = dashboardPresentation(connected);
  const knowledgePresentation = (presentation.knowledge ?? {}) as KnowledgePresentation & {
    fallbackExplanation?: string;
  };
  const roleLabels = (presentation.roleLabels ?? {}) as Record<string, string>;
  const employees = safeArray<{
    employeeId?: string;
    name?: string;
    role?: string;
    requiredKnowledge?: string[];
    missingKnowledge?: string[];
  }>(connected.employeeReadinessReport?.employees);

  const withKnowledgeRequirements = employees.filter((employee) => safeArray(employee.requiredKnowledge).length > 0);

  const employeeImpacts: KnowledgeEmployeeImpact[] = withKnowledgeRequirements.map((employee) => {
    const missing = safeArray(employee.missingKnowledge);
    return {
      employeeId: String(employee.employeeId ?? ""),
      name: String(employee.name ?? "Digital employee"),
      roleLabel: roleLabels[String(employee.role ?? "")] ?? String(employee.name ?? "Digital employee"),
      helped: missing.length === 0,
      missingCategories: missing.map((categoryId) => categoryLabel(String(categoryId), knowledgePresentation)),
    };
  });

  const setupNeedsByCategory = new Map<string, KnowledgeSetupNeed>();
  for (const employee of withKnowledgeRequirements) {
    for (const categoryId of safeArray<string>(employee.missingKnowledge)) {
      const existing = setupNeedsByCategory.get(categoryId) ?? {
        categoryId,
        label: categoryLabel(categoryId, knowledgePresentation),
        employeeNames: [],
      };
      const name = String(employee.name ?? "Digital employee");
      if (!existing.employeeNames.includes(name)) {
        existing.employeeNames.push(name);
      }
      setupNeedsByCategory.set(categoryId, existing);
    }
  }

  return {
    employeeImpacts,
    setupNeeds: [...setupNeedsByCategory.values()],
    helpedEmployeeCount: employeeImpacts.filter((impact) => impact.helped).length,
    employeesWithKnowledgeRequirements: employeeImpacts.length,
    fallbackExplanation:
      knowledgePresentation.fallbackExplanation ??
      "Uploaded documents help VIBETech follow your policies and procedures.",
    presentation: knowledgePresentation,
  };
}

export function deriveKnowledgeCounts(
  documents: PlatformKnowledgeDocument[],
  context?: Pick<KnowledgeExecutiveContext, "helpedEmployeeCount" | "employeesWithKnowledgeRequirements" | "setupNeeds">,
) {
  const rows = safeArray<PlatformKnowledgeDocument>(documents);
  const ready = rows.filter((doc) => String(doc.status ?? "").toLowerCase() === "ready").length;
  const needsAttention = rows.filter((doc) => documentNeedsAttention(doc)).length;

  const metrics: Array<{ id: string; label: string; value: string }> = [
    { id: "documents", label: "Documents", value: String(rows.length) },
    { id: "ready", label: "Ready documents", value: String(ready) },
    { id: "attention", label: "Needs attention", value: String(needsAttention) },
  ];

  if ((context?.employeesWithKnowledgeRequirements ?? 0) > 0) {
    metrics.push({
      id: "employees_helped",
      label: "Digital employees helped",
      value: String(context?.helpedEmployeeCount ?? 0),
    });
  } else if ((context?.setupNeeds?.length ?? 0) > 0) {
    metrics.push({
      id: "setup_needs",
      label: "Setup needs",
      value: String(context?.setupNeeds?.length ?? 0),
    });
  }

  return {
    total: rows.length,
    ready,
    needsAttention,
    metrics,
  };
}

export function documentNeedsAttention(doc: PlatformKnowledgeDocument) {
  const status = String(doc.status ?? "").toLowerCase();
  const extraction = String(doc.textExtractionStatus ?? "").toLowerCase();
  return status === "failed" || extraction === "failed";
}

export function documentStatusPresentation(
  doc: PlatformKnowledgeDocument,
  presentation: KnowledgePresentation = {},
): { label: string; tone: "success" | "warning" | "neutral" | "info" } {
  const status = String(doc.status ?? "").toLowerCase();
  const labels = presentation.documentStatusLabels ?? {};
  if (status === "ready") return { label: labels.ready ?? "Ready", tone: "success" };
  if (status === "failed") return { label: labels.failed ?? "Needs attention", tone: "warning" };
  return { label: "Uploaded", tone: "neutral" };
}

export function sourceTypePresentation(doc: PlatformKnowledgeDocument, presentation: KnowledgePresentation = {}) {
  const labels = presentation.sourceTypeLabels ?? {};
  const sourceType = String(doc.sourceType ?? "").toUpperCase();
  if (labels[sourceType]) return labels[sourceType];
  const ext = doc.originalFilename.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : "Document";
}

export function extractionStatusPresentation(
  doc: PlatformKnowledgeDocument,
  presentation: KnowledgePresentation = {},
): string | null {
  const extraction = String(doc.textExtractionStatus ?? "skipped").toLowerCase();
  const labels = presentation.extractionStatusLabels ?? {};
  if (extraction === "skipped") return null;
  return labels[extraction] ?? null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatKnowledgeDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function canManageKnowledge(canManage: boolean | undefined) {
  return Boolean(canManage);
}
