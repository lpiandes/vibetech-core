"use client";

import { useEffect, useMemo, useState } from "react";
import { architect } from "./architectTheme";
import { ArchitectBadge, ArchitectButton } from "./ArchitectPrimitives";
import {
  approveWalkthroughCopy,
  buildApproveWalkthroughSteps,
} from "./architectSemantics";

/**
 * One proposal fact at a time — Back / Next / confirm.
 * Replaces the fake mini-Home portal preview.
 */
export default function ApproveWalkthrough({
  proposal,
  continuous = false,
  busy,
  onConfirm,
  onBackToRecommendation,
  onKeepTalking,
}: {
  proposal: any;
  continuous?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onBackToRecommendation?: () => void;
  onKeepTalking?: () => void;
}) {
  const copy = approveWalkthroughCopy(continuous);
  const steps = useMemo(
    () => buildApproveWalkthroughSteps({ proposal, continuous }),
    [proposal, continuous],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [proposal?.id, continuous, steps.length]);

  const safeIndex = Math.min(index, Math.max(0, steps.length - 1));
  const step = steps[safeIndex] ?? null;
  const isFirst = safeIndex <= 0;
  const isLast = safeIndex >= steps.length - 1;
  const progressLabel = steps.length
    ? `${safeIndex + 1} of ${steps.length}`
    : "";

  if (!step) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <ArchitectBadge tone="accent">{copy.badge}</ArchitectBadge>
        <p style={{ margin: 0, color: architect.inkMuted }}>
          Nothing to review yet. Keep talking with VIBETech until a recommendation is ready.
        </p>
        {onKeepTalking ? (
          <ArchitectButton variant="ghost" onClick={onKeepTalking}>
            {copy.keepTalking}
          </ArchitectButton>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <ArchitectBadge tone="accent">{copy.badge}</ArchitectBadge>
          <span style={{ fontSize: 13, color: architect.inkMuted, fontWeight: 600 }}>
            {progressLabel}
          </span>
        </div>
        <h2 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          {copy.headline}
        </h2>
      </div>

      <div
        key={step.id}
        style={{
          borderRadius: architect.radius,
          border: `1px solid ${architect.border}`,
          background: "rgba(15,23,42,.42)",
          padding: "22px 20px",
          display: "grid",
          gap: 12,
          minHeight: 220,
          animation: "architectFadeUp .3s ease",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: architect.inkMuted }}>
          {stepKindLabel(step.kind)}
        </div>
        <h3 style={{ margin: 0, fontSize: "1.35rem", letterSpacing: "-0.02em" }}>{step.title}</h3>
        <p style={{ margin: 0, color: architect.inkMuted, lineHeight: 1.55, fontSize: 15 }}>
          {step.body}
        </p>
        {step.items.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: architect.ink, lineHeight: 1.6 }}>
            {step.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <ArchitectButton
          variant="ghost"
          disabled={busy || isFirst}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          Back
        </ArchitectButton>
        {!isLast ? (
          <ArchitectButton
            disabled={busy}
            onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))}
          >
            Next
          </ArchitectButton>
        ) : (
          <ArchitectButton disabled={busy} onClick={onConfirm}>
            {copy.primaryCta}
          </ArchitectButton>
        )}
        {onBackToRecommendation ? (
          <ArchitectButton variant="ghost" disabled={busy} onClick={onBackToRecommendation}>
            {copy.backToRecommendation}
          </ArchitectButton>
        ) : null}
        {onKeepTalking ? (
          <ArchitectButton variant="ghost" disabled={busy} onClick={onKeepTalking}>
            {copy.keepTalking}
          </ArchitectButton>
        ) : null}
      </div>
    </div>
  );
}

function stepKindLabel(kind: string): string {
  if (kind === "nav") return "Workspaces";
  if (kind === "teammate") return "Responsibility";
  if (kind === "approvals") return "Your judgment";
  return "Confirm";
}
