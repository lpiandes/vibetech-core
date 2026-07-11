"use client";

import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectButton } from "./ArchitectPrimitives";
import { HUMAN_COPY, assemblyStagesFromProposal } from "./architectSemantics";

export default function OsAssemblyCanvas({
  proposal,
  readyForProposal,
  busy,
  onPropose,
  onOpenProposal,
}: {
  proposal?: any;
  readyForProposal?: boolean;
  busy?: boolean;
  onPropose?: () => void;
  onOpenProposal?: () => void;
}) {
  const stages = assemblyStagesFromProposal(proposal);
  const hasProposal = Boolean(proposal?.views);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <ArchitectBadge tone="accent">Operating system assembly</ArchitectBadge>
        <h2 style={{ margin: "10px 0 6px", fontFamily: architect.display, fontSize: 28 }}>
          {hasProposal ? "Your system is taking shape" : "Ready when you are"}
        </h2>
        <p style={{ margin: 0, color: architect.inkMuted, lineHeight: 1.5 }}>
          {hasProposal
            ? "Architect assembled a reusable plan from what it learned — nothing is live until you approve."
            : "When Architect understands enough, it will propose a complete operating system for your business."}
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: architect.radiusSm,
              border: `1px solid ${stage.ready ? "rgba(20,184,166,.35)" : architect.border}`,
              background: stage.ready ? "rgba(20,184,166,.08)" : "rgba(15,23,42,.4)",
              animation: stage.ready ? `architectAssembleIn .45s ease ${index * 0.05}s both` : undefined,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{stage.label}</div>
              <div style={{ color: architect.inkMuted, fontSize: 13 }}>
                {stage.ready
                  ? stage.count > 1 ? `${stage.count} pieces ready` : "Ready"
                  : "Waiting for the plan"}
              </div>
            </div>
            <span style={{ color: stage.ready ? architect.success : architect.inkMuted }}>
              {stage.ready ? "✓" : "○"}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!hasProposal ? (
          <ArchitectButton disabled={busy || !readyForProposal} onClick={onPropose}>
            {busy ? "Assembling…" : HUMAN_COPY.proposePlan}
          </ArchitectButton>
        ) : (
          <ArchitectButton onClick={onOpenProposal}>Review the plan</ArchitectButton>
        )}
      </div>
    </div>
  );
}
