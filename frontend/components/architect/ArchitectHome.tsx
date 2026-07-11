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
import { HUMAN_COPY, humanizeToken } from "./architectSemantics";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";

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
  { name: "Harbor Property Group", blurb: "We manage residential properties, leasing, maintenance, and owner updates." },
  { name: "Smile Dental", blurb: "We run a dental practice with two locations, hygienists, and a busy recall list." },
  { name: "Northline Hockey", blurb: "We operate a youth travel hockey club with teams, schedules, and parent approvals." },
];

/**
 * Brand-first Architect home — hire the consultant, one conversation opener.
 */
export default function ArchitectHome() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<ProductErrorView | null>(null);

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
      if (!response.ok || !data.ok) {
        setError(data.productError ?? presentProductError(data.error ?? data.reason ?? "session_create_failed"));
        return;
      }
      router.push(`/architect/${data.session.sessionId}`);
    } catch (err) {
      setError(presentProductError(err));
    } finally {
      setBusy(false);
    }
  }

  const continueSessions = sessions.filter((session) => !session.isInstalled).slice(0, 4);

  return (
    <ArchitectShell maxWidth={1120}>
      <header style={{
        display: "grid",
        gap: 18,
        marginBottom: 40,
        minHeight: "42vh",
        alignContent: "center",
      }}>
        <div style={{ fontWeight: 750, letterSpacing: "-0.03em", fontSize: "clamp(2.8rem, 6vw, 4.4rem)", fontFamily: architect.display }}>
          VIBETech
        </div>
        <ArchitectBadge tone="accent">Architect</ArchitectBadge>
        <h1 style={{
          margin: 0,
          fontFamily: architect.display,
          fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
          lineHeight: 1.08,
          letterSpacing: "-0.03em",
          maxWidth: 720,
        }}>
          Hire the world&apos;s best business consultant.
        </h1>
        <p style={{ margin: 0, fontSize: 18, color: architect.inkMuted, maxWidth: 560, lineHeight: 1.55 }}>
          Architect learns how you work, designs your operating system, and stays with you forever.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, .8fr)", gap: 18 }}>
        <ArchitectPanel style={{ display: "grid", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Tell Architect about your business</h2>
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
          {error ? <ProductErrorBanner error={error} onRetry={() => void start()} /> : null}
          <ArchitectButton disabled={busy} onClick={() => void start()}>
            {busy ? "Opening Architect…" : "Begin the conversation"}
          </ArchitectButton>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {EXAMPLES.map((example) => (
              <button
                key={example.name}
                type="button"
                disabled={busy}
                onClick={() => void start(example.blurb)}
                style={{
                  borderRadius: 999,
                  border: `1px solid ${architect.border}`,
                  background: "transparent",
                  color: architect.inkMuted,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Try {example.name}
              </button>
            ))}
          </div>
        </ArchitectPanel>

        <ArchitectPanel>
          <h3 style={{ marginTop: 0 }}>Continue</h3>
          {loading ? (
            <div style={{ display: "grid", gap: 10 }}>
              <ArchitectSkeleton height={54} />
              <ArchitectSkeleton height={54} />
            </div>
          ) : continueSessions.length === 0 ? (
            <p style={{ color: architect.inkMuted, margin: 0 }}>Your open conversations will appear here.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {continueSessions.map((session) => (
                <Link key={session.sessionId} href={`/architect/${session.sessionId}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    borderRadius: architect.radiusSm,
                    border: `1px solid ${architect.border}`,
                    padding: 14,
                    background: "rgba(15,23,42,.55)",
                  }}>
                    <div style={{ color: architect.ink, fontWeight: 700 }}>{session.businessName}</div>
                    <div style={{ color: architect.inkMuted, fontSize: 13, marginTop: 4 }}>
                      {humanizeToken(session.progressLabel)}
                    </div>
                    {session.updatedAt ? (
                      <div style={{ color: architect.inkMuted, fontSize: 12, marginTop: 6 }}>
                        Updated {new Date(session.updatedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ArchitectPanel>
      </div>

      <ArchitectPanel style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>How it feels</h3>
        <ol style={{ margin: 0, paddingLeft: 18, color: architect.inkMuted, lineHeight: 1.75 }}>
          <li>A calm conversation — one thoughtful question at a time</li>
          <li>Live understanding of your business as Architect listens</li>
          <li>A clear plan you can preview as Owner, Manager, or teammate</li>
          <li>A guided launch — then Ask VIBETech forever</li>
        </ol>
        <div style={{ marginTop: 12, color: architect.inkMuted, fontSize: 13 }}>
          {HUMAN_COPY.proposePlan} appears when Architect knows enough — never a software form maze.
        </div>
      </ArchitectPanel>
    </ArchitectShell>
  );
}
