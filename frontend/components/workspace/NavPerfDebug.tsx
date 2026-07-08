"use client";

import { useWorkspaceNavigation } from "./WorkspaceNavigationContext";

function fmt(ms: number | null, base: number | null) {
  if (ms === null || base === null) return "—";
  return `${Math.round(ms - base)}ms`;
}

export default function NavPerfDebug() {
  if (process.env.NODE_ENV !== "development") return null;
  if (process.env.NEXT_PUBLIC_NAV_PERF_DEBUG !== "1") return null;

  const { perf } = useWorkspaceNavigation();
  if (perf.clickAt === null) return null;

  const base = perf.clickAt;

  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 9999,
        fontSize: 10,
        lineHeight: 1.4,
        fontFamily: "ui-monospace, monospace",
        background: "rgba(0,0,0,0.82)",
        color: "#e2e8f0",
        padding: "6px 8px",
        borderRadius: 6,
        pointerEvents: "none",
        maxWidth: 220,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2 }}>nav perf</div>
      <div>click: 0ms</div>
      <div>active: {fmt(perf.activeAt, base)}</div>
      <div>loading: {fmt(perf.loadingAt, base)}</div>
      <div>content: {fmt(perf.contentAt, base)}</div>
      <div style={{ opacity: 0.7, marginTop: 2 }}>{perf.targetHref?.split("/").pop()}</div>
    </div>
  );
}
