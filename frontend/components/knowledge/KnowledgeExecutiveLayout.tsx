"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";

import type { KnowledgeViewModel } from "./KnowledgeContext";
import { KnowledgeViewModelContext } from "./KnowledgeContext";
import KnowledgeAddDialog from "./KnowledgeAddDialog";
import type { PlatformKnowledgeData, PlatformKnowledgeDocument } from "./KnowledgeRenderer";
import type { KnowledgeExecutiveContext, KnowledgePresentation } from "./knowledgeSemantics";
import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import StatusBadge from "@/components/product/StatusBadge";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  canManageKnowledge,
  deriveKnowledgeCounts,
  documentStatusPresentation,
  extractionStatusPresentation,
  formatBytes,
  formatKnowledgeDate,
  sourceTypePresentation,
} from "./knowledgeSemantics";

function PanelEmpty({ description }: { description: string }) {
  return (
    <div
      style={{
        padding: spacing.md,
        color: cockpitColors.textMuted,
        fontSize: typography.caption.fontSize,
        lineHeight: 1.5,
      }}
    >
      {description}
    </div>
  );
}

function DocumentRow({
  doc,
  presentation,
  canManage,
  deleting,
  onDelete,
}: {
  doc: PlatformKnowledgeDocument;
  presentation: KnowledgePresentation;
  canManage: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const status = documentStatusPresentation(doc, presentation);
  const source = sourceTypePresentation(doc, presentation);
  const extraction = extractionStatusPresentation(doc, presentation);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: spacing.md,
        padding: spacing.md,
        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.medium,
          backgroundColor: cockpitColors.panelElevated,
          color: cockpitColors.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FileText size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{doc.title}</div>
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>
          {source} · {formatBytes(doc.sizeBytes)}
        </div>
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>
          Added {formatKnowledgeDate(doc.createdAt)}
          {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ""}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>
          <StatusBadge label={status.label} tone={status.tone} />
          {extraction ? <StatusBadge label={extraction} tone="info" /> : null}
        </div>
      </div>
      {canManage ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          style={{
            border: `1px solid ${cockpitColors.panelBorder}`,
            borderRadius: 8,
            background: cockpitColors.panel,
            padding: "8px 14px",
            fontSize: typography.caption.fontSize,
            fontWeight: 600,
            cursor: deleting ? "wait" : "pointer",
            opacity: deleting ? 0.6 : 1,
            color: cockpitColors.textPrimary,
          }}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      ) : null}
    </div>
  );
}

export default function KnowledgeExecutiveLayout({
  platformKnowledge,
  knowledgeContext,
}: {
  platformKnowledge?: PlatformKnowledgeData;
  knowledgeContext?: KnowledgeExecutiveContext;
}) {
  const viewModel = useContext<KnowledgeViewModel | null>(KnowledgeViewModelContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingRef = useRef(false);
  const openedFromChecklist = useRef(false);

  useEffect(() => {
    if (openedFromChecklist.current) return;
    if (searchParams.get("add") === "1" && platformKnowledge?.canManage) {
      openedFromChecklist.current = true;
      setShowAdd(true);
    }
  }, [searchParams, platformKnowledge?.canManage]);

  if (!viewModel) return null;

  const documents = platformKnowledge?.documents ?? [];
  const canManage = canManageKnowledge(platformKnowledge?.canManage);
  const businessId = platformKnowledge?.businessId ?? "";
  const presentation = (knowledgeContext?.presentation ?? {}) as KnowledgePresentation;
  const emptyCopy =
    presentation.emptyStates?.documents ??
    "Upload policies, procedures, and guides so VIBETech can support your Digital Employees.";

  const counts = useMemo(
    () => deriveKnowledgeCounts(documents, knowledgeContext),
    [documents, knowledgeContext],
  );

  const metricStrip = useMemo(() => counts.metrics, [counts.metrics]);
  const employeeImpacts = knowledgeContext?.employeeImpacts ?? [];
  const setupNeeds = knowledgeContext?.setupNeeds ?? [];
  const showEmployeeImpact = employeeImpacts.length > 0;

  async function deleteDocument(documentId: string, title: string) {
    if (deletingRef.current) return;
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    deletingRef.current = true;
    setDeletingId(documentId);
    try {
      const res = await fetch(`/api/businesses/${businessId}/knowledge/${documentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(String(data.error ?? "Could not delete document."));
        return;
      }
      router.refresh();
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  }

  const addAction = canManage ? (
    <PrimaryButton onClick={() => setShowAdd(true)}>+ Upload document</PrimaryButton>
  ) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <PageHeader
        title="Knowledge"
        description="Documents and business instructions VIBETech uses to understand how this company works."
        action={addAction}
      />

      <ShellMetricStrip metrics={metricStrip} />

      <ShellPanel
        title="Business knowledge"
        subtitle={`${counts.total} document${counts.total === 1 ? "" : "s"}`}
        action={documents.length === 0 ? addAction : undefined}
      >
        {documents.length === 0 ? (
          <PanelEmpty description={emptyCopy} />
        ) : (
          <div>
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                presentation={presentation}
                canManage={canManage}
                deleting={deletingId === doc.id}
                onDelete={() => void deleteDocument(doc.id, doc.title)}
              />
            ))}
          </div>
        )}
      </ShellPanel>

      <ShellPanel title="What this helps VIBETech do">
        {showEmployeeImpact ? (
          <div>
            {employeeImpacts.map((impact) => (
              <div
                key={impact.employeeId}
                style={{
                  padding: spacing.md,
                  borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: spacing.md,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{impact.name}</div>
                  <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>
                    {impact.roleLabel}
                  </div>
                  {!impact.helped && impact.missingCategories.length > 0 ? (
                    <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, marginTop: 6 }}>
                      Still needs: {impact.missingCategories.join(", ")}
                    </div>
                  ) : null}
                </div>
                <StatusBadge
                  label={impact.helped ? "Knowledge requirements met" : "Needs business knowledge"}
                  tone={impact.helped ? "success" : "warning"}
                />
              </div>
            ))}
          </div>
        ) : (
          <PanelEmpty description={knowledgeContext?.fallbackExplanation ?? "Uploaded documents support business knowledge setup for Digital Employees."} />
        )}
      </ShellPanel>

      {setupNeeds.length > 0 ? (
        <ShellPanel title="Missing knowledge" subtitle={`${setupNeeds.length} setup need${setupNeeds.length === 1 ? "" : "s"}`}>
          <div>
            {setupNeeds.map((need) => (
              <div
                key={need.categoryId}
                style={{
                  padding: spacing.md,
                  borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                }}
              >
                <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{need.label}</div>
                <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 4 }}>
                  Needed for {need.employeeNames.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </ShellPanel>
      ) : null}

      {showAdd && businessId ? (
        <KnowledgeAddDialog
          businessId={businessId}
          onClose={() => setShowAdd(false)}
          onUploaded={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
