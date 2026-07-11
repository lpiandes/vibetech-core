"use client";

import { architect } from "./architectTheme";
import { ArchitectBadge } from "./ArchitectPrimitives";
import { businessDnaPortrait } from "./architectSemantics";

export default function BusinessDnaPortrait({
  summary,
}: {
  summary?: Record<string, unknown> | null;
}) {
  const portrait = businessDnaPortrait(summary);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <ArchitectBadge tone="accent">Business DNA</ArchitectBadge>
        <h3 style={{ margin: "10px 0 4px", fontSize: 18 }}>Living portrait</h3>
        <p style={{ margin: 0, color: architect.inkMuted, fontSize: 13, lineHeight: 1.45 }}>
          {portrait.label}
        </p>
      </div>

      <div style={{ display: "grid", placeItems: "center" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          {portrait.rings.map((ring, index) => {
            const radius = 28 + index * 14;
            const circumference = 2 * Math.PI * radius;
            const dash = circumference * Math.max(0.08, ring.ratio);
            return (
              <circle
                key={ring.id}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={ring.ratio > 0 ? architect.accent : "rgba(148,163,184,.2)"}
                strokeWidth={ring.ratio > 0.55 ? 4 : 2.5}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ animation: ring.ratio > 0 ? "architectDnaFill .8s ease forwards" : undefined }}
                opacity={0.35 + ring.ratio * 0.65}
              />
            );
          })}
          <circle cx={cx} cy={cy} r={18} fill={architect.accentSoft} stroke={architect.accent} />
          <text x={cx} y={cy + 4} textAnchor="middle" fill={architect.ink} fontSize="11" fontWeight="700">
            {Math.round(portrait.overall * 100)}%
          </text>
        </svg>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {portrait.rings.map((ring) => (
          <div key={ring.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>{ring.label}</span>
            <span style={{ color: ring.status === "strong" ? architect.success : architect.inkMuted }}>
              {ring.status === "strong" ? "Clear" : ring.status === "forming" ? "Forming" : "Waiting"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
