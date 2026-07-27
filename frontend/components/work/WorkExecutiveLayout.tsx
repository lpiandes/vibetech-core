"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import type { WorkViewModel } from "./WorkContext";
import { WorkViewModelContext } from "./WorkContext";
import PageHeader from "@/components/product/PageHeader";
import { SimpleEmpty, SimplePanel, simplePageStyle } from "@/components/product/SimpleUI";
import StatusBadge from "@/components/product/StatusBadge";
import EntityAvatar from "@/components/shell/EntityAvatar";
import ShellPanel from "@/components/shell/ShellPanel";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  deriveWorkQueueCounts,
  filterWorkItems,
  priorityLabel,
  priorityTone,
  resolveTargetWorkItem,
  resolveWorkRowHref,
  sortWorkQueueItems,
  statusTone,
  type WorkQueueFilter,
  type WorkQueueItem,
} from "./workQueueSemantics";
import RelationshipFollowUpResolutionDialog from "./RelationshipFollowUpResolutionDialog";
import RelationshipFollowUpDraftDialog from "./RelationshipFollowUpDraftDialog";
import CampaignStudioPanel from "./CampaignStudioPanel";
import SpecialtyDeliverableView, { type SpecialtyArtifactPreview } from "@/components/specialty/SpecialtyDeliverableView";
import {
  isResolvableRelationshipFollowUpWork,
  type RelationshipFollowUpOutcome,
} from "./relationshipFollowUpResolutionSemantics";

const FILTERS: Array<{ id: WorkQueueFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "blocked", label: "Blocked" },
  { id: "overdue", label: "Overdue" },
];

function SubjectChip({ name, href }: { name: string; href: string | null }) {
  const chip = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: radius.pill,
        padding: "2px 8px",
        fontSize: "0.7rem",
        fontWeight: 600,
        backgroundColor: cockpitColors.accentMuted,
        color: cockpitColors.accent,
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );

  if (!href) return chip;

  return (
    <Link href={href} style={{ textDecoration: "none" }} onClick={(event) => event.stopPropagation()}>
      {chip}
    </Link>
  );
}

function WorkQueueRow({
  item,
  businessId,
  onResolveFollowUp,
  onDraftFollowUp,
  highlighted = false,
}: {
  item: WorkQueueItem;
  businessId: string;
  onResolveFollowUp: (item: WorkQueueItem) => void;
  onDraftFollowUp: (item: WorkQueueItem) => void;
  highlighted?: boolean;
}) {
  const display = item.metadata?.display ?? {};
  const href = resolveWorkRowHref(display, businessId, item.id);
  const canResolveFollowUp = isResolvableRelationshipFollowUpWork(item);
  const title = String(item.title ?? "Work item");
  const avatarName = display.partyName ? String(display.partyName) : title;
  // Subject links need a vertical-aware destination (patient/player/etc.).
  // Until a custom subject surface is installed, keep the work item in Work
  // rather than falling through to the legacy property route.
  const subjectHref = null;
  const dueSuffix = display.dueLabel
    ? display.overdue
      ? ` · Overdue ${display.dueLabel}`
      : ` · Due ${display.dueLabel}`
    : "";
  const meta = [
    display.workTypeLabel,
    display.partyName ? String(display.partyName) : null,
    display.assigneeName ? String(display.assigneeName) : null,
  ].filter(Boolean).join(" · ");

  const rowBody = (
    <>
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
        <EntityAvatar name={avatarName} kind={display.partyName ? "person" : "subject"} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{title}</div>
            {display.subjectName ? <SubjectChip name={String(display.subjectName)} href={subjectHref} /> : null}
          </div>
          {meta ? (
            <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
              {meta}{dueSuffix}
            </div>
          ) : dueSuffix ? (
            <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{dueSuffix.slice(3)}</div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {priorityLabel(item.priority) ? <StatusBadge label={priorityLabel(item.priority)!} tone={priorityTone(item.priority)} /> : null}
        <StatusBadge label={display.statusLabel ?? String(item.status ?? "").replace(/_/g, " ")} tone={statusTone(item)} />
        {canResolveFollowUp ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDraftFollowUp(item);
            }}
            style={{
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.panelBorder}`,
              backgroundColor: cockpitColors.panel,
              color: cockpitColors.textPrimary,
              padding: "7px 10px",
              fontSize: typography.caption.fontSize,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Draft
          </button>
        ) : null}
        {canResolveFollowUp ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onResolveFollowUp(item);
            }}
            style={{
              borderRadius: radius.medium,
              border: `1px solid ${cockpitColors.accent}`,
              backgroundColor: cockpitColors.accent,
              color: "#fff",
              padding: "7px 10px",
              fontSize: typography.caption.fontSize,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Resolve
          </button>
        ) : null}
        {href ? <ChevronRight size={16} color={cockpitColors.textMuted} aria-hidden /> : null}
      </div>
    </>
  );

  const rowStyle = {
    padding: spacing.md,
    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
    display: "flex" as const,
    justifyContent: "space-between" as const,
    gap: spacing.md,
    alignItems: "center" as const,
    textDecoration: "none" as const,
    color: "inherit" as const,
    cursor: href ? "pointer" : "default",
    transition: "background-color 120ms ease",
    backgroundColor: highlighted ? cockpitColors.panelElevated : "transparent",
  };

  if (href) {
    return (
      <Link
        href={href}
        style={rowStyle}
        onMouseEnter={(event) => {
          event.currentTarget.style.backgroundColor = cockpitColors.panelElevated;
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.backgroundColor = highlighted ? cockpitColors.panelElevated : "transparent";
        }}
      >
        {rowBody}
      </Link>
    );
  }

  return <div style={rowStyle}>{rowBody}</div>;
}

function CampaignReviewPanel({
  item,
  businessId,
}: {
  item: WorkQueueItem;
  businessId: string;
}) {
  return <CampaignStudioPanel item={item} businessId={businessId} />;
}

function CompleteWorkPanel({
  item,
  businessId,
  onCompleted,
}: {
  item: WorkQueueItem;
  businessId: string;
  onCompleted: () => void;
}) {
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [memoryNote, setMemoryNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = String(item.status ?? "").toLowerCase();
  const existingOutcome = item.metadata?.outcomeSummary;
  const existingChanges = item.metadata?.memoryChanges ?? [];

  if (status === "completed") {
    return (
      <div style={{ padding: spacing.md, borderTop: `1px solid ${cockpitColors.panelBorder}` }}>
        <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>Outcome</div>
        <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>
          {existingOutcome || "Completed."}
        </div>
        {existingChanges.length ? (
          <ul style={{ margin: `${spacing.xs} 0 0`, paddingLeft: spacing.lg, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
            {existingChanges.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (["cancelled", "failed", "rejected"].includes(status)) return null;

  async function complete() {
    if (busy || !item.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/work/${encodeURIComponent(String(item.id))}/complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            outcomeSummary: outcomeSummary.trim() || "Marked complete",
            memoryChanges: memoryNote.trim() ? [memoryNote.trim()] : [],
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.reason ?? json?.error ?? "Could not complete work");
      }
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete work");
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: spacing.md, borderTop: `1px solid ${cockpitColors.panelBorder}`, display: "grid", gap: spacing.sm }}>
      <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>Record outcome</div>
      <textarea
        value={outcomeSummary}
        onChange={(e) => setOutcomeSummary(e.target.value)}
        placeholder="What was decided or delivered?"
        rows={2}
        style={{
          padding: spacing.sm,
          borderRadius: 8,
          border: `1px solid ${cockpitColors.panelBorder}`,
          resize: "vertical",
        }}
      />
      <input
        value={memoryNote}
        onChange={(e) => setMemoryNote(e.target.value)}
        placeholder="Memory change (optional)"
        style={{
          padding: spacing.sm,
          borderRadius: 8,
          border: `1px solid ${cockpitColors.panelBorder}`,
        }}
      />
      {error ? <div style={{ color: "#dc2626", fontSize: typography.caption.fontSize }}>{error}</div> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void complete()}
        style={{
          justifySelf: "start",
          borderRadius: radius.medium,
          border: `1px solid ${cockpitColors.accent}`,
          backgroundColor: cockpitColors.accent,
          color: "#fff",
          padding: "8px 14px",
          fontSize: typography.caption.fontSize,
          fontWeight: 700,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Completing…" : "Complete work"}
      </button>
    </div>
  );
}

function FilterChips({
  active,
  counts,
  onSelect,
}: {
  active: WorkQueueFilter;
  counts: ReturnType<typeof deriveWorkQueueCounts>;
  onSelect: (filter: WorkQueueFilter) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }} aria-label="Work queue filters">
      {FILTERS.map((filter) => {
        const selected = active === filter.id;
        const count =
          filter.id === "all"
            ? counts.all
            : filter.id === "open"
              ? counts.open
              : filter.id === "blocked"
                ? counts.blocked
                : counts.overdue;

        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onSelect(filter.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: radius.pill,
              border: `1px solid ${selected ? cockpitColors.accent : cockpitColors.panelBorder}`,
              backgroundColor: selected ? cockpitColors.accentMuted : cockpitColors.panel,
              color: selected ? cockpitColors.accent : cockpitColors.textSecondary,
              fontSize: typography.caption.fontSize,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {filter.label}
            <span style={{ color: cockpitColors.textMuted, fontWeight: 700 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function WorkExecutiveLayout() {
  const viewModel = useContext<WorkViewModel | null>(WorkViewModelContext);
  const { businessId } = useBusinessScope();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [filter, setFilter] = useState<WorkQueueFilter>("all");
  const [resolutionTarget, setResolutionTarget] = useState<WorkQueueItem | null>(null);
  const [draftTarget, setDraftTarget] = useState<WorkQueueItem | null>(null);
  const requestedWorkId = searchParams.get("workId");

  const metrics = viewModel?.metrics ?? {};
  const counts = useMemo(() => deriveWorkQueueCounts(viewModel?.items, metrics), [viewModel?.items, metrics]);
  const targetWork = useMemo(
    () => resolveTargetWorkItem(viewModel?.items, requestedWorkId),
    [viewModel?.items, requestedWorkId],
  );

  useEffect(() => {
    if (targetWork) setFilter("all");
  }, [targetWork?.id]);

  const visibleItems = useMemo(() => {
    const filtered = filterWorkItems(viewModel?.items, filter);
    return sortWorkQueueItems(filtered);
  }, [viewModel?.items, filter]);

  if (!viewModel) return null;

  const clearRequestedWork = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("workId");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const relationshipFollowUpOutcomes = (viewModel?.productContext?.installationResult?.relationshipFollowUpOutcomes ?? []) as RelationshipFollowUpOutcome[];

  const emptyCopy =
    filter === "blocked"
      ? "No blocked work."
      : filter === "overdue"
        ? "No overdue work."
        : filter === "open"
          ? "No open work."
          : "Nothing in the queue yet. Add a follow-up, or turn on a teammate automation.";

  async function createOwnerWork() {
    const title = window.prompt("What needs to get done?");
    if (!title?.trim()) return;
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/work`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      window.alert(String(data.error ?? "Could not create work"));
      return;
    }
    router.refresh();
  }

  return (
    <div style={simplePageStyle}>
      <PageHeader
        title="Work"
        action={(
          <button
            type="button"
            onClick={() => void createOwnerWork()}
            style={{
              borderRadius: radius.medium,
              border: "none",
              backgroundColor: cockpitColors.accent,
              color: "#fff",
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            + Work
          </button>
        )}
      />

      {targetWork ? (
        <ShellPanel
          title="Selected"
          action={
            <button
              type="button"
              onClick={clearRequestedWork}
              style={{
                borderRadius: radius.medium,
                border: `1px solid ${cockpitColors.panelBorder}`,
                backgroundColor: cockpitColors.panel,
                color: cockpitColors.textSecondary,
                padding: "7px 10px",
                fontSize: typography.caption.fontSize,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          }
        >
          <WorkQueueRow
            item={targetWork}
            businessId={businessId}
            onResolveFollowUp={setResolutionTarget}
            onDraftFollowUp={setDraftTarget}
            highlighted
          />
          {targetWork.metadata?.artifact ? (
            <div style={{ padding: spacing.md, borderTop: `1px solid ${cockpitColors.panelBorder}` }}>
              <SpecialtyDeliverableView
                artifact={targetWork.metadata.artifact as unknown as SpecialtyArtifactPreview}
                knowledgeHref={`/b/${businessId}/knowledge`}
              />
            </div>
          ) : null}
          <CompleteWorkPanel item={targetWork} businessId={businessId} onCompleted={() => router.refresh()} />
          <CampaignReviewPanel item={targetWork} businessId={businessId} />
        </ShellPanel>
      ) : null}

      <SimplePanel
        title="Work queue"
        action={<FilterChips active={filter} counts={counts} onSelect={setFilter} />}
      >
        {visibleItems.length === 0 ? (
          <SimpleEmpty>{emptyCopy}</SimpleEmpty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visibleItems.map((item) => (
              <WorkQueueRow
                key={String(item.id)}
                item={item}
                businessId={businessId}
                onResolveFollowUp={setResolutionTarget}
                onDraftFollowUp={setDraftTarget}
              />
            ))}
          </div>
        )}
      </SimplePanel>

      {resolutionTarget ? (
        <RelationshipFollowUpResolutionDialog
          businessId={businessId}
          work={resolutionTarget}
          outcomes={relationshipFollowUpOutcomes}
          onClose={() => setResolutionTarget(null)}
        />
      ) : null}
      {draftTarget ? (
        <RelationshipFollowUpDraftDialog
          businessId={businessId}
          work={draftTarget}
          onClose={() => setDraftTarget(null)}
        />
      ) : null}
    </div>
  );
}
