"use client";

import { useMemo, useState } from "react";
import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectButton } from "./ArchitectPrimitives";
import { ARCHITECT_PREVIEW_ROLES, aiEmployeePersonas } from "./architectSemantics";

type PreviewRole = "OWNER" | "MANAGER" | "EMPLOYEE";

export default function PortalPreviewImmersive({
  portalPreview,
  proposal,
  previewRole,
  onRoleChange,
  accentColor,
  busy,
  onPrepareLaunch,
}: {
  portalPreview: any;
  proposal?: any;
  previewRole: PreviewRole;
  onRoleChange: (role: PreviewRole) => void;
  accentColor: string;
  busy?: boolean;
  onPrepareLaunch?: () => void;
}) {
  const personas = useMemo(
    () => aiEmployeePersonas({
      portalWorkforce: portalPreview?.digitalWorkforce,
      proposalWorkforce: proposal?.views?.digitalWorkforce,
    }),
    [portalPreview, proposal],
  );
  const [personaId, setPersonaId] = useState<string | null>(null);
  const activePersona = personas.find((entry) => entry.id === personaId) ?? null;
  const mode = activePersona ? "ai" : "human";

  const nav = portalPreview?.sidebar?.primary ?? [];
  const overflow = portalPreview?.sidebar?.overflow ?? [];
  const cards = portalPreview?.dashboard?.cards ?? [];
  const businessName = portalPreview?.appearance?.businessName
    ?? proposal?.businessName
    ?? "Your business";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <ArchitectBadge tone="accent">Home preview</ArchitectBadge>
          <h2 style={{ margin: "8px 0 0", fontFamily: architect.display, fontSize: 28 }}>
            See it as your team will
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ARCHITECT_PREVIEW_ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setPersonaId(null);
                onRoleChange(role.id as PreviewRole);
              }}
              style={chip(previewRole === role.id && mode === "human")}
            >
              {role.label}
            </button>
          ))}
          {personas.slice(0, 4).map((persona) => (
            <button
              key={persona.id}
              type="button"
              disabled={busy}
              onClick={() => setPersonaId(persona.id)}
              style={chip(personaId === persona.id)}
            >
              {persona.name}
            </button>
          ))}
        </div>
      </div>

      <div
        key={`${previewRole}-${personaId ?? "human"}`}
        className="architect-preview-grid"
        style={{
          borderRadius: architect.radius,
          overflow: "hidden",
          border: `1px solid ${architect.border}`,
          background: "#F8FAFC",
          color: architect.inkDark,
          boxShadow: architect.shadowLight,
          animation: "architectCrossfade .35s ease",
        }}
      >
        <aside style={{
          background: "#0F171C",
          color: "#E8EEF2",
          padding: 18,
          display: "grid",
          gap: 10,
          alignContent: "start",
        }}>
          <div style={{ fontWeight: 750, letterSpacing: "-0.02em" }}>{businessName}</div>
          <div style={{ fontSize: 12, color: "rgba(226,232,240,.6)" }}>
            {mode === "ai" ? `AI · ${activePersona?.name}` : portalPreview?.roleLabel ?? previewRole}
          </div>
          {(mode === "human" ? nav : [{ label: "Briefing" }, { label: "Approvals" }, { label: "Knowledge" }]).map((item: any, index: number) => (
            <div
              key={`${item.label}-${index}`}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: index === 0 ? "rgba(20,184,166,.18)" : "transparent",
                borderLeft: index === 0 ? `3px solid ${accentColor}` : "3px solid transparent",
                fontSize: 14,
              }}
            >
              {item.label}
            </div>
          ))}
          {mode === "human" && overflow.length ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(226,232,240,.5)" }}>
              More · {overflow.map((item: any) => item.label).join(", ")}
            </div>
          ) : null}
        </aside>

        <main style={{ padding: 22, display: "grid", gap: 16, background: "linear-gradient(180deg,#F7F8F6,#EEF3F1)" }}>
          {mode === "ai" && activePersona ? (
            <>
              <h3 style={{ margin: 0, fontFamily: architect.display, fontSize: 26 }}>{activePersona.name}</h3>
              <p style={{ margin: 0, color: architect.mutedDark, lineHeight: 1.5 }}>{activePersona.purpose}</p>
              <Section title="Responsibilities" items={activePersona.responsibilities} />
              <Section title="Needs approval for" items={activePersona.approvals} />
              <Section title="Knowledge they use" items={activePersona.knowledge} />
              <div style={{ fontSize: 13, color: architect.mutedDark }}>Readiness · {activePersona.readiness}</div>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, fontFamily: architect.display, fontSize: 26 }}>Home</h3>
              <p style={{ margin: 0, color: architect.mutedDark }}>
                What {portalPreview?.roleLabel ?? "this role"} sees first each day.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                {cards.length ? cards.map((card: any) => (
                  <div key={card.id ?? card.title} style={{
                    background: "#fff",
                    borderRadius: 16,
                    border: "1px solid rgba(15,23,42,.08)",
                    padding: 16,
                    minHeight: 110,
                  }}>
                    <div style={{ fontWeight: 700 }}>{card.title}</div>
                    <div style={{ color: architect.mutedDark, fontSize: 13, marginTop: 8 }}>
                      {card.emptyState ?? "Ready when your data arrives."}
                    </div>
                  </div>
                )) : (
                  <div style={{ color: architect.mutedDark }}>Home screens appear after Architect proposes dashboards.</div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {personas.length ? (
        <div style={{ color: architect.inkMuted, fontSize: 13 }}>
          Tip: choose an AI teammate above to preview what they watch and when they need you.
        </div>
      ) : null}

      {onPrepareLaunch ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <ArchitectButton onClick={onPrepareLaunch}>
            Looks good — prepare to launch
          </ArchitectButton>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: architect.mutedDark, lineHeight: 1.55 }}>
        {items.slice(0, 6).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function chip(active: boolean) {
  return {
    borderRadius: 999,
    border: `1px solid ${active ? architect.accent : architect.border}`,
    background: active ? architect.accentSoft : "transparent",
    color: architect.ink,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
  } as const;
}
