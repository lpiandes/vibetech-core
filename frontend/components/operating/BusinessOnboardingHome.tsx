"use client";

import Link from "next/link";
import { cockpitColors, spacing, radius } from "@/design/tokens";

/**
 * Pre-install Home — conversation with VIBETech (same Architect lifecycle).
 * One job: start the Customer Promise — tell us → recommend → approve → live.
 */
export default function BusinessOnboardingHome({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const talkHref = `/b/${encodeURIComponent(businessId)}/architect?newSetup=1`;

  return (
    <div
      style={{
        minHeight: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${spacing["3xl"] ?? 64} ${spacing.lg}`,
      }}
    >
      <div style={{ maxWidth: 560, width: "100%" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: cockpitColors.accent,
          }}
        >
          Welcome to VIBETech
        </p>
        <h1
          style={{
            margin: `${spacing.md} 0 0`,
            fontSize: "clamp(2.25rem, 5vw, 3.25rem)",
            lineHeight: 1.12,
            fontWeight: 650,
            letterSpacing: "-0.03em",
            color: cockpitColors.textPrimary,
          }}
        >
          {businessName ? `Tell us about ${businessName}` : "Tell us about your business"}
        </h1>
        <p
          style={{
            margin: `${spacing.lg} 0 0`,
            fontSize: "1.125rem",
            lineHeight: 1.6,
            color: cockpitColors.textSecondary,
            maxWidth: 480,
          }}
        >
          VIBETech recommends how your business should run — people, work, and AI teammates —
          then operates it with you. You supervise. Nothing goes live until you approve.
        </p>

        <ol
          style={{
            listStyle: "none",
            margin: `${spacing.xl} 0 0`,
            padding: 0,
            display: "grid",
            gap: spacing.md,
          }}
        >
          {[
            "Tell VIBETech how the business works",
            "Review the recommendation",
            "Approve and go live — usually about 15–20 minutes",
          ].map((step, index) => (
            <li
              key={step}
              style={{
                display: "flex",
                gap: spacing.md,
                alignItems: "flex-start",
                color: cockpitColors.textSecondary,
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: radius.pill,
                  background: cockpitColors.accentMuted,
                  color: cockpitColors.accent,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div style={{ marginTop: spacing["2xl"] ?? 40 }}>
          <Link
            href={talkHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 52,
              padding: `0 ${spacing.xl}`,
              borderRadius: 14,
              background: cockpitColors.accent,
              color: "#fff",
              fontWeight: 650,
              fontSize: "1.05rem",
              textDecoration: "none",
              boxShadow: "0 10px 28px rgba(15, 118, 110, 0.28)",
            }}
          >
            Talk to VIBETech
          </Link>
          <p style={{ margin: `${spacing.md} 0 0`, color: cockpitColors.textMuted, fontSize: 13, lineHeight: 1.5 }}>
            About 15–20 minutes. You can pause and return anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
