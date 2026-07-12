"use client";

import Link from "next/link";

import { cockpitColors, spacing, typography } from "@/design/tokens";
import { scrubInternalWording, humanizeEnumLabel } from "@/lib/operating/businessLanguage";

export type OperatingActivityEvent = {
  id: string;
  timestamp?: string | null;
  actorLabel?: string | null;
  title: string;
  description?: string | null;
  href?: string | null;
  state?: string | null;
  steps?: Array<{ id: string; label: string; done?: boolean }>;
};

/**
 * Chronological, evidence-backed operating feed.
 * Presentation only — callers must supply already-projected events.
 */
export default function OperatingActivityFeed({
  events,
  emptyLabel = "No new operating activity since your last visit.",
  headingId,
}: {
  events: OperatingActivityEvent[];
  emptyLabel?: string;
  headingId?: string;
}) {
  if (!events.length) {
    return (
      <p style={{ margin: 0, color: cockpitColors.textMuted }} id={headingId ? `${headingId}-empty` : undefined}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ol
      style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: spacing.md }}
      aria-labelledby={headingId}
    >
      {events.map((event) => (
        <li
          key={event.id}
          style={{
            display: "grid",
            gap: 4,
            paddingBottom: spacing.sm,
            borderBottom: `1px solid ${cockpitColors.panelBorder}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
            <strong style={{ color: cockpitColors.textPrimary, fontSize: typography.body.fontSize }}>
              {event.href ? (
                <Link href={event.href} style={{ color: "inherit", textDecoration: "none" }}>
                  {scrubInternalWording(event.title)}
                </Link>
              ) : (
                scrubInternalWording(event.title)
              )}
            </strong>
            {event.timestamp ? (
              <time
                dateTime={event.timestamp}
                style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}
              >
                {formatWhen(event.timestamp)}
              </time>
            ) : null}
          </div>
          <div style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
            {[
              event.actorLabel ? scrubInternalWording(event.actorLabel) : null,
              event.state ? humanizeEnumLabel(event.state) : null,
            ].filter(Boolean).join(" · ")}
          </div>
          {event.description ? (
            <div style={{ color: cockpitColors.textSecondary, fontSize: typography.body.fontSize }}>
              {scrubInternalWording(event.description)}
            </div>
          ) : null}
          {event.steps?.length ? (
            <ul style={{ listStyle: "none", margin: `${spacing.xs} 0 0`, padding: 0, display: "grid", gap: 2 }}>
              {event.steps.map((step) => (
                <li key={step.id} style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textSecondary }}>
                  {step.done ? "✓ " : "○ "}
                  {scrubInternalWording(step.label)}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
