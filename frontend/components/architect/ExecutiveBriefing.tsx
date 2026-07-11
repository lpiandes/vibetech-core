"use client";

import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectButton } from "./ArchitectPrimitives";
import { executiveBriefing } from "./architectSemantics";

export default function ExecutiveBriefing({
  proposal,
  openHref,
  onOpenPortal,
  onInvite,
  onImprove,
}: {
  proposal?: any;
  openHref?: string | null;
  onOpenPortal: () => void;
  onInvite: () => void;
  onImprove: () => void;
}) {
  const briefing = executiveBriefing(proposal);

  return (
    <div style={{
      display: "grid",
      gap: 20,
      textAlign: "left",
      animation: "architectFadeUp .55s ease",
    }}>
      <div style={{ display: "grid", gap: 10 }}>
        <ArchitectBadge tone="success">Live</ArchitectBadge>
        <h1 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.08 }}>
          {briefing.headline}
        </h1>
        <p style={{ margin: 0, color: architect.inkMuted, fontSize: 17, lineHeight: 1.55, maxWidth: 640 }}>
          <strong style={{ color: architect.ink }}>{briefing.businessName}</strong>
          {" — "}
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

      <div style={{
        borderRadius: architect.radius,
        border: `1px solid rgba(20,184,166,.3)`,
        background: "rgba(20,184,166,.08)",
        padding: 18,
        color: architect.inkMuted,
        lineHeight: 1.55,
      }}>
        Your operating system is ready. Invite the team, walk the home screen, and keep refining with Ask VIBETech —
        Architect already knows this business.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ArchitectButton onClick={onOpenPortal}>Open your business</ArchitectButton>
        <ArchitectButton variant="secondary" onClick={onInvite}>Invite your team</ArchitectButton>
        <ArchitectButton variant="ghost" onClick={onImprove}>Keep improving</ArchitectButton>
      </div>
      {!openHref ? (
        <div style={{ color: architect.inkMuted, fontSize: 13 }}>Portal link will appear once launch finishes.</div>
      ) : null}
    </div>
  );
}
