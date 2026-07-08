"use client";

import Link from "next/link";

import StatusPill from "@/components/executive/StatusPill";
import type { EngagementViewModel } from "@/lib/workspace/EngagementTypes";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

function humanNoteStyle() {
  return {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderLeft: `3px solid ${cockpitColors.accent}`,
    backgroundColor: cockpitColors.panelElevated,
    fontStyle: "italic" as const,
    lineHeight: 1.5,
    color: cockpitColors.textSecondary,
  };
}

export default function EngagementPartyDetail({ viewModel }: { viewModel: EngagementViewModel }) {
  const partyName = String(viewModel.party.displayName ?? viewModel.partyId);
  const relationshipLabel = viewModel.relationshipSummary
    .map((rel) => String((rel as Record<string, unknown>).relationshipLabel ?? ""))
    .filter(Boolean)
    .join(" · ");
  const presentation = (viewModel as any).productContext?.installationResult?.executiveExperience?.dashboardPresentation ?? {};
  const partyTypeLabel =
    presentation?.partyTypeLabels?.[String(viewModel.party.partyType ?? "")] ??
    String(viewModel.party.partyType ?? "").replace(/_/g, " ").toLowerCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.lg }}>
      <Link href="/engagement" style={{ color: cockpitColors.accent, textDecoration: "none", fontSize: typography.caption.fontSize }}>
        ← All people
      </Link>

      <div
        style={{
          padding: spacing.md,
          borderRadius: radius.large,
          border: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panel,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.lg, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "1.35rem", fontWeight: 650, color: cockpitColors.textPrimary }}>{partyName}</div>
            <div style={{ marginTop: spacing.xs, color: cockpitColors.textSecondary, fontSize: typography.body.fontSize }}>
              {relationshipLabel || partyTypeLabel}
            </div>
            <div style={{ marginTop: spacing.sm, color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>{viewModel.attention.summary}</div>
          </div>
          {viewModel.nextActions[0] ? <StatusPill tone="neutral" label={viewModel.nextActions[0].title} /> : null}
        </div>
      </div>

      <section
        style={{
          borderRadius: radius.large,
          border: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panel,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
          <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>Current business context</div>
        </div>
        <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
          {viewModel.subjects.length > 0 ? (
            <div>
              <div style={{ fontSize: typography.caption.fontSize, fontWeight: 600, color: cockpitColors.textMuted }}>Related subjects</div>
              <ul style={{ marginTop: spacing.xs, paddingLeft: spacing.lg, color: cockpitColors.textSecondary }}>
                {viewModel.subjects.map((subject) => (
                  <li key={String(subject.id)}>{String(subject.displayName)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {viewModel.openRequests.length > 0 ? (
            <div>
              <div style={{ fontSize: typography.caption.fontSize, fontWeight: 600, color: cockpitColors.textMuted }}>
                Open requests ({viewModel.openRequests.length})
              </div>
              <ul style={{ marginTop: spacing.xs, paddingLeft: spacing.lg, color: cockpitColors.textSecondary }}>
                {viewModel.openRequests.map((req) => (
                  <li key={String(req.id)}>
                    {String(req.title)}
                    <span style={{ color: cockpitColors.textMuted }}> · {(req as any).requestTypeLabel ?? "Request"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {viewModel.openWork.length > 0 ? (
            <div>
              <div style={{ fontSize: typography.caption.fontSize, fontWeight: 600, color: cockpitColors.textMuted }}>
                Open work ({viewModel.openWork.length})
              </div>
              <ul style={{ marginTop: spacing.xs, paddingLeft: spacing.lg, color: cockpitColors.textSecondary }}>
                {viewModel.openWork.map((work) => (
                  <li key={String(work.id)}>
                    {String(work.title)}
                    {(work as any).subjectName ? ` · ${(work as any).subjectName}` : ""}
                    {(work as any).workTypeLabel ? ` · ${(work as any).workTypeLabel}` : ""}
                    {(work as any).assigneeName ? ` · ${(work as any).assigneeName}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {viewModel.timeline.length > 0 ? (
        <section
          style={{
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panel,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
            <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>Timeline</div>
          </div>
          {viewModel.timeline.map((item) => (
            <div key={item.id} style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
              <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{item.title}</div>
              <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
                {(item as any).occurredAtLabel ?? item.occurredAt}
              </div>
              <div style={{ marginTop: spacing.xs, color: cockpitColors.textSecondary, fontSize: typography.body.fontSize }}>{item.description}</div>
              {item.type.includes("NOTE") ? <div style={humanNoteStyle()}>{item.description}</div> : null}
            </div>
          ))}
        </section>
      ) : null}

      {viewModel.nextActions.length > 0 ? (
        <section
          style={{
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panel,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
            <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>What happens next</div>
          </div>
          {viewModel.nextActions.map((action) => (
            <div key={action.id} style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
              <strong style={{ color: cockpitColors.textPrimary }}>{action.title}</strong>
              <div style={{ marginTop: spacing.xs, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>{action.description}</div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
