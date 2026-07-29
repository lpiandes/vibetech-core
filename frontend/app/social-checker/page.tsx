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
  relation?: string;
};

type Platform = {
  network: string;
  label: string;
  profile: Hit | null;
  profiles?: Hit[];
  posts: Hit[];
  tags?: Hit[];
  mentions: Hit[];
  all: Hit[];
  visibility?: "private" | "public" | "unknown";
  postsEmptyReason?: string | null;
  tagsEmptyReason?: string | null;
  tagsNote?: string | null;
};

type Report = {
  subject: {
    name?: string;
    handle?: string | null;
    handlesByPlatform?: Record<string, string>;
  };
  profiles: Hit[];
  platforms?: Platform[];
  discoveredHandles?: string[];
  generatedAt?: string;
  disclaimer?: string;
  remaining?: number;
  limit?: number;
};

const HANDLE_PLATFORMS = [
  { id: "instagram", label: "Instagram", placeholder: "yourhandle" },
  { id: "tiktok", label: "TikTok", placeholder: "yourhandle" },
  { id: "linkedin", label: "LinkedIn", placeholder: "slug-or-handle" },
  { id: "youtube", label: "YouTube", placeholder: "channelhandle" },
  { id: "x", label: "X", placeholder: "username" },
  { id: "facebook", label: "Facebook", placeholder: "username" },
  { id: "threads", label: "Threads", placeholder: "yourhandle" },
  { id: "reddit", label: "Reddit", placeholder: "username" },
  { id: "github", label: "GitHub", placeholder: "username" },
] as const;

type PlatformId = (typeof HANDLE_PLATFORMS)[number]["id"];

export default function SocialCheckerPage() {
  const [name, setName] = useState("");
  const [handlesByPlatform, setHandlesByPlatform] = useState<Partial<Record<PlatformId, string>>>({});
  const [activePlatform, setActivePlatform] = useState<PlatformId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const platforms = useMemo(() => report?.platforms ?? [], [report]);
  const hitCount = report?.profiles?.length ?? 0;
  const filledHandles = useMemo(
    () => Object.entries(handlesByPlatform).filter(([, v]) => String(v ?? "").trim().length >= 2),
    [handlesByPlatform],
  );

  function setHandle(platformId: PlatformId, value: string) {
    const cleaned = value.replace(/^@+/, "");
    setHandlesByPlatform((prev) => {
      const next = { ...prev };
      if (!cleaned.trim()) delete next[platformId];
      else next[platformId] = cleaned;
      return next;
    });
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payloadHandles: Record<string, string> = {};
      for (const [id, value] of Object.entries(handlesByPlatform)) {
        const h = String(value ?? "").trim().replace(/^@/, "");
        if (h.length >= 2) payloadHandles[id] = h;
      }
      const res = await fetch("/api/social-checker/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, handlesByPlatform: payloadHandles }),
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

  const activeMeta = HANDLE_PLATFORMS.find((p) => p.id === activePlatform) ?? null;

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
          We find their profile, their own posts, @tags of them, and clear name
          mentions — across Instagram, TikTok, LinkedIn, YouTube, X, and more.
          Unrelated results are dropped so the report stays reliable.
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

          <div style={handlesBlock}>
            <div style={handlesLabelRow}>
              <span style={labelText}>
                Platform handles{" "}
                <span style={optional}>(optional — recommended)</span>
              </span>
              <span style={handlesHint}>Tap an icon, then type that handle</span>
            </div>

            <div style={iconRow} role="list">
              {HANDLE_PLATFORMS.map((p) => {
                const filled = Boolean(String(handlesByPlatform[p.id] ?? "").trim());
                const selected = activePlatform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="listitem"
                    aria-pressed={selected}
                    aria-label={`${p.label} handle${filled ? ` (@${handlesByPlatform[p.id]})` : ""}`}
                    title={filled ? `${p.label}: @${handlesByPlatform[p.id]}` : p.label}
                    onClick={() => setActivePlatform(selected ? null : p.id)}
                    style={{
                      ...iconBtn,
                      ...(selected ? iconBtnSelected : {}),
                      ...(filled && !selected ? iconBtnFilled : {}),
                    }}
                  >
                    <PlatformGlyph id={p.id} />
                    {filled ? <span style={dot} aria-hidden /> : null}
                  </button>
                );
              })}
            </div>

            {activeMeta ? (
              <label style={handleInputLabel}>
                {activeMeta.label} handle
                <div style={handleInputRow}>
                  <span style={atPrefix}>@</span>
                  <input
                    value={handlesByPlatform[activeMeta.id] ?? ""}
                    onChange={(e) => setHandle(activeMeta.id, e.target.value)}
                    placeholder={activeMeta.placeholder}
                    style={handleInput}
                    autoComplete="off"
                    autoFocus
                  />
                  {handlesByPlatform[activeMeta.id] ? (
                    <button
                      type="button"
                      style={clearHandleBtn}
                      onClick={() => setHandle(activeMeta.id, "")}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </label>
            ) : (
              <p style={pickHint}>
                {filledHandles.length
                  ? `${filledHandles.length} handle${filledHandles.length === 1 ? "" : "s"} set — tap another icon to add more.`
                  : "Handles are optional but strongly improve profile, post, tag, and mention accuracy."}
              </p>
            )}

            {filledHandles.length ? (
              <div style={chipRow}>
                {filledHandles.map(([id, value]) => {
                  const meta = HANDLE_PLATFORMS.find((p) => p.id === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      style={handleChipBtn}
                      onClick={() => setActivePlatform(id as PlatformId)}
                    >
                      {meta?.label ?? id}: @{value}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button type="submit" disabled={busy} style={cta}>
            {busy ? "Searching platforms…" : "Search platforms"}
          </button>
          {busy ? (
            <p style={busyHint}>
              Running profile → posts → tags → mentions across networks. This can take a little longer.
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
                </h2>
                <p style={resultsMeta}>
                  {hitCount} hits · {platforms.length} platforms
                  {typeof report.remaining === "number"
                    ? ` · ${report.remaining} searches left today`
                    : ""}
                </p>
                {report.subject?.handlesByPlatform
                && Object.keys(report.subject.handlesByPlatform).length ? (
                  <p style={handlesRow}>
                    Handles used:{" "}
                    {Object.entries(report.subject.handlesByPlatform).map(([net, h]) => (
                      <span key={net} style={handleChip}>
                        {net}: @{h}
                      </span>
                    ))}
                  </p>
                ) : null}
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
  const profileList = platform.profiles?.length
    ? platform.profiles
    : (platform.profile ? [platform.profile] : []);
  const postCount = platform.posts?.length ?? 0;
  const tagCount = platform.tags?.length ?? 0;
  const mentionCount = platform.mentions?.length ?? 0;
  const isPrivate = platform.visibility === "private";
  return (
    <section style={platformCard}>
      <header style={platformHeader}>
        <h3 style={platformTitle}>
          {platform.label}
          {isPrivate ? <span style={privateBadge}>Private</span> : null}
        </h3>
        <span style={platformMeta}>
          {profileList.length
            ? `${profileList.length} profile${profileList.length === 1 ? "" : "s"}`
            : "No profile"}
          {postCount ? ` · ${postCount} posts` : ""}
          {tagCount ? ` · ${tagCount} tags` : ""}
          {mentionCount ? ` · ${mentionCount} mentions` : ""}
        </span>
      </header>

      <div style={subsection}>
        <h4 style={subsectionTitle}>
          {profileList.length > 1 ? "Profiles" : "Profile"}
        </h4>
        {profileList.length ? (
          <div style={hitStack}>
            {profileList.map((hit, i) => (
              <HitCard key={`${hit.url}-profile-${i}`} hit={hit} emphasis={i === 0} />
            ))}
          </div>
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
          <p style={isPrivate ? privateMsg : emptySoft}>
            {platform.postsEmptyReason
              || (isPrivate
                ? "Private profile — can't extract their posts."
                : "No indexed posts from this profile yet.")}
          </p>
        )}
      </div>

      <div style={subsection}>
        <h4 style={subsectionTitle}>Tags (@mentions of them)</h4>
        {platform.tagsNote ? <p style={privateMsg}>{platform.tagsNote}</p> : null}
        {tagCount ? (
          <div style={hitStack}>
            {(platform.tags ?? []).map((hit, i) => (
              <HitCard key={`${hit.url}-tag-${i}`} hit={hit} />
            ))}
          </div>
        ) : (
          <p style={isPrivate ? privateMsg : emptySoft}>
            {platform.tagsEmptyReason
              || (isPrivate
                ? "Private profile — can't extract their Tagged tab."
                : "No @tags of this person found on this platform.")}
          </p>
        )}
      </div>

      <div style={subsection}>
        <h4 style={subsectionTitle}>Name mentions</h4>
        {mentionCount ? (
          <div style={hitStack}>
            {platform.mentions.map((hit, i) => (
              <HitCard key={`${hit.url}-m-${i}`} hit={hit} />
            ))}
          </div>
        ) : (
          <p style={emptySoft}>No clear name mentions found on this platform.</p>
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

function PlatformGlyph({ id }: { id: PlatformId }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true as const };
  switch (id) {
    case "instagram":
      return (
        <svg {...common}>
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M16.5 3c.6 2.2 2.2 3.8 4.5 4.3v2.6c-1.7-.1-3.2-.7-4.5-1.7v6.5c0 3.5-2.8 6.3-6.3 6.3S4 18.2 4 14.7c0-3.4 2.7-6.1 6-6.3v2.7c-1.9.2-3.3 1.8-3.3 3.7 0 2 1.6 3.6 3.6 3.6s3.6-1.6 3.6-3.6V3h2.6z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common}>
          <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V23h-4V8.5zM8.5 8.5h3.8v2h.1c.5-1 1.8-2.1 3.8-2.1 4 0 4.8 2.6 4.8 6V23h-4v-6.5c0-1.6 0-3.6-2.2-3.6s-2.5 1.7-2.5 3.5V23h-4V8.5z" transform="translate(1 0) scale(0.92)" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common}>
          <path d="M23.5 7.2a3 3 0 0 0-2.1-2.1C19.5 4.5 12 4.5 12 4.5s-7.5 0-9.4.6A3 3 0 0 0 .5 7.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-4.8zM9.8 15.5v-7l6.3 3.5-6.3 3.5z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.3 22H3.2l7.3-8.4L1 2h6.5l4.4 5.8L18.9 2zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l1-3h-4v-2c0-.6.4-1 1-1z" />
        </svg>
      );
    case "threads":
      return (
        <svg {...common}>
          <path d="M12.1 2c3.6 0 6.2 1.5 6.2 5 0 2.1-.9 3.6-2.5 4.4 1.6.7 2.6 2.2 2.6 4.2 0 3.7-3 5.4-6.4 5.4-2.3 0-4.2-.7-5.5-1.9l1.4-1.7c1 .9 2.4 1.4 4.1 1.4 2.1 0 3.6-.9 3.6-2.7 0-1.6-1.1-2.5-3.4-2.5h-1.1v-2.2h1c1.9 0 3-1 3-2.5 0-1.5-1.1-2.4-3-2.4-1.7 0-2.9.8-3.2 2.1L6.4 7.5C7.1 4.6 9.3 2 12.1 2z" />
        </svg>
      );
    case "reddit":
      return (
        <svg {...common}>
          <path d="M14.4 3.2 16.7 8c1.1-.3 2.1-.1 2.9.4a2.1 2.1 0 1 1-1.3 3.8c-.4.2-1.1.4-1.9.5.2 3.3-2.1 5.6-5.4 5.6S5.9 15.9 6.1 12.7c-.8-.1-1.5-.3-1.9-.5A2.1 2.1 0 1 1 2.9 8.4c.8-.5 1.8-.7 2.9-.4l2.3-4.8 1.8.9L8.6 8.6c1.1-.2 2.2-.2 3.3 0l1.3-4.5 1.2.1zM9.3 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm5.4 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm-5.3 2.1c.7.7 1.7 1 2.8 1s2.1-.3 2.8-1l.9.9c-1 1-2.3 1.5-3.7 1.5s-2.7-.5-3.7-1.5l.9-.9z" />
        </svg>
      );
    case "github":
      return (
        <svg {...common}>
          <path d="M12 .5A11.5 11.5 0 0 0 8.3 22.9c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
        </svg>
      );
    default:
      return null;
  }
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
  gap: 16,
  maxWidth: 560,
};

const label: CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(232,238,252,0.88)",
};

const labelText: CSSProperties = {
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

const handlesBlock: CSSProperties = {
  display: "grid",
  gap: 12,
};

const handlesLabelRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "space-between",
  alignItems: "baseline",
};

const handlesHint: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "rgba(232,238,252,0.45)",
};

const iconRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const iconBtn: CSSProperties = {
  position: "relative",
  width: 48,
  height: 48,
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.28)",
  background: "rgba(15,23,42,0.7)",
  color: "rgba(232,238,252,0.75)",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  padding: 0,
};

const iconBtnSelected: CSSProperties = {
  border: "1px solid rgba(34,211,238,0.65)",
  background: "rgba(8,47,73,0.75)",
  color: "#67e8f9",
  boxShadow: "0 0 0 1px rgba(34,211,238,0.25)",
};

const iconBtnFilled: CSSProperties = {
  border: "1px solid rgba(167,139,250,0.45)",
  color: "#c4b5fd",
};

const dot: CSSProperties = {
  position: "absolute",
  top: 7,
  right: 7,
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#22d3ee",
};

const handleInputLabel: CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(232,238,252,0.88)",
};

const handleInputRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 0,
  borderRadius: 12,
  border: "1px solid rgba(34,211,238,0.4)",
  background: "rgba(15,23,42,0.85)",
  overflow: "hidden",
};

const atPrefix: CSSProperties = {
  padding: "0 0 0 14px",
  color: "#7dd3fc",
  fontWeight: 800,
  fontSize: 15,
};

const handleInput: CSSProperties = {
  flex: 1,
  border: "none",
  background: "transparent",
  color: "#f8fafc",
  padding: "12px 10px",
  fontSize: 15,
  fontWeight: 600,
  outline: "none",
  minWidth: 0,
};

const clearHandleBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(232,238,252,0.55)",
  fontWeight: 700,
  fontSize: 12,
  padding: "0 14px",
  cursor: "pointer",
};

const pickHint: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "rgba(232,238,252,0.5)",
  fontWeight: 600,
  lineHeight: 1.45,
};

const chipRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const handleChipBtn: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(125,211,252,0.35)",
  background: "rgba(8,47,73,0.45)",
  color: "#7dd3fc",
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
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
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};

const privateBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#fda4af",
  border: "1px solid rgba(244,63,94,0.4)",
  borderRadius: 999,
  padding: "3px 8px",
};

const privateMsg: CSSProperties = {
  margin: 0,
  color: "#fda4af",
  fontSize: 13,
  fontWeight: 650,
  lineHeight: 1.45,
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
