"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { buildSocialCheckerPdf } from "@/lib/social-checker/buildSocialCheckerPdf";

type Profile = {
  network?: string;
  title?: string;
  url?: string;
  snippet?: string;
  confidence?: number;
};

type Report = {
  subject: { name?: string; handle?: string | null };
  profiles: Profile[];
  byNetwork?: Record<string, Profile[]>;
  generatedAt?: string;
  disclaimer?: string;
  remaining?: number;
  limit?: number;
};

const NETWORK_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X / Twitter",
  facebook: "Facebook",
  tiktok: "TikTok",
  web: "Web",
};

export default function SocialCheckerPage() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const networksFound = useMemo(() => {
    if (!report?.profiles?.length) return 0;
    return new Set(report.profiles.map((p) => p.network || "web")).size;
  }, [report]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/social-checker/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, handle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Search failed (${res.status})`);
      }
      setReport(data as Report);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadPdf() {
    if (!report) return;
    const blob = buildSocialCheckerPdf(report);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (report.subject?.name || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `vibetech-social-checker-${slug || "report"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={page}>
      <div style={glowA} aria-hidden />
      <div style={glowB} aria-hidden />

      <header style={header}>
        <a href="https://vtechdevelopment.com" style={brandLink}>
          ← VibeTech Development
        </a>
        <span style={badge}>Social Checker</span>
      </header>

      <main style={main}>
        <p style={eyebrow}>Public presence scan</p>
        <h1 style={title}>
          Enter a name.
          <span style={titleAccent}> Get social context.</span>
        </h1>
        <p style={lede}>
          Search LinkedIn, Instagram, YouTube, X, Facebook, and TikTok for public profiles
          tied to a person or brand — then download a simple PDF summary.
        </p>

        <form onSubmit={onSearch} style={form}>
          <label style={label}>
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jordan Lee"
              required
              style={input}
              autoComplete="name"
            />
          </label>
          <label style={label}>
            Username / handle <span style={optional}>(optional)</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. jordanlee"
              style={input}
              autoComplete="off"
            />
          </label>
          <button type="submit" disabled={busy} style={cta}>
            {busy ? "Searching…" : "Search platforms"}
          </button>
        </form>

        {error ? <p style={errorBox}>{error}</p> : null}

        {report ? (
          <section style={results}>
            <div style={resultsHead}>
              <div>
                <h2 style={resultsTitle}>
                  Results for {report.subject?.name || "subject"}
                  {report.subject?.handle ? ` · @${report.subject.handle}` : ""}
                </h2>
                <p style={resultsMeta}>
                  {report.profiles.length} hits across {networksFound} networks
                  {typeof report.remaining === "number"
                    ? ` · ${report.remaining} searches left today`
                    : ""}
                </p>
              </div>
              <button type="button" onClick={downloadPdf} style={secondaryBtn}>
                Download PDF
              </button>
            </div>

            {report.profiles.length === 0 ? (
              <p style={empty}>No public profiles found for that query.</p>
            ) : (
              <div style={grid}>
                {report.profiles.map((p, i) => (
                  <article key={`${p.url}-${i}`} style={card}>
                    <div style={cardTop}>
                      <span style={networkChip}>
                        {NETWORK_LABELS[String(p.network || "web")] || p.network}
                      </span>
                      {p.confidence != null ? (
                        <span style={confidence}>{p.confidence}% match</span>
                      ) : null}
                    </div>
                    <h3 style={cardTitle}>{p.title || "Untitled result"}</h3>
                    {p.snippet ? <p style={snippet}>{p.snippet}</p> : null}
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" style={urlLink}>
                        {p.url}
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            )}

            {report.disclaimer ? <p style={disclaimer}>{report.disclaimer}</p> : null}
          </section>
        ) : null}
      </main>

      <footer style={footer}>
        A VibeTech product ·{" "}
        <a href="https://app.vtechdevelopment.com" style={footerLink}>
          AI Operating System
        </a>
      </footer>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  background: "radial-gradient(1200px 600px at 10% -10%, #1e3a8a55, transparent), radial-gradient(900px 500px at 90% 0%, #7c3aed33, transparent), #070b16",
  color: "#e8eefc",
  fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif',
};

const glowA: CSSProperties = {
  position: "absolute",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "radial-gradient(circle, #22d3ee33, transparent 70%)",
  top: "18%",
  right: "-8%",
  pointerEvents: "none",
};

const glowB: CSSProperties = {
  position: "absolute",
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "radial-gradient(circle, #6366f133, transparent 70%)",
  bottom: "8%",
  left: "-6%",
  pointerEvents: "none",
};

const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "22px clamp(20px, 5vw, 56px)",
  position: "relative",
  zIndex: 1,
};

const brandLink: CSSProperties = {
  color: "rgba(232,238,252,0.75)",
  textDecoration: "none",
  fontWeight: 650,
  fontSize: 14,
};

const badge: CSSProperties = {
  border: "1px solid rgba(125,211,252,0.35)",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#7dd3fc",
};

const main: CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 920,
  margin: "0 auto",
  padding: "24px clamp(20px, 5vw, 56px) 80px",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#67e8f9",
};

const title: CSSProperties = {
  margin: "12px 0 0",
  fontSize: "clamp(32px, 6vw, 52px)",
  lineHeight: 1.08,
  fontWeight: 850,
  letterSpacing: "-0.02em",
};

const titleAccent: CSSProperties = {
  background: "linear-gradient(90deg, #22d3ee, #a78bfa, #f472b6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const lede: CSSProperties = {
  margin: "16px 0 0",
  maxWidth: 620,
  color: "rgba(232,238,252,0.72)",
  fontSize: 17,
  lineHeight: 1.55,
  fontWeight: 500,
};

const form: CSSProperties = {
  marginTop: 32,
  display: "grid",
  gap: 14,
  maxWidth: 520,
};

const label: CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(232,238,252,0.88)",
};

const optional: CSSProperties = {
  fontWeight: 550,
  color: "rgba(232,238,252,0.45)",
};

const input: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.35)",
  background: "rgba(15,23,42,0.75)",
  color: "#f8fafc",
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 600,
  outline: "none",
};

const cta: CSSProperties = {
  marginTop: 4,
  border: "none",
  borderRadius: 12,
  padding: "13px 18px",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  color: "#04111f",
  background: "linear-gradient(90deg, #22d3ee, #818cf8)",
};

const errorBox: CSSProperties = {
  marginTop: 18,
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(244,63,94,0.12)",
  border: "1px solid rgba(244,63,94,0.35)",
  color: "#fda4af",
  fontWeight: 650,
};

const results: CSSProperties = {
  marginTop: 40,
  display: "grid",
  gap: 18,
};

const resultsHead: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  justifyContent: "space-between",
  alignItems: "flex-end",
};

const resultsTitle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 800,
};

const resultsMeta: CSSProperties = {
  margin: "6px 0 0",
  color: "rgba(232,238,252,0.55)",
  fontSize: 13,
  fontWeight: 600,
};

const secondaryBtn: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(125,211,252,0.45)",
  background: "transparent",
  color: "#7dd3fc",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const grid: CSSProperties = {
  display: "grid",
  gap: 12,
};

const card: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(15,23,42,0.55))",
  padding: "16px 18px",
  display: "grid",
  gap: 8,
};

const cardTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const networkChip: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#67e8f9",
};

const confidence: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(232,238,252,0.55)",
};

const cardTitle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 750,
};

const snippet: CSSProperties = {
  margin: 0,
  color: "rgba(232,238,252,0.7)",
  fontSize: 14,
  lineHeight: 1.45,
};

const urlLink: CSSProperties = {
  color: "#93c5fd",
  fontSize: 13,
  wordBreak: "break-all",
  fontWeight: 600,
};

const empty: CSSProperties = {
  color: "rgba(232,238,252,0.65)",
  fontWeight: 650,
};

const disclaimer: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "rgba(232,238,252,0.45)",
  lineHeight: 1.45,
};

const footer: CSSProperties = {
  position: "relative",
  zIndex: 1,
  padding: "0 clamp(20px, 5vw, 56px) 36px",
  color: "rgba(232,238,252,0.4)",
  fontSize: 13,
};

const footerLink: CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: 650,
};
