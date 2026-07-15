"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type ChecklistItem = {
  id: string;
  title: string;
  actionLabel: string;
  href: string;
  complete: boolean;
  summary?: string | null;
  whereInApp?: string | null;
  inApp?: string[];
  external?: string[];
};

/**
 * Post-live prosper steps — same walkthrough owners saw on readiness.
 * Completed steps stay visible with a green check.
 */
export default function SetupChecklistBanner({
  businessName,
  checklist,
  compact = false,
}: {
  businessName: string;
  checklist: ChecklistItem[];
  compact?: boolean;
}) {
  if (!checklist.length) return null;

  const incomplete = checklist.filter((item) => !item.complete);
  const completeCount = checklist.filter((item) => item.complete).length;
  const total = checklist.length;
  const progress = total > 0 ? Math.round((completeCount / total) * 100) : 0;
  const allDone = incomplete.length === 0;
  const [openId, setOpenId] = useState<string | null>(incomplete[0]?.id ?? null);

  if (compact) {
    if (allDone) return null;
    const nextItem = incomplete[0];
    return (
      <div
        style={{
          marginBottom: spacing.md,
          padding: `${spacing.sm} ${spacing.md}`,
          borderRadius: radius.large,
          border: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panel,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>
              Your steps to make your business prosper
            </div>
            <div style={{ marginTop: 4, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
              {completeCount} of {total} complete · {incomplete.map((item) => item.title).join(" · ")}
            </div>
          </div>
          {nextItem ? (
            <Link href={nextItem.href} style={actionLinkStyle}>
              {nextItem.actionLabel}
              <ChevronRight size={14} />
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section
      style={{
        marginBottom: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.large,
        border: `1px solid rgba(15, 118, 110, 0.18)`,
        background: "linear-gradient(165deg, #ffffff 0%, #f3faf8 48%, #ffffff 100%)",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 12px 28px rgba(15,118,110,0.06)",
        display: "grid",
        gap: spacing.md,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 750, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.accent }}>
          After go-live
        </div>
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: cockpitColors.textPrimary }}>
          Your steps to make your business prosper
        </h2>
        <p style={{ margin: 0, fontSize: typography.body.fontSize, color: cockpitColors.textSecondary, lineHeight: 1.5, maxWidth: 720 }}>
          {allDone
            ? "Everything on this list is connected. Your teammates can operate with full context."
            : "Finish these in VIBETech and on the external platforms (Twilio, Google, Meta, and more). You can also reopen this list anytime under Settings."}
        </p>
        <div style={{ marginTop: 4, height: 6, borderRadius: radius.pill, backgroundColor: "rgba(15,23,42,0.06)", overflow: "hidden", maxWidth: 360 }}>
          <div style={{ height: "100%", width: `${progress}%`, borderRadius: radius.pill, backgroundColor: cockpitColors.accent }} />
        </div>
        <div style={{ fontSize: 12, color: allDone ? cockpitColors.accent : cockpitColors.textMuted, fontWeight: allDone ? 700 : 500 }}>
          {allDone
            ? `All ${total} complete for ${businessName || "your business"}`
            : `${completeCount} of ${total} complete for ${businessName || "your business"}`}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {checklist.map((item, index) => {
          const done = Boolean(item.complete);
          const open = !done && openId === item.id;
          const hasGuide = !done && Boolean(item.summary || (item.inApp?.length ?? 0) || (item.external?.length ?? 0));
          return (
            <article
              key={item.id}
              style={{
                borderRadius: 14,
                border: `1px solid ${done
                  ? "rgba(16,185,129,0.35)"
                  : open
                    ? "rgba(15,118,110,0.28)"
                    : "rgba(15,23,42,0.08)"}`,
                background: done ? "rgba(16,185,129,0.06)" : "#fff",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (!hasGuide) return;
                  setOpenId(open ? null : item.id);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  border: "none",
                  background: "transparent",
                  cursor: hasGuide ? "pointer" : "default",
                  textAlign: "left",
                }}
              >
                <span style={done ? doneBadge : stepBadge} aria-label={done ? "Complete" : `Step ${index + 1}`}>
                  {done ? <Check size={16} strokeWidth={3} /> : index + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "block",
                    fontWeight: 700,
                    color: done ? cockpitColors.textSecondary : cockpitColors.textPrimary,
                    textDecoration: done ? "none" : undefined,
                  }}>
                    {item.title}
                  </span>
                  {item.whereInApp ? (
                    <span style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: 12,
                      fontWeight: 650,
                      color: done ? "rgba(15,118,110,0.7)" : cockpitColors.accent,
                    }}>
                      In VIBETech: {item.whereInApp}
                    </span>
                  ) : null}
                </span>
                {done ? (
                  <span style={donePill}>Done</span>
                ) : (
                  <>
                    {hasGuide ? (open ? <ChevronDown size={18} color={cockpitColors.textMuted} /> : <ChevronRight size={18} color={cockpitColors.textMuted} />) : null}
                    <Link href={item.href} onClick={(event) => event.stopPropagation()} style={actionLinkStyle}>
                      {item.actionLabel}
                    </Link>
                  </>
                )}
              </button>
              {open && hasGuide ? (
                <div style={{ padding: "0 16px 16px 52px", display: "grid", gap: 12 }}>
                  {item.summary ? (
                    <p style={{ margin: 0, fontSize: 14, color: cockpitColors.textSecondary, lineHeight: 1.5 }}>{item.summary}</p>
                  ) : null}
                  {(item.inApp ?? []).length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={eyebrow}>In the app</div>
                      <ol style={list}>{item.inApp!.map((line) => <li key={line}>{line}</li>)}</ol>
                    </div>
                  ) : null}
                  {(item.external ?? []).length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={eyebrow}>On the external platform</div>
                      <ol style={list}>{item.external!.map((line) => <li key={line}>{line}</li>)}</ol>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

const stepBadge: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 750,
  color: cockpitColors.accent,
  background: "rgba(15,118,110,0.1)",
  flexShrink: 0,
};

const doneBadge: CSSProperties = {
  ...stepBadge,
  color: "#fff",
  background: "#10B981",
};

const donePill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 750,
  color: "#047857",
  background: "rgba(16,185,129,0.18)",
  border: "1px solid rgba(16,185,129,0.35)",
  flexShrink: 0,
};

const actionLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: `${spacing.xs} ${spacing.md}`,
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  color: cockpitColors.accent,
  textDecoration: "none",
  fontSize: typography.caption.fontSize,
  fontWeight: 600,
  flexShrink: 0,
  background: "#fff",
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 750,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: cockpitColors.textMuted,
};

const list: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: cockpitColors.textPrimary,
  lineHeight: 1.55,
  fontSize: 14,
};
