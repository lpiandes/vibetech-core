"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { buildSocialCheckerPdf } from "@/lib/social-checker/buildSocialCheckerPdf";

type Hit = {
  network?: string;
  kind?: string;
  title?: string;
  url?: string;
  snippet?: string;
  confidence?: number;
  handle?: string | null;
};

type Platform = {
  network: string;
  label: string;
  profile: Hit | null;
  posts: Hit[];
  mentions: Hit[];
  all: Hit[];
};

type Report = {
  subject: { name?: string; handle?: string | null };
  profiles: Hit[];
  platforms?: Platform[];
  discoveredHandles?: string[];
  generatedAt?: string;
  disclaimer?: string;
  remaining?: number;
  limit?: number;
};

export default function SocialCheckerPage() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const platforms = useMemo(() => report?.platforms ?? [], [report]);
  const hitCount = report?.profiles?.length ?? 0;

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
          For each platform we resolve your profile first, then your posts, then
          posts that tag or directly mention you — Instagram, TikTok, LinkedIn, YouTube, X, and more.
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
            Username / handle <span style={optional}>(optional — improves matches)</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. jordanlee"
              style={input}
              autoComplete="off"
            />
          </label>
          <button type="submit" disabled={busy} style={cta}>
            {busy ? "Searching platforms…" : "Search platforms"}
          </button>
          {busy ? (
            <p style={busyHint}>
              Running profile + post queries across networks. This can take a little longer.
            </p>
          ) : null}
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
                  {hitCount} hits · {platforms.length} platforms
                  {typeof report.remaining === "number"
                    ? ` · ${report.remaining} searches left today`
                    : ""}
                </p>
                {report.discoveredHandles?.length ? (
                  <p style={handlesRow}>
                    Handles found:{" "}
                    {report.discoveredHandles.map((h) => (
                      <span key={h} style={handleChip}>@{h}</span>
                    ))}
                  </p>
                ) : null}
              </div>
              <button type="button" onClick={downloadPdf} style={secondaryBtn}>
                Download PDF
              </button>
            </div>

            {platforms.length === 0 ? (
              <p style={empty}>No public profiles found for that query.</p>
            ) : (
              <div style={platformStack}>
                {platforms.map((platform) => (
                  <PlatformSection key={platform.network} platform={platform} />
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

function PlatformSection({ platform }: { platform: Platform }) {
  const postCount = platform.posts?.length ?? 0;
  const mentionCount = platform.mentions?.length ?? 0;
  return (
    <section style={platformCard}>
      <header style={platformHeader}>
        <h3 style={platformTitle}>{platform.label}</h3>
        <span style={platformMeta}>
          {platform.profile ? "Profile" : "No profile"}
          {postCount ? ` · ${postCount} posts` : ""}
          {mentionCount ? ` · ${mentionCount} mentions` : ""}
        </span>
      </header>

      <div style={subsection}>
        <h4 style={subsectionTitle}>Profile</h4>
        {platform.profile ? (
          <HitCard hit={platform.profile} emphasis />
        ) : (
          <p style={emptySoft}>No public profile found yet for this name on this platform.</p>
        )}
      </div>

      <div style={subsection}>
        <h4 style={subsectionTitle}>Their posts &amp; media</h4>
        {postCount ? (
          <div style={hitStack}>
            {platform.posts.map((hit, i) => (
              <HitCard key={`${hit.url}-${i}`} hit={hit} />
            ))}
          </div>
        ) : (
          <p style={emptySoft}>No indexed posts from this profile yet.</p>
        )}
      </div>

      <div style={subsection}>
        <h4 style={subsectionTitle}>Mentions &amp; tags</h4>
        {mentionCount ? (
          <div style={hitStack}>
            {platform.mentions.map((hit, i) => (
              <HitCard key={`${hit.url}-${i}`} hit={hit} />
            ))}
          </div>
        ) : (
          <p style={emptySoft}>No direct tags or name mentions found on this platform.</p>
        )}
      </div>
    </section>
  );
}

function HitCard({ hit, emphasis = false }: { hit: Hit; emphasis?: boolean }) {
  return (
    <article style={emphasis ? hitCardEmphasis : hitCard}>
      <div style={cardTop}>
        <span style={kindChip}>{String(hit.kind || "mention").toUpperCase()}</span>
        {hit.confidence != null ? (
          <span style={confidence}>{hit.confidence}% match</span>
        ) : null}
      </div>
      <h5 style={cardTitle}>{hit.title || "Untitled result"}</h5>
      {hit.handle ? <p style={handleLine}>@{hit.handle}</p> : null}
      {hit.snippet ? <p style={snippet}>{hit.snippet}</p> : null}
      {hit.url ? (
        <a href={hit.url} target="_blank" rel="noreferrer" style={urlLink}>
          {hit.url}
        </a>
      ) : null}
    </article>
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
  maxWidth: 980,
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
  maxWidth: 680,
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

const busyHint: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "rgba(232,238,252,0.55)",
  fontWeight: 600,
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
  gap: 22,
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

const handlesRow: CSSProperties = {
  margin: "10px 0 0",
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
  fontSize: 13,
  color: "rgba(232,238,252,0.65)",
  fontWeight: 600,
};

const handleChip: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(125,211,252,0.35)",
  padding: "2px 8px",
  color: "#7dd3fc",
  fontWeight: 750,
  fontSize: 12,
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

const platformStack: CSSProperties = {
  display: "grid",
  gap: 18,
};

const platformCard: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "linear-gradient(165deg, rgba(15,23,42,0.95), rgba(15,23,42,0.6))",
  padding: "18px 18px 16px",
  display: "grid",
  gap: 16,
};

const platformHeader: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "baseline",
  borderBottom: "1px solid rgba(148,163,184,0.18)",
  paddingBottom: 10,
};

const platformTitle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 850,
  letterSpacing: "-0.01em",
};

const platformMeta: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(232,238,252,0.5)",
};

const subsection: CSSProperties = {
  display: "grid",
  gap: 8,
};

const subsectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#67e8f9",
};

const hitStack: CSSProperties = {
  display: "grid",
  gap: 8,
};

const hitCard: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(2,6,23,0.35)",
  padding: "12px 14px",
  display: "grid",
  gap: 6,
};

const hitCardEmphasis: CSSProperties = {
  ...hitCard,
  border: "1px solid rgba(34,211,238,0.35)",
  background: "linear-gradient(165deg, rgba(8,47,73,0.55), rgba(2,6,23,0.45))",
};

const cardTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const kindChip: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#a5b4fc",
};

const confidence: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(232,238,252,0.55)",
};

const cardTitle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 750,
};

const handleLine: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  color: "#7dd3fc",
};

const snippet: CSSProperties = {
  margin: 0,
  color: "rgba(232,238,252,0.7)",
  fontSize: 13,
  lineHeight: 1.45,
};

const urlLink: CSSProperties = {
  color: "#93c5fd",
  fontSize: 12,
  wordBreak: "break-all",
  fontWeight: 600,
};

const empty: CSSProperties = {
  color: "rgba(232,238,252,0.65)",
  fontWeight: 650,
};

const emptySoft: CSSProperties = {
  margin: 0,
  color: "rgba(232,238,252,0.45)",
  fontSize: 13,
  fontWeight: 600,
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
