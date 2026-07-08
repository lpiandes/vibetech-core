"use client";

import { useContext, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { WorkViewModel } from "./WorkContext";
import { WorkViewModelContext } from "./WorkContext";
import PageHeader from "@/components/product/PageHeader";
import StatusBadge from "@/components/product/StatusBadge";
import EntityAvatar from "@/components/shell/EntityAvatar";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  deriveWorkQueueCounts,
  filterWorkItems,
  priorityLabel,
  priorityTone,
  resolveWorkRowHref,
  sortWorkQueueItems,
  statusTone,
  type WorkQueueFilter,
  type WorkQueueItem,
} from "./workQueueSemantics";
import RelationshipFollowUpResolutionDialog from "./RelationshipFollowUpResolutionDialog";
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
}: {
  item: WorkQueueItem;
  businessId: string;
  onResolveFollowUp: (item: WorkQueueItem) => void;
}) {
  const display = item.metadata?.display ?? {};
  const href = resolveWorkRowHref(display, businessId);
  const canResolveFollowUp = isResolvableRelationshipFollowUpWork(item);
  const title = String(item.title ?? "Work item");
  const avatarName = display.partyName ? String(display.partyName) : title;
  const subjectHref = display.subjectId ? `/b/${businessId}/properties/${display.subjectId}` : null;
  const dueSuffix = display.dueLabel
    ? display.overdue
      ? ` · Overdue since ${display.dueLabel}`
      : ` · Due ${display.dueLabel}`
    : "";
  const priority = priorityLabel(item.priority);
  const statusLabel = display.statusLabel ?? String(item.status ?? "").replace(/_/g, " ");

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
          <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
            {display.workTypeLabel ?? ""}
            {display.partyName ? `${display.workTypeLabel ? " · " : ""}${display.partyName}` : ""}
            {display.assigneeName ? ` · ${display.assigneeName}` : ""}
          </div>
          <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            Next: {display.nextStep ?? "In progress"}
            {dueSuffix}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {priority ? <StatusBadge label={priority} tone={priorityTone(item.priority)} /> : null}
        <StatusBadge label={statusLabel} tone={statusTone(item)} />
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
          event.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {rowBody}
      </Link>
    );
  }

  return <div style={rowStyle}>{rowBody}</div>;
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
  const [filter, setFilter] = useState<WorkQueueFilter>("all");
  const [resolutionTarget, setResolutionTarget] = useState<WorkQueueItem | null>(null);

  const metrics = viewModel?.metrics ?? {};
  const counts = useMemo(() => deriveWorkQueueCounts(viewModel?.items, metrics), [viewModel?.items, metrics]);

  const metricStrip = useMemo(
    () => [
      { id: "open", label: "Open", value: String(counts.open) },
      { id: "blocked", label: "Blocked", value: String(counts.blocked) },
      { id: "overdue", label: "Overdue", value: String(counts.overdue) },
      { id: "waiting", label: "Waiting", value: String(counts.waiting) },
    ],
    [counts],
  );

  const visibleItems = useMemo(() => {
    const filtered = filterWorkItems(viewModel?.items, filter);
    return sortWorkQueueItems(filtered);
  }, [viewModel?.items, filter]);

  if (!viewModel) return null;

  const relationshipFollowUpOutcomes = (viewModel?.productContext?.installationResult?.relationshipFollowUpOutcomes ?? []) as RelationshipFollowUpOutcome[];

  const emptyCopy =
    filter === "blocked"
      ? "No blocked work right now."
      : filter === "overdue"
        ? "No overdue work right now."
        : filter === "open"
          ? "No open work right now."
          : "Work handled by your team and digital employees will appear here.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <PageHeader
        title="Work"
        description="Work VIBETech is tracking across your business."
      />

      <ShellMetricStrip metrics={metricStrip} />

      <ShellPanel
        title="Active work queue"
        subtitle={`${counts.all} active item${counts.all === 1 ? "" : "s"}`}
        action={<FilterChips active={filter} counts={counts} onSelect={setFilter} />}
      >
        {visibleItems.length === 0 ? (
          <PanelEmpty description={emptyCopy} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visibleItems.map((item) => (
              <WorkQueueRow key={String(item.id)} item={item} businessId={businessId} onResolveFollowUp={setResolutionTarget} />
            ))}
          </div>
        )}
      </ShellPanel>

      {resolutionTarget ? (
        <RelationshipFollowUpResolutionDialog
          businessId={businessId}
          work={resolutionTarget}
          outcomes={relationshipFollowUpOutcomes}
          onClose={() => setResolutionTarget(null)}
        />
      ) : null}
    </div>
  );
}
