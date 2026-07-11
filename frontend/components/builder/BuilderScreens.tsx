"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cockpitColors, spacing } from "@/design/tokens";
import {
  builderCanvas,
  builderCard,
  builderInput,
  builderMuted,
  builderPanel,
  builderShell,
  builderTitle,
  primaryButton,
  secondaryButton,
  statusTone,
} from "./builderTheme";

type SessionCard = {
  sessionId: string;
  businessName: string;
  stage: string;
  progressPercent: number;
  progressLabel: string;
  updatedAt?: string;
  nextAction: string;
  isInstalled?: boolean;
  mode?: string;
};

/**
 * Polished Builder home — new, improve, continue, recent sessions.
 */
export default function BuilderHomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [description, setDescription] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [mode, setMode] = useState<"new_business" | "internal_vibetech_build" | "expand_existing_business">("new_business");
  const [existingBusinessId, setExistingBusinessId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/builder/sessions");
        const data = await response.json();
        if (data.ok) setSessions(data.sessions ?? []);
      } catch {
        // Home still works without session list.
      }
    })();
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/builder/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          businessName: businessName || null,
          websiteUrl: websiteUrl || null,
          businessId: mode === "expand_existing_business" ? existingBusinessId || null : null,
          description: description || businessName || "Tell me about your business.",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not start.");
      router.push(`/builder/${data.session.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  const continueSessions = sessions.filter((session) => !session.isInstalled);
  const installedSessions = sessions.filter((session) => session.isInstalled);

  return (
    <div style={builderCanvas}>
      <div style={builderShell}>
        <header style={{ display: "grid", gap: spacing.sm, maxWidth: 720 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F766E", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            VIBETech Business Builder
          </div>
          <h1 style={builderTitle}>Build an operating system for any business</h1>
          <p style={builderMuted}>
            Tell us about the company. We research, ask smart questions, and propose a reusable Business OS —
            then you preview, dry run, approve, and install.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: spacing.lg }}>
          <section style={builderPanel}>
            <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Start here</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: spacing.md }}>
              {[
                { id: "new_business", label: "Build a new business OS" },
                { id: "expand_existing_business", label: "Improve an existing business" },
                { id: "internal_vibetech_build", label: "VIBETech admin for a client" },
              ].map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setMode(entry.id as typeof mode)}
                  style={{
                    ...secondaryButton,
                    background: mode === entry.id ? "#0F766E" : "#fff",
                    color: mode === entry.id ? "#fff" : cockpitColors.textPrimary,
                  }}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gap: spacing.md }}>
              <label style={labelStyle}>
                <span>Tell me about your business</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="We are a dental practice with two locations, hygienists, and a busy recall list…"
                  rows={4}
                  style={{ ...builderInput, resize: "vertical" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
                <label style={labelStyle}>
                  <span>Business name</span>
                  <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Optional" style={builderInput} />
                </label>
                <label style={labelStyle}>
                  <span>Website</span>
                  <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://" style={builderInput} />
                </label>
              </div>
              {mode === "expand_existing_business" ? (
                <label style={labelStyle}>
                  <span>Existing business id</span>
                  <input value={existingBusinessId} onChange={(event) => setExistingBusinessId(event.target.value)} style={builderInput} />
                </label>
              ) : null}
              {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}
              <button type="button" onClick={() => void start()} disabled={busy} style={primaryButton()}>
                {busy ? "Starting…" : "Begin"}
              </button>
            </div>
          </section>

          <aside style={{ display: "grid", gap: spacing.md, alignContent: "start" }}>
            <section style={builderPanel}>
              <h3 style={{ marginTop: 0 }}>Continue a saved session</h3>
              {continueSessions.length === 0 ? (
                <p style={builderMuted}>No open sessions yet. Start one and it will appear here.</p>
              ) : (
                <div style={{ display: "grid", gap: spacing.sm }}>
                  {continueSessions.slice(0, 5).map((session) => (
                    <Link key={session.sessionId} href={`/builder/${session.sessionId}`} style={{ textDecoration: "none" }}>
                      <div style={builderCard}>
                        <div style={{ fontWeight: 700, color: cockpitColors.textPrimary }}>{session.businessName}</div>
                        <div style={{ ...builderMuted, fontSize: 13 }}>{session.progressLabel} · {session.stage}</div>
                        <div style={{ marginTop: 8, fontSize: 13, color: "#0F766E", fontWeight: 650 }}>{session.nextAction}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section style={builderPanel}>
              <h3 style={{ marginTop: 0 }}>Recent</h3>
              {sessions.length === 0 ? (
                <p style={builderMuted}>Recent Builder sessions will show status, progress, and next action.</p>
              ) : (
                <div style={{ display: "grid", gap: spacing.sm }}>
                  {sessions.slice(0, 8).map((session) => {
                    const tone = statusTone(session.isInstalled ? "installed" : "pending");
                    return (
                      <Link key={`recent-${session.sessionId}`} href={`/builder/${session.sessionId}`} style={{ textDecoration: "none" }}>
                        <div style={{ ...builderCard, display: "grid", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <strong style={{ color: cockpitColors.textPrimary }}>{session.businessName}</strong>
                            <span style={{ ...tone, borderRadius: 99, padding: "2px 8px", fontSize: 12 }}>{session.stage}</span>
                          </div>
                          <div style={{ ...builderMuted, fontSize: 13 }}>
                            {session.updatedAt ? `Updated ${new Date(session.updatedAt).toLocaleString()}` : "Saved session"}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              {installedSessions.length > 0 ? (
                <p style={{ ...builderMuted, marginTop: spacing.md, fontSize: 13 }}>
                  Installed businesses can also be improved from inside the portal with Ask VIBETech.
                </p>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 650,
};
