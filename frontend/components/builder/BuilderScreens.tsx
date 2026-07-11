"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PageHeader from "@/components/product/PageHeader";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type Question = { questionId: string; prompt: string; why: string };

export default function BuilderHomePage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/builder/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName,
          websiteUrl,
          description: businessName ? `${businessName}${websiteUrl ? ` — ${websiteUrl}` : ""}` : null,
          mode: "new_business",
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

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: spacing.xl, display: "grid", gap: spacing.lg }}>
      <PageHeader
        title="Business OS Builder"
        description="Describe a business. VIBETech proposes a reusable operating system for preview, dry run, approval, and install — without writing custom app code."
      />
      <ShellPanel title="Tell us about the business">
        <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 650 }}>Business name</span>
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Northline Hockey Club"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 650 }}>Website URL (optional)</span>
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com"
              style={inputStyle}
            />
          </label>
          {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}
          <button type="button" onClick={() => void start()} disabled={busy} style={buttonStyle}>
            {busy ? "Starting…" : "Start discovery"}
          </button>
        </div>
      </ShellPanel>
    </div>
  );
}

export function BuilderDiscoveryClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ answeredCount?: number; readyForInitialProposal?: boolean; confidence?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "next_questions" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Session not found.");
        return;
      }
      setQuestions(data.nextQuestions ?? []);
      setProgress(data.progress ?? null);
    })();
  }, [sessionId]);

  async function submitAnswers() {
    setBusy(true);
    setError(null);
    try {
      let nextQuestions: Question[] = questions;
      let latestProgress = progress;
      for (const [questionId, answer] of Object.entries(answers)) {
        if (!answer.trim()) continue;
        const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "answer", questionId, answer }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not save answer.");
        nextQuestions = data.nextQuestions ?? [];
        latestProgress = data.progress;
      }
      setQuestions(nextQuestions);
      setProgress(latestProgress);
      setAnswers({});
      if (latestProgress?.readyForInitialProposal) {
        router.push(`/builder/${sessionId}/proposal`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save answers.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: spacing.xl, display: "grid", gap: spacing.lg }}>
      <PageHeader title="Discovery" description="Answer a few questions. You can propose an operating system before every detail is known." />
      <ShellPanel title="Adaptive questions">
        <div style={{ padding: spacing.md, display: "grid", gap: spacing.md }}>
          {progress ? (
            <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
              Answered {progress.answeredCount ?? 0} · Confidence {progress.confidence ?? 0}
            </div>
          ) : null}
          {questions.map((question) => (
            <label key={question.questionId} style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 650 }}>{question.prompt}</span>
              <span style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>Why: {question.why}</span>
              <input
                value={answers[question.questionId] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.questionId]: event.target.value }))}
                style={inputStyle}
              />
            </label>
          ))}
          {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void submitAnswers()} disabled={busy} style={buttonStyle}>
              {busy ? "Saving…" : "Save and continue"}
            </button>
            <Link href={`/builder/${sessionId}/proposal`} style={{ ...buttonStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Propose now
            </Link>
          </div>
        </div>
      </ShellPanel>
    </div>
  );
}

const inputStyle: CSSProperties = {
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.medium,
  padding: "10px 12px",
  fontSize: 15,
};

const buttonStyle: CSSProperties = {
  border: "none",
  borderRadius: radius.medium,
  background: cockpitColors.accent,
  color: "#fff",
  fontWeight: 700,
  padding: "10px 14px",
  cursor: "pointer",
};
