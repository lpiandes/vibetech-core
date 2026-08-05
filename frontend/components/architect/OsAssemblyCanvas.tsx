"use client";

import { useEffect, useRef, useState } from "react";
import { architect, architectKeyframes } from "./architectTheme";
import { ArchitectBadge, ArchitectButton } from "./ArchitectPrimitives";
import { assemblyStagesFromProposal } from "./architectSemantics";

/**
 * Post-discovery build stage — runs automatically (no click-to-spin).
 * While propose() is in flight stages animate; when ready, Continue to business.
 */
export default function OsAssemblyCanvas({
  proposal,
  readyForProposal,
  busy,
  onPropose,
  onContinueToBusiness,
}: {
  proposal?: any;
  readyForProposal?: boolean;
  busy?: boolean;
  onPropose?: () => void;
  onContinueToBusiness?: () => void;
}) {
  const stages = assemblyStagesFromProposal(proposal);
  const hasProposal = Boolean(proposal?.views);
  const [activeCount, setActiveCount] = useState(0);
  const startedRef = useRef(false);

  // Auto-start assemble/propose once — no "See recommendation" click.
  useEffect(() => {
    if (startedRef.current) return;
    if (hasProposal) return;
    if (!readyForProposal || !onPropose) return;
    startedRef.current = true;
    onPropose();
  }, [hasProposal, readyForProposal, onPropose]);

  // Stagger stage “working” indicators while building.
  useEffect(() => {
    if (hasProposal) {
      setActiveCount(stages.length);
      return;
    }
    if (!busy && !readyForProposal) return;
    setActiveCount(1);
    const timers: number[] = [];
    stages.forEach((_, index) => {
      if (index === 0) return;
      timers.push(window.setTimeout(() => {
        setActiveCount((n) => Math.max(n, index + 1));
      }, 700 * index));
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [busy, hasProposal, readyForProposal, stages.length]);

  return (
    <div style={{ display: "grid", gap: 18, animation: "architectFadeUp .45s ease" }}>
      <style>{architectKeyframes}</style>
      <div>
        <ArchitectBadge tone="accent">
          {hasProposal ? "Ready" : "Building"}
        </ArchitectBadge>
        <h2 style={{
          margin: "10px 0 6px",
          fontFamily: architect.display,
          fontSize: "clamp(1.45rem, 2.8vw, 1.85rem)",
          letterSpacing: "-0.02em",
          color: architect.ink,
        }}
        >
          {hasProposal
            ? "Your operating system is ready"
            : busy
              ? "Building your business"
              : "Preparing to build"}
        </h2>
        <p style={{ margin: 0, color: architect.inkMuted, lineHeight: 1.5, fontSize: 14 }}>
          {hasProposal
            ? "VIBETech assembled a recommendation from what you confirmed. Continue to open your business — nothing customer-facing goes live without the connections and proofs you approve next."
            : "VIBETech is assembling workspaces, teammates, workflows, and connections from your responsibilities. This runs automatically."}
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {stages.map((stage, index) => {
          const working = !stage.ready && !hasProposal && index < activeCount;
          const waiting = !stage.ready && !hasProposal && index >= activeCount;
          return (
            <div
              key={stage.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderRadius: architect.radiusSm,
                border: `1px solid ${stage.ready || hasProposal ? architect.borderGlow : architect.border}`,
                background: stage.ready || hasProposal
                  ? "rgba(34, 211, 238, 0.08)"
                  : architect.panelSolid,
                animation: stage.ready || hasProposal
                  ? `architectAssembleIn .45s ease ${index * 0.05}s both`
                  : undefined,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: architect.ink }}>{stage.label}</div>
                <div style={{ color: architect.inkMuted, fontSize: 13, marginTop: 2 }}>
                  {stage.ready || hasProposal
                    ? stage.count > 1 ? `${stage.count} pieces ready` : "Ready"
                    : working
                      ? "Building…"
                      : waiting
                        ? "Up next"
                        : "Waiting"}
                </div>
              </div>
              <StageStatusIcon
                ready={Boolean(stage.ready || hasProposal)}
                spinning={Boolean(working || (busy && !stage.ready && !hasProposal && index < activeCount))}
                delay={index * 0.08}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
        {!hasProposal ? (
          <ArchitectButton disabled>
            {busy ? "Building…" : "Starting…"}
          </ArchitectButton>
        ) : (
          <ArchitectButton onClick={onContinueToBusiness}>
            Continue to your business
          </ArchitectButton>
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
