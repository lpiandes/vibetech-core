"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";

import type { EngagementPartyIndexViewModel } from "@/lib/workspace/EngagementTypes";
import { ProductPage, PageHeader, Section, EmptyState } from "@/components/product";
import StatusPill from "@/components/executive/StatusPill";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export default function EngagementPartyIndex({ index }: { index: EngagementPartyIndexViewModel }) {
  const [query, setQuery] = useState("");
  const parties = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.parties;
    return index.parties.filter(
      (party) =>
        party.displayName.toLowerCase().includes(q) ||
        (party as any).relationshipLabels?.some((r: string) => r.toLowerCase().includes(q)) ||
        (party as any).primarySubjectName?.toLowerCase().includes(q),
    );
  }, [index.parties, query]);

  return (
    <ProductPage>
      <PageHeader title="People" />

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or relationship"
        style={{
          width: "100%",
          padding: `${spacing.sm} ${spacing.md}`,
          borderRadius: radius.medium,
          border: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panel,
          fontSize: typography.body.fontSize,
          color: cockpitColors.textPrimary,
        }}
      />

      <Section title="Everyone" noBorder>
        {parties.length === 0 ? (
          <div style={{ borderRadius: radius.large, border: `1px solid ${cockpitColors.panelBorder}`, background: cockpitColors.panel }}>
            <EmptyState
              icon={<Users size={32} strokeWidth={1.5} />}
              title={query ? "No matches" : "No people yet"}
              description={query ? "Try a different search." : "Residents, prospects, owners, and vendors will appear here."}
            />
          </div>
        ) : (
          <div style={{ borderRadius: radius.large, border: `1px solid ${cockpitColors.panelBorder}`, background: cockpitColors.panel, overflow: "hidden" }}>
            {parties.map((party, partyIndex) => {
              const p = party as any;
              const relationshipText = p.relationshipLabels?.length ? p.relationshipLabels.join(" · ") : p.partyTypeLabel ?? null;
              return (
                <div
                  key={party.partyId}
                  style={{
                    padding: `${spacing.md} ${spacing.lg}`,
                    borderBottom: partyIndex < parties.length - 1 ? `1px solid ${cockpitColors.panelBorder}` : undefined,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: spacing.md,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <Link
                      href={party.href}
                      style={{ color: cockpitColors.textPrimary, textDecoration: "none", fontWeight: 650, fontSize: typography.body.fontSize }}
                    >
                      {party.displayName}
                    </Link>
                    {relationshipText ? (
                      <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{relationshipText}</div>
                    ) : null}
                    {p.primarySubjectName ? (
                      <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>{p.primarySubjectName}</div>
                    ) : null}
                  </div>
                  {p.attentionRequired ? <StatusPill tone="warning" label="Needs attention" /> : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </ProductPage>
  );
}
