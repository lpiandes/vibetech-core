"use client";

import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectButton } from "./ArchitectPrimitives";
import { executiveBriefing } from "./architectSemantics";
import { hardNavigateToBusinessHome } from "@/lib/builder/hardNavigateToBusinessHome";

export default function ExecutiveBriefing({
  proposal,
  openHref,
  onOpenPortal,
}: {
  proposal?: any;
  openHref?: string | null;
  onOpenPortal: () => void;
}) {
  const briefing = executiveBriefing(proposal);

  function open() {
    if (openHref) {
      hardNavigateToBusinessHome(openHref);
      return;
    }
    onOpenPortal();
  }

  return (
    <div style={{
      display: "grid",
      gap: 20,
      textAlign: "left",
      animation: "architectFadeUp .55s ease",
    }}>
      <div style={{ display: "grid", gap: 10 }}>
        <ArchitectBadge tone="success">Ready</ArchitectBadge>
        <h1 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.08 }}>
          {briefing.businessName}
        </h1>
        <p style={{ margin: 0, color: architect.inkMuted, fontSize: 17, lineHeight: 1.55, maxWidth: 640 }}>
          {briefing.summary}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        {briefing.highlights.map((item) => (
          <div key={item.id} style={{
            borderRadius: architect.radiusSm,
            border: `1px solid ${architect.border}`,
            background: "rgba(15,23,42,.5)",
            padding: 14,
          }}>
            <div style={{ fontSize: 12, color: architect.inkMuted }}>{item.label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 750, marginTop: 4 }}>{item.value || "—"}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ArchitectButton onClick={open} disabled={!openHref}>
          Open your business
        </ArchitectButton>
      </div>
      {!openHref ? (
        <div style={{ color: architect.inkMuted, fontSize: 13 }}>Portal link will appear once launch finishes.</div>
      ) : null}
    </div>
  );
}
