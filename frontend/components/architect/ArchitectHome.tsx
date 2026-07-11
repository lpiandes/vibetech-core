"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { architect } from "./architectTheme";
import {
  ArchitectBadge,
  ArchitectButton,
  ArchitectPanel,
  ArchitectShell,
  ArchitectSkeleton,
} from "./ArchitectPrimitives";

type SessionCard = {
  sessionId: string;
  businessName: string;
  stage: string;
  progressLabel: string;
  nextAction: string;
  updatedAt?: string;
  isInstalled?: boolean;
};

const EXAMPLES = [
  { name: "Harbor Property Group", industry: "Property management", blurb: "Leasing, maintenance, owner communication." },
  { name: "Smile Dental", industry: "Dental practice", blurb: "Patients, appointments, recall workflows." },
  { name: "Northline Hockey", industry: "Sports club", blurb: "Teams, travel, parent approvals." },
];

const BLUEPRINTS = [
  { name: "Property Management Gold", status: "Gold" },
  { name: "Universal Core", status: "Platform" },
  { name: "Hockey Travel Club", status: "Fixture" },
];

/**
 * Premium Architect home — consultant welcome, not a form dump.
 */
export default function ArchitectHome() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/builder/sessions");
        const data = await response.json();
        if (data.ok) setSessions(data.sessions ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function start(seed?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/builder/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "new_business",
          description: seed || description || null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not start.");
      router.push(`/architect/${data.session.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  const continueSessions = sessions.filter((session) => !session.isInstalled).slice(0, 4);

  return (
    <ArchitectShell maxWidth={1180}>
      <header style={{ display: "grid", gap: 14, maxWidth: 760, marginBottom: 36 }}>
        <ArchitectBadge tone="accent">VIBETech Architect</ArchitectBadge>
        <h1 style={{
          margin: 0,
          fontFamily: architect.display,
          fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          fontWeight: 650,
        }}>
          Welcome to VIBETech Architect
        </h1>
        <p style={{ margin: 0, fontSize: 18, color: architect.inkMuted, maxWidth: 620, lineHeight: 1.55 }}>
          Let&apos;s design your Business Operating System — like sitting down with a senior business consultant,
          not filling out software forms.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, .85fr)", gap: 20 }}>
        <ArchitectPanel style={{ display: "grid", gap: 18 }}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Build a new business</h2>
            <p style={{ margin: 0, color: architect.inkMuted }}>
              Tell Architect about the company in plain language. One thoughtful question at a time comes next.
            </p>
          </div>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="We run a dental practice with two locations, hygienists, and a busy recall list…"
            rows={5}
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: architect.radiusSm,
              border: `1px solid ${architect.border}`,
              background: "rgba(2,6,23,.45)",
              color: architect.ink,
              padding: 16,
              fontSize: 16,
              lineHeight: 1.5,
              fontFamily: architect.font,
            }}
          />
          {error ? <div style={{ color: architect.danger }}>{error}</div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ArchitectButton disabled={busy} onClick={() => void start()}>
              {busy ? "Opening Architect…" : "Begin with Architect"}
            </ArchitectButton>
            <ArchitectButton variant="secondary" disabled={busy} onClick={() => void start()}>
              Start blank
            </ArchitectButton>
          </div>
        </ArchitectPanel>

        <div style={{ display: "grid", gap: 16 }}>
          <ArchitectPanel>
            <h3 style={{ marginTop: 0 }}>Continue previous session</h3>
            {loading ? (
              <div style={{ display: "grid", gap: 10 }}>
                <ArchitectSkeleton height={54} />
                <ArchitectSkeleton height={54} />
              </div>
            ) : continueSessions.length === 0 ? (
              <p style={{ color: architect.inkMuted, margin: 0 }}>No open sessions yet. Your work will appear here.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {continueSessions.map((session) => (
                  <Link key={session.sessionId} href={`/architect/${session.sessionId}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      borderRadius: architect.radiusSm,
                      border: `1px solid ${architect.border}`,
                      padding: 14,
                      background: "rgba(15,23,42,.55)",
                      transition: "transform .15s ease",
                    }}>
                      <div style={{ color: architect.ink, fontWeight: 700 }}>{session.businessName}</div>
                      <div style={{ color: architect.inkMuted, fontSize: 13, marginTop: 4 }}>{session.progressLabel}</div>
                      <div style={{ color: architect.accent, fontSize: 13, marginTop: 8, fontWeight: 650 }}>{session.nextAction}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ArchitectPanel>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 20 }}>
        <ArchitectPanel>
          <h3 style={{ marginTop: 0 }}>Browse example businesses</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {EXAMPLES.map((example) => (
              <button
                key={example.name}
                type="button"
                disabled={busy}
                onClick={() => void start(`${example.name} — ${example.blurb}`)}
                style={{
                  textAlign: "left",
                  borderRadius: architect.radiusSm,
                  border: `1px solid ${architect.border}`,
                  background: "transparent",
                  color: architect.ink,
                  padding: 14,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>{example.name}</div>
                <div style={{ color: architect.inkMuted, fontSize: 13 }}>{example.industry} · {example.blurb}</div>
              </button>
            ))}
          </div>
        </ArchitectPanel>

        <ArchitectPanel>
          <h3 style={{ marginTop: 0 }}>Browse Blueprints</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {BLUEPRINTS.map((blueprint) => (
              <div key={blueprint.name} style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 0",
                borderBottom: `1px solid ${architect.border}`,
              }}>
                <span>{blueprint.name}</span>
                <ArchitectBadge tone="accent">{blueprint.status}</ArchitectBadge>
              </div>
            ))}
          </div>
          <p style={{ color: architect.inkMuted, fontSize: 13, marginBottom: 0 }}>
            Architect reuses Blueprints before inventing anything new.
          </p>
        </ArchitectPanel>

        <ArchitectPanel>
          <h3 style={{ marginTop: 0 }}>How Architect works</h3>
          <ol style={{ margin: 0, paddingLeft: 18, color: architect.inkMuted, lineHeight: 1.7 }}>
            <li>Understand the business</li>
            <li>Research website & documents</li>
            <li>Propose a reusable Business OS</li>
            <li>Preview, dry run, approve, install</li>
            <li>Keep improving forever with Ask VIBETech</li>
          </ol>
        </ArchitectPanel>
      </div>
    </ArchitectShell>
  );
}
