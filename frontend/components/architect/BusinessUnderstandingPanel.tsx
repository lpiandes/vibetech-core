"use client";

import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectProgress } from "./ArchitectPrimitives";
import { businessUnderstandingCards, discoveryProgress } from "./architectSemantics";

export default function BusinessUnderstandingPanel({
  summary,
  session,
  journey,
}: {
  summary?: Record<string, unknown> | null;
  session?: any;
  journey?: any;
}) {
  const cards = businessUnderstandingCards(summary);
  const progress = discoveryProgress(session);
  const percent = Number(journey?.percent ?? progress.percent ?? 0);
  const found = cards.filter((card) => card.status === "found").length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <ArchitectBadge tone="accent">Business Understanding</ArchitectBadge>
        <h3 style={{ margin: "10px 0 6px", fontSize: 18 }}>What Architect knows so far</h3>
        <ArchitectProgress percent={percent} label={journey?.label ?? progress.label} />
        <div style={{ marginTop: 8, color: architect.inkMuted, fontSize: 13 }}>
          {found} of {cards.length} areas filled in
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {cards.map((card) => (
          <div
            key={card.id}
            style={{
              borderRadius: architect.radiusSm,
              border: `1px solid ${architect.border}`,
              background: card.status === "found" ? "rgba(20,184,166,.08)" : "rgba(15,23,42,.4)",
              padding: 12,
              animation: card.status === "found" ? "architectFadeUp .4s ease" : undefined,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{card.label}</strong>
              <span style={{ fontSize: 12, color: card.status === "found" ? architect.success : architect.inkMuted }}>
                {card.status === "found" ? "Understood" : "Learning"}
              </span>
            </div>
            {card.snippets.length ? (
              <div style={{ marginTop: 6, color: architect.inkMuted, fontSize: 13, lineHeight: 1.45 }}>
                {card.snippets.slice(0, 2).join(" · ")}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
