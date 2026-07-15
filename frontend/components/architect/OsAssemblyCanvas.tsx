"use client";

import { useState } from "react";
import { architect, architectKeyframes } from "./architectTheme";
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
  const [activatedIds, setActivatedIds] = useState<Set<string>>(() => new Set());

  function toggleStageSpin(stageId: string, ready: boolean) {
    if (ready) return;
    setActivatedIds((current) => {
      const next = new Set(current);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <style>{architectKeyframes}</style>
      <div>
        <ArchitectBadge tone="accent">Your recommendation</ArchitectBadge>
        <h2 style={{ margin: "10px 0 6px", fontFamily: architect.display, fontSize: 28 }}>
          {hasProposal ? "Your system is taking shape" : busy ? "Building your recommendation" : "Ready when you are"}
        </h2>
        <p style={{ margin: 0, color: architect.inkMuted, lineHeight: 1.5 }}>
          {hasProposal
            ? "VIBETech prepared a recommendation from what it learned — nothing is live until you approve."
            : busy
              ? "VIBETech is assembling the pieces below. Watch the circles — they settle when that piece is ready."
              : "These are the pieces of your operating system. Click a circle to preview it spinning, then show the recommendation when you’re ready."}
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {stages.map((stage, index) => {
          const showSpin = Boolean(busy && !stage.ready) || activatedIds.has(stage.id);
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => toggleStageSpin(stage.id, stage.ready || hasProposal)}
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
                color: "inherit",
                textAlign: "left",
                cursor: stage.ready || hasProposal ? "default" : "pointer",
                font: "inherit",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{stage.label}</div>
                <div style={{ color: architect.inkMuted, fontSize: 13 }}>
                  {stage.ready
                    ? stage.count > 1 ? `${stage.count} pieces ready` : "Ready"
                    : busy
                      ? "Building…"
                      : showSpin
                        ? "Working on this piece…"
                        : "Waiting — click the circle to see it work"}
                </div>
              </div>
              <StageStatusIcon ready={stage.ready} spinning={showSpin || (busy && !stage.ready)} delay={index * 0.12} />
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!hasProposal ? (
          <ArchitectButton disabled={busy || !readyForProposal} onClick={onPropose}>
            {busy ? "Preparing…" : HUMAN_COPY.proposePlan}
          </ArchitectButton>
        ) : (
          <ArchitectButton onClick={onOpenProposal}>Review the recommendation</ArchitectButton>
        )}
      </div>
    </div>
  );
}

function StageStatusIcon({
  ready,
  spinning,
  delay = 0,
}: {
  ready: boolean;
  spinning: boolean;
  delay?: number;
}) {
  if (ready) {
    return (
      <span
        aria-label="Ready"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(52,211,153,.18)",
          color: architect.success,
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        ✓
      </span>
    );
  }

  return (
    <span
      aria-label={spinning ? "Building" : "Waiting"}
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        boxSizing: "border-box",
        border: `2px solid ${spinning ? architect.accent : "rgba(148,163,184,.45)"}`,
        borderTopColor: spinning ? "transparent" : undefined,
        display: "inline-block",
        animation: spinning ? `architectSpin .9s linear ${delay}s infinite` : undefined,
        flexShrink: 0,
      }}
    />
  );
}
