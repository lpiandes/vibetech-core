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
  checklistHref,
}: {
  businessName: string;
  checklist: ChecklistItem[];
  compact?: boolean;
  checklistHref?: string | null;
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
    const nextStepNumber = Math.max(1, checklist.findIndex((item) => item.id === nextItem?.id) + 1);
    const level = progress >= 100 ? "Live" : progress >= 66 ? "Finishing line" : progress >= 33 ? "Building momentum" : "Getting started";
    return (
      <div
        style={{
          marginBottom: spacing.xs,
          padding: "16px 18px",
          borderRadius: 16,
          border: "1px solid rgba(15,118,110,.18)",
          background: cockpitColors.panelElevated,
          boxShadow: "0 8px 22px rgba(15,118,110,.07)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: 18, alignItems: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #0f766e, #0d9488)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 8px 18px rgba(13,148,136,.22)", flexShrink: 0 }}>
            <div style={{ textAlign: "center", lineHeight: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.06em" }}>{completeCount}/{total}</div>
              <div style={{ marginTop: 5, fontSize: 9, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: .82 }}>complete</div>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: cockpitColors.accent, textTransform: "uppercase" }}>Launch path</span>
              <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: cockpitColors.accent, background: cockpitColors.accentMuted }}>{level}</span>
            </div>
            <div style={{ marginTop: 4, fontWeight: 750, fontSize: "1rem", color: cockpitColors.textPrimary }}>
              Mission {nextStepNumber}: {nextItem?.title}
            </div>
            <div style={{ marginTop: 3, fontSize: 12, color: cockpitColors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextItem?.summary ?? "Complete this mission to unlock more of your operating system."}
            </div>
            <div aria-label={`${completeCount} of ${total} launch steps complete`} style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, overflow: "hidden" }}>
              {checklist.map((item, index) => {
                const done = item.complete;
                const current = item.id === nextItem?.id;
                return <span key={item.id} title={`Mission ${index + 1}: ${item.title}`} style={{ width: current ? 22 : 14, height: 14, borderRadius: 999, background: done ? "#10b981" : current ? "#0f766e" : "#dbe4ea", border: current ? "3px solid #99f6e4" : "none", boxSizing: "border-box", flexShrink: 0 }} />;
              })}
            </div>
          </div>
          <div style={{ display: "grid", justifyItems: "end", gap: 9 }}>
            {checklistHref ? <Link href={checklistHref} style={viewAllLinkStyle}>View all missions</Link> : null}
            {nextItem ? (
              <Link href={nextItem.href} style={actionLinkStyle}>
                Start mission
                <ChevronRight size={14} />
              </Link>
            ) : null}
          </div>
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
        background: cockpitColors.panel,
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
  background: cockpitColors.panel,
};

const viewAllLinkStyle: CSSProperties = {
  color: cockpitColors.accent,
  textDecoration: "none",
  fontSize: typography.caption.fontSize,
  fontWeight: 700,
  whiteSpace: "nowrap",
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
