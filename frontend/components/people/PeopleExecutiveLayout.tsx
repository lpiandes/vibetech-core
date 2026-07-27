"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import PageHeader from "@/components/product/PageHeader";
import { SimpleEmpty, SimplePanel, simplePageStyle } from "@/components/product/SimpleUI";
import StatusBadge from "@/components/product/StatusBadge";
import EntityAvatar from "@/components/shell/EntityAvatar";
import RelationshipFollowUpQueue from "@/components/people/RelationshipFollowUpQueue";
import { useBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { useWorkspaceNavigation } from "@/components/workspace/WorkspaceNavigationContext";
import type { EngagementPartyIndexViewModel } from "@/lib/workspace/EngagementTypes";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import {
  contactLine,
  derivePeopleCounts,
  filterPeople,
  needsAttention,
  resolvePeopleFilters,
  relationshipText,
  searchPeople,
  sortPeople,
  type PeopleFilter,
  type PeopleFilterDefinition,
  type PeopleIndexItem,
} from "./peopleSemantics";

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

function FilterChips({
  active,
  counts,
  filters,
  onSelect,
}: {
  active: PeopleFilter;
  counts: Record<string, number>;
  filters: PeopleFilterDefinition[];
  onSelect: (filter: PeopleFilter) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.xs }} aria-label="People filters">
      {filters.map((filter) => {
        const selected = active === filter.id;
        const count = counts[filter.id];

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

function PersonRow({
  party,
  businessId,
  onNavigate,
}: {
  party: PeopleIndexItem;
  businessId: string;
  onNavigate: (href: string) => void;
}) {
  const href = party.href ?? (party.partyId ? `/b/${businessId}/people/${party.partyId}` : null);
  const relationships = relationshipText(party);
  const contact = contactLine(party);
  const meta = contact || relationships;
  // A linked record might be a patient, player, team, or another business
  // object. Do not send a universal People screen into the legacy property UI.
  const subjectHref = null;
  const showAttention = needsAttention(party);

  const rowBody = (
    <>
      <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
        <EntityAvatar name={String(party.displayName ?? "Contact")} kind="person" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>
              {party.displayName}
            </div>
            {party.primarySubjectName ? (
              <SubjectChip name={String(party.primarySubjectName)} href={subjectHref} />
            ) : null}
          </div>
          {meta ? (
            <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{meta}</div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: spacing.xs, flexShrink: 0 }}>
        {showAttention ? <StatusBadge label="Needs attention" tone="warning" /> : null}
        {href ? <ChevronRight size={16} color={cockpitColors.textMuted} aria-hidden /> : null}
      </div>
    </>
  );

  const rowStyle = {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    gap: spacing.md,
    alignItems: "center" as const,
    padding: spacing.md,
    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
    textDecoration: "none" as const,
    color: "inherit" as const,
    cursor: href ? "pointer" : "default",
    transition: "background-color 120ms ease",
  };

  if (href) {
    return (
      <Link
        href={href}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          onNavigate(href);
        }}
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

export default function PeopleExecutiveLayout({ index }: { index: EngagementPartyIndexViewModel }) {
  const { businessId } = useBusinessScope();
  const { beginNavigation } = useWorkspaceNavigation();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PeopleFilter>("all");
  const peopleFilters = useMemo(() => resolvePeopleFilters(index.peopleFilters), [index.peopleFilters]);

  const counts = useMemo(() => derivePeopleCounts(index.parties, peopleFilters), [index.parties, peopleFilters]);

  const visiblePeople = useMemo(() => {
    const searched = searchPeople(index.parties, query);
    const filtered = filterPeople(searched, filter, peopleFilters);
    return sortPeople(filtered);
  }, [index.parties, query, filter, peopleFilters]);

  const activeFilterLabel = peopleFilters.find((entry) => entry.id === filter)?.label ?? "this filter";
  const emptyCopy = query
    ? "No matches."
    : filter === "all"
      ? "No people yet."
      : `No ${activeFilterLabel.toLowerCase()}.`;

  return (
    <div style={simplePageStyle}>
      <PageHeader title="People" />

      <RelationshipFollowUpQueue
        businessId={businessId}
        candidates={index.relationshipFollowUps?.candidates ?? []}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.sm,
          padding: `${spacing.sm} ${spacing.md}`,
          borderRadius: radius.large,
          border: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panel,
        }}
      >
        <Search size={16} color={cockpitColors.textMuted} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
          aria-label="Search people"
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: typography.body.fontSize,
            color: cockpitColors.textPrimary,
          }}
        />
      </div>

      <SimplePanel
        title="People"
        action={<FilterChips active={filter} counts={counts.filters} filters={peopleFilters} onSelect={setFilter} />}
      >
        {visiblePeople.length === 0 ? (
          <SimpleEmpty>{emptyCopy}</SimpleEmpty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visiblePeople.map((party) => (
              <PersonRow
                key={String(party.partyId)}
                party={party}
                businessId={businessId}
                onNavigate={beginNavigation}
              />
            ))}
          </div>
        )}
      </SimplePanel>
    </div>
  );
}
