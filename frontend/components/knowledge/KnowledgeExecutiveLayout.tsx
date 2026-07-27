"use client";

import { useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";

import type { KnowledgeViewModel } from "./KnowledgeContext";
import { KnowledgeViewModelContext } from "./KnowledgeContext";
import KnowledgeAddDialog, { UNIVERSAL_CATEGORY_OPTIONS } from "./KnowledgeAddDialog";
import type { PlatformKnowledgeData, PlatformKnowledgeDocument } from "./KnowledgeRenderer";
import type { KnowledgeExecutiveContext, KnowledgePresentation } from "./knowledgeSemantics";
import PageHeader from "@/components/product/PageHeader";
import PrimaryButton from "@/components/product/PrimaryButton";
import { NextBanner, SimpleEmpty, SimpleMetrics, SimplePanel, simplePageStyle } from "@/components/product/SimpleUI";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  canManageKnowledge,
  deriveKnowledgeCounts,
  documentStatusPresentation,
  extractionStatusPresentation,
  formatBytes,
  sourceTypePresentation,
} from "./knowledgeSemantics";

function categoryLabel(id: string) {
  return UNIVERSAL_CATEGORY_OPTIONS.find((c) => c.id === id)?.label ?? id;
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
  const categories = Array.isArray(doc.categoryIds) ? doc.categoryIds : [];

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
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>
          <StatusBadge label={status.label} tone={status.tone} />
          {extraction ? <StatusBadge label={extraction} tone="info" /> : null}
          {categories.length
            ? categories.map((id) => <StatusBadge key={id} label={categoryLabel(id)} tone="info" />)
            : <StatusBadge label="Untagged" tone="warning" />}
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

type PowersAiPanel = {
  totalDocuments: number;
  taggedDocuments: number;
  untaggedDocuments: number;
  categories: Array<{
    categoryId: string;
    label: string;
    description: string;
    documentCount: number;
  }>;
  winClaim?: string;
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [powersAi, setPowersAi] = useState<PowersAiPanel | null>(null);
  const deletingRef = useRef(false);
  const openedFromChecklist = useRef(false);

  useEffect(() => {
    if (openedFromChecklist.current) return;
    if (searchParams.get("add") === "1" && platformKnowledge?.canManage) {
      openedFromChecklist.current = true;
      setShowAdd(true);
    }
  }, [searchParams, platformKnowledge?.canManage]);

  const businessId = platformKnowledge?.businessId ?? "";

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    void fetch(`/api/businesses/${businessId}/knowledge?panel=powers-ai`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.powersAi) setPowersAi(data.powersAi);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [businessId, platformKnowledge?.documents?.length]);

  if (!viewModel) return null;

  const documents = platformKnowledge?.documents ?? [];
  const canManage = canManageKnowledge(platformKnowledge?.canManage);
  const presentation = (knowledgeContext?.presentation ?? {}) as KnowledgePresentation;
  const emptyCopy = presentation.emptyStates?.documents ?? "No documents yet.";

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (categoryFilter && !(doc.categoryIds ?? []).includes(categoryFilter)) return false;
      if (!q) return true;
      const hay = [doc.title, doc.originalFilename, ...(doc.categoryIds ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [documents, searchQuery, categoryFilter]);

  const counts = useMemo(
    () => deriveKnowledgeCounts(documents, knowledgeContext),
    [documents, knowledgeContext],
  );

  const metricItems = useMemo(() => counts.metrics, [counts.metrics]);
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
    <div style={simplePageStyle}>
      <PageHeader title="Knowledge" action={addAction} />

      {documents.length === 0 && canManage ? (
        <NextBanner label="Upload first document" onClick={() => setShowAdd(true)} />
      ) : null}

      <SimpleMetrics items={metricItems} />

      <SimplePanel title="Categories">
        {powersAi ? (
          <div style={{ padding: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
              {powersAi.taggedDocuments} tagged · {powersAi.untaggedDocuments} untagged
            </div>
            <div style={{ display: "grid", gap: spacing.sm }}>
              {powersAi.categories.map((cat) => (
                <div
                  key={cat.categoryId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: spacing.md,
                    alignItems: "center",
                    padding: `${spacing.xs} 0`,
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  }}
                >
                  <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{cat.label}</div>
                  <StatusBadge
                    label={cat.documentCount ? String(cat.documentCount) : "Empty"}
                    tone={cat.documentCount ? "success" : "warning"}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SimpleEmpty>Loading…</SimpleEmpty>
        )}
      </SimplePanel>

      <SimplePanel
        title="Documents"
        action={documents.length === 0 ? addAction : undefined}
      >
        <div style={{ padding: spacing.md, display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents"
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: 8,
              border: `1px solid ${cockpitColors.panelBorder}`,
              background: cockpitColors.panel,
              color: cockpitColors.textPrimary,
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }}>
            <button
              type="button"
              onClick={() => setCategoryFilter("")}
              style={chipStyle(!categoryFilter)}
            >
              All
            </button>
            {UNIVERSAL_CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                style={chipStyle(categoryFilter === cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        {documents.length === 0 ? (
          <SimpleEmpty>{emptyCopy}</SimpleEmpty>
        ) : filteredDocuments.length === 0 ? (
          <SimpleEmpty>No matches.</SimpleEmpty>
        ) : (
          <div>
            {filteredDocuments.map((doc) => (
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
      </SimplePanel>

      {showEmployeeImpact ? (
        <SimplePanel title="AI coverage">
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
                  {!impact.helped && impact.missingCategories.length > 0 ? (
                    <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 4 }}>
                      Needs: {impact.missingCategories.join(", ")}
                    </div>
                  ) : null}
                </div>
                <StatusBadge
                  label={impact.helped ? "Ready" : "Needs docs"}
                  tone={impact.helped ? "success" : "warning"}
                />
              </div>
            ))}
          </div>
        </SimplePanel>
      ) : null}

      {setupNeeds.length > 0 ? (
        <SimplePanel title="Missing">
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
                  {need.employeeNames.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </SimplePanel>
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

function chipStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? cockpitColors.accent : cockpitColors.panelBorder}`,
    background: active ? cockpitColors.panelElevated : cockpitColors.panel,
    color: cockpitColors.textPrimary,
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: typography.caption.fontSize,
    fontWeight: 600,
    cursor: "pointer",
  };
}
