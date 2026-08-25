"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/design/tokens/brand";
import { cockpitColors } from "@/design/tokens/colors";

const NAV = [
  { href: (id: string) => `/insurance/${id}`, label: "Today", match: "today" },
  { href: (id: string) => `/insurance/${id}/clients`, label: "Clients", match: "clients" },
  { href: (id: string) => `/insurance/${id}/settings`, label: "Settings", match: "settings" },
];

/**
 * FE Retention chrome — exact VIBETech brand tokens (navy / cyan / slate).
 */
export function InsuranceShell({
  businessId,
  businessName,
  agentName,
  viewingAsAdmin = false,
  children,
}: {
  businessId: string;
  businessName: string;
  agentName: string | null;
  viewingAsAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  return (
    <div className="fe-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .fe-root {
          --fe-bg: ${brand.bgDeep};
          --fe-panel: ${brand.bg};
          --fe-elevated: ${cockpitColors.panelElevated};
          --fe-ink: ${brand.text};
          --fe-muted: ${brand.textMuted};
          --fe-line: ${brand.border};
          --fe-accent: ${brand.cyan};
          --fe-accent-soft: ${cockpitColors.accentMuted};
          --fe-warn: ${cockpitColors.critical};
          --fe-warn-soft: rgba(248,113,113,0.12);
          --fe-ok: ${cockpitColors.handled};
          min-height: 100vh;
          background:
            radial-gradient(ellipse 70% 45% at 12% -8%, rgba(34,211,238,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 50% 35% at 100% 0%, rgba(168,85,247,0.10) 0%, transparent 50%),
            var(--fe-bg);
          color: var(--fe-ink);
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .fe-root * { box-sizing: border-box; }
        .fe-shell {
          max-width: 1080px;
          margin: 0 auto;
          padding: 1.25rem 1.25rem 3rem;
        }
        .fe-top {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.75rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--fe-line);
        }
        .fe-brand {
          font-size: 1.65rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.1;
          color: var(--fe-ink);
        }
        .fe-brand span {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--fe-accent);
          margin-bottom: 0.3rem;
        }
        .fe-agent {
          font-size: 0.85rem;
          color: var(--fe-muted);
          text-align: right;
        }
        .fe-nav {
          display: flex;
          gap: 0.35rem;
          margin: 0 0 1.5rem;
        }
        .fe-nav a {
          text-decoration: none;
          color: var(--fe-muted);
          padding: 0.55rem 0.9rem;
          border-radius: 999px;
          font-size: 0.9rem;
          font-weight: 600;
          border: 1px solid transparent;
        }
        .fe-nav a[data-active="true"] {
          background: var(--fe-accent-soft);
          color: var(--fe-accent);
          border-color: ${brand.borderGlow};
        }
        .fe-nav a:hover { color: var(--fe-ink); }
        .fe-card {
          background: var(--fe-panel);
          border: 1px solid var(--fe-line);
          border-radius: 14px;
          padding: 1.1rem 1.2rem;
          margin-bottom: 0.85rem;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.02) inset;
        }
        .fe-card h2, .fe-card h3 {
          margin: 0 0 0.35rem;
          font-size: 1.1rem;
          color: var(--fe-ink);
          font-weight: 650;
        }
        .fe-muted { color: var(--fe-muted); font-size: 0.88rem; }
        .fe-btn {
          background: ${brand.primaryGradient};
          color: ${brand.primaryOnGradient};
          border: none;
          border-radius: 10px;
          padding: 0.65rem 1rem;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          box-shadow: ${brand.primaryShadow};
        }
        .fe-btn.secondary {
          background: transparent;
          color: var(--fe-ink);
          border: 1px solid var(--fe-line);
          box-shadow: none;
        }
        .fe-btn.warn {
          background: var(--fe-warn-soft);
          color: var(--fe-warn);
          box-shadow: none;
          border: 1px solid rgba(248,113,113,0.35);
        }
        .fe-input, .fe-select {
          width: 100%;
          border: 1px solid var(--fe-line);
          background: ${cockpitColors.inset};
          border-radius: 10px;
          padding: 0.6rem 0.75rem;
          font-size: 0.95rem;
          color: var(--fe-ink);
        }
        .fe-input::placeholder { color: #64748b; }
        textarea.fe-input {
          line-height: 1.45;
          font-weight: 500;
        }
        .fe-template-title {
          display: block;
          font-size: 0.95rem;
          font-weight: 750;
          color: var(--fe-ink);
          margin-bottom: 0.35rem;
          letter-spacing: -0.01em;
          text-transform: none;
        }
        .fe-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--fe-muted);
          margin-bottom: 0.35rem;
        }
        .fe-field { margin-bottom: 0.85rem; }
        .fe-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        @media (max-width: 720px) {
          .fe-grid-2 { grid-template-columns: 1fr; }
          .fe-agent { text-align: left; }
        }
        .fe-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.68rem;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          border: 1px solid transparent;
          line-height: 1;
          white-space: nowrap;
          align-self: center;
          flex-shrink: 0;
          box-sizing: border-box;
          vertical-align: middle;
        }
        .fe-badge--solo {
          gap: 0;
          padding: 0.5rem 1rem;
          min-height: 2.125rem;
          line-height: 1;
          text-align: center;
        }
        .fe-badge--lg {
          font-size: 0.74rem;
          letter-spacing: 0.09em;
        }
        .fe-badge-text {
          display: block;
          line-height: 1;
        }
        .fe-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          background: currentColor;
          box-shadow: 0 0 10px currentColor;
        }
        .fe-badge.missed, .fe-badge.lapsed,
        .fe-badge--missed, .fe-badge--lapsed {
          background: var(--fe-warn-soft);
          color: var(--fe-warn);
          border-color: rgba(248,113,113,0.35);
        }
        .fe-badge.missed .fe-badge-dot, .fe-badge.lapsed .fe-badge-dot,
        .fe-badge--missed .fe-badge-dot, .fe-badge--lapsed .fe-badge-dot {
          animation: fe-badge-pulse 2.2s ease-in-out infinite;
        }
        .fe-badge.sms_opt_out, .fe-badge.gmail_unmatched, .fe-badge.reinstatement,
        .fe-badge--sms_opt_out, .fe-badge--gmail_unmatched, .fe-badge--reinstatement {
          background: rgba(251, 191, 36, 0.14);
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.35);
        }
        .fe-badge.active, .fe-badge.ok,
        .fe-badge--active, .fe-badge--ok {
          background: rgba(52,211,153,0.14);
          color: var(--fe-ok);
          border-color: rgba(52,211,153,0.35);
        }
        .fe-badge--cancelled {
          background: rgba(148,163,184,0.12);
          color: #94a3b8;
          border-color: rgba(148,163,184,0.32);
        }
        @keyframes fe-badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
        .fe-toast {
          padding: 0.85rem 1rem;
          border-radius: 12px;
          margin: 0 0 0.85rem;
          font-weight: 650;
          font-size: 0.92rem;
          line-height: 1.4;
        }
        .fe-toast.ok {
          background: rgba(52,211,153,0.16);
          border: 1px solid rgba(52,211,153,0.45);
          color: #6ee7b7;
        }
        .fe-toast.err {
          background: rgba(248,113,113,0.12);
          border: 1px solid rgba(248,113,113,0.4);
          color: #fca5a5;
        }
        .fe-status-banner {
          position: sticky;
          top: 0.5rem;
          z-index: 20;
          padding: 0.9rem 1rem;
          border-radius: 12px;
          margin: 0 0 0.85rem;
          font-weight: 700;
          font-size: 0.95rem;
          line-height: 1.35;
          background: rgba(34,211,238,0.18);
          border: 1px solid rgba(34,211,238,0.5);
          color: #a5f3fc;
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        }
        .fe-status-banner.ok {
          background: rgba(52,211,153,0.2);
          border-color: rgba(52,211,153,0.55);
          color: #86efac;
        }
        .fe-status-banner.err {
          background: rgba(248,113,113,0.16);
          border-color: rgba(248,113,113,0.5);
          color: #fca5a5;
        }
        .fe-status-banner.busy {
          background: rgba(34,211,238,0.18);
          border-color: rgba(34,211,238,0.5);
          color: #a5f3fc;
        }
        .fe-status-segment {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.85rem;
        }
        .fe-status-btn {
          min-width: 7.5rem;
          transition: transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
        }
        .fe-status-btn.is-current {
          box-shadow: 0 0 0 2px var(--fe-accent), 0 0 16px rgba(34,211,238,0.35);
          transform: translateY(-1px);
        }
        .fe-status-btn.is-current.fe-btn.warn {
          background: #f87171;
          color: #fff;
          border-color: #f87171;
        }
        .fe-status-btn.is-current.fe-btn.secondary {
          background: rgba(34,211,238,0.22);
          color: #67e8f9;
          border-color: rgba(34,211,238,0.65);
        }
        .fe-status-btn.is-pressing {
          transform: scale(0.96);
          opacity: 1 !important;
        }
        .fe-status-btn:disabled {
          cursor: wait;
        }
        .fe-status-btn:disabled:not(.is-pressing):not(.is-current) {
          opacity: 0.5;
        }
        @keyframes fe-status-flash {
          0% { box-shadow: 0 0 0 0 rgba(34,211,238,0.65); }
          100% { box-shadow: 0 0 0 12px rgba(34,211,238,0); }
        }
        .fe-status-btn.just-updated {
          animation: fe-status-flash 0.75s ease-out;
        }
        .fe-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .fe-table th {
          text-align: left;
          color: var(--fe-muted);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0.5rem 0.35rem;
          border-bottom: 1px solid var(--fe-line);
        }
        .fe-table td {
          padding: 0.75rem 0.35rem;
          border-bottom: 1px solid var(--fe-line);
          vertical-align: top;
          color: var(--fe-ink);
        }
        .fe-table a { color: var(--fe-accent); font-weight: 650; text-decoration: none; }
      ` }} />
      <div className="fe-shell">
        {viewingAsAdmin ? (
          <p
            style={{
              margin: "0 0 1rem",
              padding: "0.55rem 0.85rem",
              borderRadius: 10,
              background: "rgba(34,211,238,0.12)",
              border: `1px solid ${brand.borderGlow}`,
              color: brand.cyan,
              fontSize: 13,
              fontWeight: 650,
            }}
          >
            Admin view — this is the same dashboard the agent sees.
          </p>
        ) : null}
        <header className="fe-top">
          <div>
            <p className="fe-brand">
              <span>VibeKeep</span>
              {businessName || "Your book"}
            </p>
          </div>
          <div className="fe-agent">
            {agentName ? <div>{agentName}</div> : null}
            <div>Keep every client in force</div>
          </div>
        </header>
        <nav className="fe-nav">
          {NAV.map((item) => {
            const href = item.href(businessId);
            const active =
              item.match === "today"
                ? pathname === `/insurance/${businessId}` || pathname === `/insurance/${businessId}/`
                : pathname.includes(`/insurance/${businessId}/${item.match}`);
            return (
              <Link key={item.match} href={href} data-active={active ? "true" : "false"}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </div>
  );
}
