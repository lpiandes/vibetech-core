"use client";

import { useMemo, useState } from "react";
import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectButton } from "./ArchitectPrimitives";
import {
  ARCHITECT_PROPOSAL_SECTIONS,
  HUMAN_COPY,
  humanizeToken,
  proposalSectionView,
} from "./architectSemantics";

export default function ProposalStudio({
  proposal,
  accentColor,
  onAccent,
  onRenameNav,
  onPreview,
  onPrepareLaunch,
  busy,
}: {
  proposal: any;
  accentColor: string;
  onAccent: (color: string) => void;
  onRenameNav: (moduleId: string, label: string) => void;
  onPreview: () => void;
  onPrepareLaunch: () => void;
  busy?: boolean;
}) {
  const [sectionId, setSectionId] = useState("overview");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  const availableSections = useMemo(() => {
    return ARCHITECT_PROPOSAL_SECTIONS.filter((section) => {
      if (section.id === "overview") return true;
      const { view } = proposalSectionView(section.id, proposal);
      if (!view) return false;
      if (Array.isArray(view.items) && view.items.length === 0) return false;
      return true;
    });
  }, [proposal]);

  const { section, view } = proposalSectionView(sectionId, proposal);
  const items = Array.isArray(view?.items) ? view.items : Array.isArray(view?.cards) ? view.cards : [];
  const bullets = Array.isArray(view?.bullets) ? view.bullets : [];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <ArchitectBadge tone="accent">Your plan</ArchitectBadge>
        <h2 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}>
          {proposal?.businessName ?? "Your Business Operating System"}
        </h2>
        <p style={{ margin: 0, color: architect.inkMuted, fontSize: 16, lineHeight: 1.55, maxWidth: 720 }}>
          {proposal?.explanation?.summary
            ?? "A complete operating system tailored to how your business works — ready for your review."}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {availableSections.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setSectionId(entry.id)}
            style={{
              borderRadius: 999,
              border: `1px solid ${sectionId === entry.id ? architect.accent : architect.border}`,
              background: sectionId === entry.id ? architect.accentSoft : "transparent",
              color: architect.ink,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: sectionId === entry.id ? 700 : 500,
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div style={{
        borderRadius: architect.radius,
        border: `1px solid ${architect.border}`,
        background: "rgba(15,23,42,.42)",
        padding: 20,
        display: "grid",
        gap: 12,
        animation: "architectFadeUp .35s ease",
      }}>
        <h3 style={{ margin: 0 }}>{section.label}</h3>
        {view?.title ? <div style={{ color: architect.inkMuted }}>{view.title}</div> : null}

        {sectionId === "overview" && (proposal?.explanation?.sections ?? []).length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {proposal.explanation.sections.map((entry: any, index: number) => (
              <div key={`${entry.title}-${index}`} style={card}>
                <div style={{ fontWeight: 700 }}>{entry.title}</div>
                <div style={{ color: architect.inkMuted, marginTop: 4, lineHeight: 1.5 }}>{entry.body}</div>
              </div>
            ))}
          </div>
        ) : null}

        {bullets.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: architect.inkMuted, lineHeight: 1.6 }}>
            {bullets.map((bullet: string) => <li key={bullet}>{bullet}</li>)}
          </ul>
        ) : null}

        {items.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((item: any, index: number) => {
              const id = String(item.id ?? item.moduleId ?? item.employeeId ?? index);
              const label = String(item.label ?? item.title ?? item.name ?? humanizeToken(id));
              const canRename = sectionId === "navigation";
              return (
                <div key={id} style={card}>
                  {editingId === id ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        value={draftLabel}
                        onChange={(event) => setDraftLabel(event.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 160,
                          borderRadius: 10,
                          border: `1px solid ${architect.border}`,
                          background: "rgba(2,6,23,.45)",
                          color: architect.ink,
                          padding: "8px 10px",
                        }}
                      />
                      <ArchitectButton
                        onClick={() => {
                          onRenameNav(id, draftLabel.trim() || label);
                          setEditingId(null);
                        }}
                      >
                        Save
                      </ArchitectButton>
                      <ArchitectButton variant="ghost" onClick={() => setEditingId(null)}>Cancel</ArchitectButton>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{label}</div>
                        {item.purpose || item.emptyState || item.description ? (
                          <div style={{ color: architect.inkMuted, fontSize: 13, marginTop: 4 }}>
                            {item.purpose ?? item.emptyState ?? item.description}
                          </div>
                        ) : null}
                      </div>
                      {canRename ? (
                        <ArchitectButton
                          variant="ghost"
                          onClick={() => {
                            setEditingId(id);
                            setDraftLabel(label);
                          }}
                        >
                          Rename
                        </ArchitectButton>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {!items.length && !bullets.length && sectionId !== "overview" ? (
          <div style={{ color: architect.inkMuted }}>Nothing to show in this section yet.</div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: architect.inkMuted, fontSize: 13 }}>
          Accent
          <input
            type="color"
            value={accentColor}
            onChange={(event) => onAccent(event.target.value)}
            style={{ width: 36, height: 28, border: "none", background: "transparent" }}
          />
        </label>
        <ArchitectButton disabled={busy} onClick={onPreview}>{HUMAN_COPY.previewPortal}</ArchitectButton>
        <ArchitectButton variant="secondary" disabled={busy} onClick={onPrepareLaunch}>
          {HUMAN_COPY.prepareLaunch}
        </ArchitectButton>
      </div>
    </div>
  );
}

const card = {
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(2,6,23,.35)",
  padding: 12,
};
