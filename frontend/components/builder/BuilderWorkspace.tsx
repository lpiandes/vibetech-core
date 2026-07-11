"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type ProposalViewKey =
  | "overview"
  | "navigation"
  | "dashboard"
  | "workflows"
  | "digitalWorkforce"
  | "rolesAccess"
  | "communications"
  | "campaigns"
  | "knowledge"
  | "integrations"
  | "reports"
  | "readiness"
  | "capabilityGaps";

const VIEW_LABELS: Record<ProposalViewKey, string> = {
  overview: "Overview",
  navigation: "Navigation",
  dashboard: "Dashboard",
  workflows: "Workflows",
  digitalWorkforce: "Digital Workforce",
  rolesAccess: "Roles & Access",
  communications: "Communications",
  campaigns: "Campaigns",
  knowledge: "Knowledge",
  integrations: "Integrations",
  reports: "Reports",
  readiness: "Readiness",
  capabilityGaps: "Capability Gaps",
};

/**
 * Polished Builder workspace: conversation | visual proposal | progress.
 */
export default function BuilderWorkspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [proposal, setProposal] = useState<any>(null);
  const [activeView, setActiveView] = useState<ProposalViewKey>("overview");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(action?: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
      method: action ? "POST" : "GET",
      headers: action ? { "content-type": "application/json" } : undefined,
      body: action ? JSON.stringify({ action, ...body }) : undefined,
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error ?? data.reason ?? "Something went wrong.");
    }
    if (data.session) setSession(data.session);
    if (data.proposal) setProposal(data.proposal);
    return data;
  }

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load session.");
      }
    })();
  }, [sessionId]);

  const accent = proposal?.accentColor ?? session?.appearance?.accentColor ?? "#0F766E";
  const conversation = session?.conversation ?? [];
  const nextQuestion = session?.questions?.[0] ?? null;

  async function send() {
    if (!message.trim() && !nextQuestion) return;
    setBusy(true);
    setError(null);
    try {
      if (nextQuestion) {
        await refresh("answer", { questionId: nextQuestion.questionId, answer: message.trim() || "I don't know", unknown: !message.trim() });
      } else {
        await refresh("chat", { text: message.trim() });
      }
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  }

  async function propose() {
    setBusy(true);
    setError(null);
    try {
      await refresh("propose");
      setActiveView("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not propose.");
    } finally {
      setBusy(false);
    }
  }

  const view = proposal?.views?.[activeView];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 1fr) minmax(420px, 1.4fr) minmax(240px, 0.85fr)",
        gap: spacing.lg,
        maxWidth: 1400,
        margin: "0 auto",
        padding: spacing.xl,
      }}>
        <section style={panelStyle}>
          <h1 style={titleStyle}>VIBETech Builder</h1>
          <p style={mutedStyle}>Describe your business. We propose a reusable operating system — never custom code.</p>
          <div style={{ display: "grid", gap: spacing.sm, maxHeight: 520, overflow: "auto", paddingRight: 4 }}>
            {conversation.map((entry: any) => (
              <div key={entry.messageId} style={{
                justifySelf: entry.role === "user" ? "end" : "start",
                maxWidth: "92%",
                background: entry.role === "user" ? accent : "#fff",
                color: entry.role === "user" ? "#fff" : cockpitColors.textPrimary,
                border: entry.role === "user" ? "none" : `1px solid ${cockpitColors.panelBorder}`,
                borderRadius: radius.large,
                padding: `${spacing.sm} ${spacing.md}`,
                fontSize: typography.body.fontSize,
              }}>
                {entry.text}
                {entry.metadata?.why ? <div style={{ marginTop: 6, opacity: 0.8, fontSize: typography.caption.fontSize }}>Why: {entry.metadata.why}</div> : null}
              </div>
            ))}
          </div>
          {nextQuestion ? <div style={{ ...mutedStyle, marginTop: spacing.md }}>Next: {nextQuestion.prompt}</div> : null}
          <div style={{ display: "grid", gap: spacing.sm, marginTop: spacing.md }}>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={nextQuestion ? "Type your answer…" : "Ask to change the proposal…"}
              rows={3}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void send()} disabled={busy} style={buttonStyle(accent)}>Send</button>
              <button type="button" onClick={() => void send()} disabled={busy} style={secondaryButton}>I don't know</button>
              <button type="button" onClick={() => void propose()} disabled={busy} style={secondaryButton}>Propose OS</button>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>Visual proposal</div>
              <h2 style={{ ...titleStyle, margin: 0 }}>{proposal?.businessName ?? session?.businessSummary?.businessName ?? "Your Business OS"}</h2>
            </div>
            <div style={{ width: 12, height: 12, borderRadius: 99, background: accent }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: spacing.md }}>
            {(Object.keys(VIEW_LABELS) as ProposalViewKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key)}
                style={{
                  ...chipStyle,
                  background: activeView === key ? accent : "#fff",
                  color: activeView === key ? "#fff" : cockpitColors.textPrimary,
                }}
              >
                {VIEW_LABELS[key]}
              </button>
            ))}
          </div>
          <div style={{ marginTop: spacing.lg, display: "grid", gap: spacing.md }}>
            {!proposal ? (
              <EmptyCard text="Answer a few questions, then propose your operating system." />
            ) : (
              <>
                <h3 style={{ margin: 0 }}>{view?.title ?? VIEW_LABELS[activeView]}</h3>
                {view?.headline ? <p style={mutedStyle}>{view.headline}</p> : null}
                <div style={{ display: "grid", gap: spacing.sm }}>
                  {(view?.items ?? view?.cards ?? view?.bullets ?? []).map((item: any, index: number) => (
                    <div key={item.id ?? item.label ?? index} style={cardStyle}>
                      <div style={{ fontWeight: 650 }}>{item.label ?? item.title ?? item}</div>
                      {item.purpose ? <div style={mutedStyle}>{item.purpose}</div> : null}
                      {item.emptyState ? <div style={mutedStyle}>{item.emptyState}</div> : null}
                      {item.kind ? <Badge text={String(item.kind).replace(/_/g, " ")} /> : null}
                      {Array.isArray(item.modules) ? <div style={mutedStyle}>Sees: {item.modules.join(", ") || "—"}</div> : null}
                      {item.status ? <div style={mutedStyle}>Status: {item.status}</div> : null}
                    </div>
                  ))}
                  {view?.overflow?.length ? <div style={mutedStyle}>More: {view.overflow.join(" · ")}</div> : null}
                  {view?.note ? <div style={mutedStyle}>{view.note}</div> : null}
                </div>
              </>
            )}
          </div>
        </section>

        <aside style={panelStyle}>
          <h3 style={{ marginTop: 0 }}>Progress</h3>
          <ProgressBar value={session?.progress?.percent ?? 0} accent={accent} />
          <p style={mutedStyle}>{session?.progress?.label ?? "Getting started"}</p>
          <h4>Next action</h4>
          <p style={mutedStyle}>{proposal?.nextAction ?? "Tell us about your business."}</p>
          <h4>Assumptions</h4>
          <ul style={{ paddingLeft: 18, margin: 0, color: cockpitColors.textMuted }}>
            {(proposal?.assumptions ?? session?.assumptions ?? []).slice(0, 6).map((entry: any, index: number) => (
              <li key={entry.assumptionId ?? entry.id ?? index}>{entry.text ?? entry}</li>
            ))}
          </ul>
          <h4>Unresolved</h4>
          <ul style={{ paddingLeft: 18, margin: 0, color: cockpitColors.textMuted }}>
            {(proposal?.unresolvedQuestions ?? session?.unresolvedQuestions ?? []).length
              ? (proposal?.unresolvedQuestions ?? session?.unresolvedQuestions ?? []).map((id: string) => <li key={id}>{id}</li>)
              : <li>None right now</li>}
          </ul>
          {error ? <div style={{ color: cockpitColors.warning, marginTop: spacing.md }}>{error}</div> : null}
          <div style={{ display: "grid", gap: spacing.sm, marginTop: spacing.lg }}>
            <button type="button" style={buttonStyle(accent)} disabled={!proposal || busy} onClick={() => router.push(`/builder/${sessionId}/dry-run`)}>
              Continue to dry run
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProgressBar({ value, accent }: { value: number; accent: string }) {
  return (
    <div style={{ height: 8, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: accent }} />
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <div style={{ ...cardStyle, color: cockpitColors.textMuted }}>{text}</div>;
}

function Badge({ text }: { text: string }) {
  return <span style={{ display: "inline-block", marginTop: 6, fontSize: 12, padding: "2px 8px", borderRadius: 99, background: "#F1F5F9" }}>{text}</span>;
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.large,
  padding: spacing.lg,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minHeight: 640,
};

const titleStyle: CSSProperties = {
  fontSize: "1.35rem",
  fontWeight: 700,
  margin: `0 0 ${spacing.sm}`,
};

const mutedStyle: CSSProperties = {
  color: cockpitColors.textMuted,
  fontSize: typography.body.fontSize,
  margin: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  padding: spacing.sm,
  fontSize: typography.body.fontSize,
  resize: "vertical",
};

const cardStyle: CSSProperties = {
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.medium,
  padding: spacing.md,
  background: "#FCFDFE",
};

const chipStyle: CSSProperties = {
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: 99,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
};

function buttonStyle(accent: string): CSSProperties {
  return {
    background: accent,
    color: "#fff",
    border: "none",
    borderRadius: radius.medium,
    padding: `${spacing.sm} ${spacing.md}`,
    fontWeight: 650,
    cursor: "pointer",
  };
}

const secondaryButton: CSSProperties = {
  background: "#fff",
  color: cockpitColors.textPrimary,
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.medium,
  padding: `${spacing.sm} ${spacing.md}`,
  fontWeight: 600,
  cursor: "pointer",
};
