"use client";

import { architect } from "./architectTheme";
import { ArchitectBadge } from "./ArchitectPrimitives";
import { reasoningMoments } from "./architectSemantics";

export default function ReasoningStrip({
  nextQuestion,
  proposal,
  assumptions,
  recommendations,
  changeImpact,
}: {
  nextQuestion?: any;
  proposal?: any;
  assumptions?: any[];
  recommendations?: any[];
  changeImpact?: any;
}) {
  const moments = reasoningMoments({
    nextQuestion,
    proposal,
    assumptions,
    recommendations,
    changeImpact,
  });

  if (!moments.length) {
    return (
      <div style={{ color: architect.inkMuted, fontSize: 13, lineHeight: 1.5 }}>
        Architect will explain each step in plain English as understanding grows.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ArchitectBadge tone="accent">Architect reasoning</ArchitectBadge>
      {moments.map((moment) => (
        <div
          key={moment.id}
          style={{
            borderRadius: architect.radiusSm,
            border: `1px solid ${architect.border}`,
            background: "rgba(15,23,42,.42)",
            padding: 12,
            animation: "architectFadeUp .4s ease",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{moment.title}</div>
          <div style={{ color: architect.inkMuted, fontSize: 13, lineHeight: 1.5 }}>{moment.body}</div>
        </div>
      ))}
    </div>
  );
}
