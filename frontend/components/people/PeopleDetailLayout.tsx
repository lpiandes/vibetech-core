"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import StatusBadge from "@/components/product/StatusBadge";
import EntityAvatar from "@/components/shell/EntityAvatar";
import ShellPanel from "@/components/shell/ShellPanel";
import LinkPropertyPanel from "@/components/people/LinkPropertyPanel";
import type { EngagementViewModel } from "@/lib/workspace/EngagementTypes";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { resolvePeopleDetailNextActionHref, workQueueHrefForPeopleDetail } from "./peopleSemantics";

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

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.65rem", color: cockpitColors.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, color: cockpitColors.textPrimary, fontSize: typography.body.fontSize, lineHeight: 1.5 }}>
        {value}
      </div>
    </div>
  );
}

function workQueueHref(businessId: string, workId?: unknown) {
  return workQueueHrefForPeopleDetail(businessId, workId);
}

function nextActionHref(businessId: string, action?: { sourceType?: string; sourceId?: string } | null) {
  return resolvePeopleDetailNextActionHref(businessId, action);
}

export default function PeopleDetailLayout({
  businessId,
  viewModel,
}: {
  businessId: string;
  viewModel: EngagementViewModel;
}) {
  const party = viewModel.party as Record<string, unknown>;
  const partyName = String(party.displayName ?? viewModel.partyId);
  const presentation =
    (viewModel as { productContext?: { installationResult?: { executiveExperience?: { dashboardPresentation?: Record<string, unknown> } } } })
      .productContext?.installationResult?.executiveExperience?.dashboardPresentation ??
    (viewModel as { productContext?: { installationResult?: { dashboardPresentation?: Record<string, unknown> } } })
      .productContext?.installationResult?.dashboardPresentation ??
    {};

  const installationResult = (viewModel as { productContext?: { installationResult?: Record<string, unknown> } })
    .productContext?.installationResult;

  const relationshipLabel = viewModel.relationshipSummary
    .map((rel) => String((rel as Record<string, unknown>).relationshipLabel ?? ""))
    .filter(Boolean)
    .join(" · ");

  const qualificationFieldLabels = (
    (installationResult?.qualificationFieldSchemas as Array<{ fields?: Array<{ key: string; label: string }> }> | undefined) ??
    []
  )
    .flatMap((schema) => schema.fields ?? [])
    .reduce<Record<string, string>>((acc, field) => {
      acc[field.key] = field.label;
      return acc;
    }, {});

  const persistedQualificationEntries = viewModel.qualificationSummary.flatMap((entry) => {
    const qualification = (entry as { qualification?: Record<string, unknown> }).qualification ?? {};
    return Object.entries(qualification)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      .map(([key, value]) => ({
        key,
        label: qualificationFieldLabels[key] ?? key.replace(/_/g, " "),
        value: String(value),
      }));
  });

  const hasPersistedQualification = persistedQualificationEntries.length > 0;

  const partyTypeLabels = (presentation.partyTypeLabels as Record<string, string> | undefined) ?? {};
  const partyTypeLabel =
    partyTypeLabels[String(party.partyType ?? "")] ??
    null;

  const contactMethods = Array.isArray(party.contactMethods) ? party.contactMethods.map(String) : [];
  const email = contactMethods.find((method) => method.includes("@")) ?? null;
  const phone = contactMethods.find((method) => !method.includes("@") && /\d/.test(method)) ?? null;
  const needsAttention = viewModel.attention.items.length > 0;
  const primaryNextAction = viewModel.nextActions[0] ?? null;
  const primaryNextActionHref = nextActionHref(businessId, primaryNextAction);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <Link
        href={`/b/${businessId}/people`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: cockpitColors.textMuted,
          textDecoration: "none",
          fontSize: typography.caption.fontSize,
          width: "fit-content",
        }}
      >
        <ArrowLeft size={14} />
        People
      </Link>

      <div style={{ display: "flex", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" }}>
        <EntityAvatar name={partyName} kind="person" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: typography.sectionTitle.fontSize, color: cockpitColors.textPrimary }}>
            {partyName}
          </div>
          <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
            {relationshipLabel || partyTypeLabel || "Contact"}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
              flexWrap: "wrap",
              marginTop: spacing.sm,
            }}
          >
            {needsAttention ? <StatusBadge label="Needs attention" tone="warning" /> : null}
            {primaryNextAction ? (
              primaryNextActionHref ? (
                <Link
                  href={primaryNextActionHref}
                  aria-label={`${primaryNextAction.title} in Work`}
                  style={{ display: "inline-flex", textDecoration: "none" }}
                >
                  <StatusBadge label={primaryNextAction.title} tone="info" />
                </Link>
              ) : (
                <StatusBadge label={primaryNextAction.title} tone="info" />
              )
            ) : null}
          </div>
          <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
            {viewModel.attention.summary}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)",
          gap: spacing.md,
          alignItems: "start",
        }}
      >
        <ShellPanel title="Activity timeline" subtitle="Recent relationship activity for this contact">
          {viewModel.timeline.length === 0 ? (
            <PanelEmpty description="No recorded activity for this contact yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {viewModel.timeline.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: spacing.md,
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  }}
                >
                  <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{item.title}</div>
                  <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
                    {(item as { occurredAtLabel?: string }).occurredAtLabel ?? item.occurredAt}
                  </div>
                  <div style={{ marginTop: spacing.xs, color: cockpitColors.textSecondary, fontSize: typography.body.fontSize, lineHeight: 1.5 }}>
                    {item.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ShellPanel>

        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <ShellPanel title="Contact">
            <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
              <ContextField label="Name" value={partyName} />
              <ContextField label="Email" value={email ?? "—"} />
              <ContextField label="Phone" value={phone ?? "—"} />
            </div>
          </ShellPanel>

          {viewModel.relationshipSummary.length > 0 ? (
            <ShellPanel title="Classifications">
              <div style={{ display: "flex", flexDirection: "column" }}>
                {viewModel.relationshipSummary.map((rel) => {
                  const record = rel as Record<string, unknown>;
                  const label = String(record.relationshipLabel ?? record.relationshipType ?? "Relationship");
                  const status = String(record.status ?? "active");
                  const ended = status === "ended";
                  const effectiveTo = record.effectiveTo ? String(record.effectiveTo) : null;
                  return (
                    <div
                      key={String(record.id ?? `${label}-${status}`)}
                      style={{
                        padding: spacing.md,
                        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: spacing.sm,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{label}</div>
                        {ended && effectiveTo ? (
                          <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
                            Ended {effectiveTo}
                          </div>
                        ) : null}
                      </div>
                      <StatusBadge label={ended ? "Ended" : "Active"} tone={ended ? "neutral" : "success"} />
                    </div>
                  );
                })}
              </div>
            </ShellPanel>
          ) : null}

          {hasPersistedQualification ? (
            <ShellPanel title="Qualification">
              <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
                {persistedQualificationEntries.map((entry) => (
                  <ContextField key={entry.key} label={entry.label} value={entry.value} />
                ))}
              </div>
            </ShellPanel>
          ) : null}

          <ShellPanel title="Linked records">
            <div style={{ padding: spacing.md }}>
              <LinkPropertyPanel
                businessId={businessId}
                partyId={String(viewModel.partyId)}
                linkedSubjects={viewModel.subjects as Array<{ id?: string; displayName?: string }>}
              />
            </div>
          </ShellPanel>

          <ShellPanel title="Open requests and work">
            {viewModel.openRequests.length === 0 && viewModel.openWork.length === 0 ? (
              <PanelEmpty description="No open requests or work for this contact." />
            ) : (
              <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
                {viewModel.openRequests.length > 0 ? (
                  <div>
                    <div style={{ fontSize: typography.caption.fontSize, fontWeight: 600, color: cockpitColors.textMuted }}>
                      Open requests ({viewModel.openRequests.length})
                    </div>
                    <ul style={{ margin: `${spacing.xs} 0 0`, paddingLeft: spacing.lg, color: cockpitColors.textSecondary }}>
                      {viewModel.openRequests.map((req) => (
                        <li key={String(req.id)} style={{ marginBottom: spacing.xs }}>
                          {String((req as { title?: string }).title ?? "Request")}
                          {(req as { requestTypeLabel?: string }).requestTypeLabel
                            ? ` · ${(req as { requestTypeLabel?: string }).requestTypeLabel}`
                            : ""}
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
                    <ul style={{ margin: `${spacing.xs} 0 0`, paddingLeft: spacing.lg, color: cockpitColors.textSecondary }}>
                      {viewModel.openWork.map((work) => (
                        <li key={String(work.id)} style={{ marginBottom: spacing.xs }}>
                          <Link
                            href={workQueueHref(businessId, work.id)}
                            style={{ color: cockpitColors.accent, fontWeight: 650, textDecoration: "none" }}
                          >
                            {String((work as { title?: string }).title ?? "Work item")}
                          </Link>
                          {(work as { subjectName?: string }).subjectName ? ` · ${(work as { subjectName?: string }).subjectName}` : ""}
                          {(work as { workTypeLabel?: string }).workTypeLabel
                            ? ` · ${(work as { workTypeLabel?: string }).workTypeLabel}`
                            : ""}
                          {(work as { assigneeName?: string }).assigneeName
                            ? ` · Assigned to ${(work as { assigneeName?: string }).assigneeName}`
                            : " · Not assigned"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </ShellPanel>

          {viewModel.nextActions.length > 0 ? (
            <ShellPanel title="What happens next">
              <div style={{ display: "flex", flexDirection: "column" }}>
                {viewModel.nextActions.map((action) => (
                  <div key={action.id} style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                    <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{action.title}</div>
                    <div style={{ marginTop: spacing.xs, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: 1.5 }}>
                      {action.description}
                    </div>
                    {String((action as { sourceType?: string }).sourceType ?? "") === "work" ? (
                      <Link
                        href={workQueueHref(businessId, (action as { sourceId?: string }).sourceId)}
                        style={{
                          display: "inline-flex",
                          marginTop: spacing.sm,
                          color: cockpitColors.accent,
                          fontSize: typography.caption.fontSize,
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        Open Work
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </ShellPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
