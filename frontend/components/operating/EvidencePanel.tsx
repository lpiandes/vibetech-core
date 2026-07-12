"use client";

import { cockpitColors, spacing, typography } from "@/design/tokens";

export type EvidenceItem = {
  explanation: string;
  /** Technical refs — only shown behind debug affordance */
  objectType?: string;
  objectId?: string;
  label?: string;
  detail?: string | null;
};

/**
 * Business-language evidence. Hides raw object ids by default.
 */
export default function EvidencePanel({
  items,
  title = "Supporting evidence",
  showTechnical = false,
}: {
  items: EvidenceItem[];
  title?: string;
  showTechnical?: boolean;
}) {
  const cleaned = (items ?? [])
    .map((item) => ({
      text: String(item.explanation || item.label || item.detail || "").trim(),
      technical:
        item.objectType && item.objectId ? `${item.objectType}:${item.objectId}` : item.objectId ?? null,
    }))
    .filter((item) => item.text.length > 0);

  if (cleaned.length === 0) {
    return (
      <div style={{ color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
        No supporting evidence yet.
      </div>
    );
  }

  return (
    <section aria-label={title}>
      <h3
        style={{
          margin: 0,
          fontSize: typography.label.fontSize,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: cockpitColors.textMuted,
        }}
      >
        {title}
      </h3>
      <dl style={{ margin: `${spacing.sm} 0 0`, display: "grid", gap: spacing.sm }}>
        {cleaned.map((item, index) => (
          <div key={`${item.text}-${index}`}>
            <dt className="sr-only">Evidence {index + 1}</dt>
            <dd style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.5, fontSize: typography.body.fontSize }}>
              {item.text}
              {showTechnical && item.technical ? (
                <div style={{ marginTop: 4, fontSize: typography.meta.fontSize, color: cockpitColors.textMuted, fontFamily: "ui-monospace, monospace" }}>
                  {item.technical}
                </div>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
