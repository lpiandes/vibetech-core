"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PageHeader from "@/components/product/PageHeader";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type Review = {
  sections?: Record<string, { title?: string; items?: unknown; summary?: string; name?: string; businessName?: string; employees?: Array<{ label: string; purpose: string }>; placement?: string; primary?: string[]; overflow?: string[]; campaigns?: string[]; approvalsRequired?: boolean }>;
  navigationPreview?: { primary?: string[]; overflow?: string[]; employeePlacement?: string };
  dryRun?: { completed?: boolean; mutated?: boolean; actionSummaries?: Array<{ explanation: string; outcome: string }> };
  readiness?: { state?: string; warnings?: string[]; blocking?: string[] };
};

export default function BuilderProposalClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [specification, setSpecification] = useState<unknown>(null);
  const [plan, setPlan] = useState<unknown>(null);
  const [dryRunResult, setDryRunResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "propose" }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not propose.");
        setReview(data.review);
        setSpecification(data.specification);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not propose.");
      } finally {
        setBusy(false);
      }
    })();
  }, [sessionId]);

  async function runDryRun() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dry_run", specification }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.reason ?? "Dry run failed.");
      setPlan(data.plan);
      setDryRunResult(data.dryRunResult);
      setReview(data.review);
      router.push(`/builder/${sessionId}/dry-run`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dry run failed.");
    } finally {
      setBusy(false);
    }
  }

  async function approveAndInstall() {
    setBusy(true);
    setError(null);
    try {
      let currentPlan = plan;
      let currentDry = dryRunResult;
      if (!currentPlan || !currentDry) {
        const dryResponse = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "dry_run", specification }),
        });
        const dryData = await dryResponse.json();
        if (!dryResponse.ok || !dryData.ok) throw new Error(dryData.error ?? "Dry run required.");
        currentPlan = dryData.plan;
        currentDry = dryData.dryRunResult;
        setPlan(currentPlan);
        setDryRunResult(currentDry);
        setReview(dryData.review);
      }
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "install",
          specification,
          plan: currentPlan,
          dryRunResult: currentDry,
          approved: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.reason ?? "Install failed.");
      router.push(`/builder/${sessionId}/install`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed.");
    } finally {
      setBusy(false);
    }
  }

  const sections = review?.sections ?? {};

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: spacing.xl, display: "grid", gap: spacing.lg }}>
      <PageHeader
        title="Proposed operating system"
        description="Review the recommended workspaces, workforce, and setup needs. Nothing installs until you approve a dry run."
      />
      {busy && !review ? <div>Preparing proposal…</div> : null}
      {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}
      {Object.entries(sections).map(([key, section]) => (
        <ShellPanel key={key} title={section.title ?? key}>
          <div style={{ padding: spacing.md, display: "grid", gap: spacing.sm, color: cockpitColors.textSecondary }}>
            {section.summary ? <div>{section.summary}</div> : null}
            {section.name ? <strong>{section.name}</strong> : null}
            {section.businessName ? <div>{section.businessName}</div> : null}
            {section.placement ? <div>{section.placement}</div> : null}
            {Array.isArray(section.items) ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {section.items.map((item, index) => (
                  <li key={`${key}-${index}`}>
                    {typeof item === "string" ? item : (item as { label?: string }).label ?? JSON.stringify(item)}
                  </li>
                ))}
              </ul>
            ) : null}
            {Array.isArray(section.employees) ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {section.employees.map((employee) => (
                  <li key={employee.label}><strong>{employee.label}</strong> — {employee.purpose}</li>
                ))}
              </ul>
            ) : null}
            {Array.isArray(section.campaigns) ? <div>{section.campaigns.join(", ") || "None yet"}</div> : null}
          </div>
        </ShellPanel>
      ))}
      {review?.navigationPreview ? (
        <ShellPanel title="Navigation preview">
          <div style={{ padding: spacing.md, display: "grid", gap: spacing.sm }}>
            <div>Primary: {(review.navigationPreview.primary ?? []).join(" · ")}</div>
            {(review.navigationPreview.overflow?.length ?? 0) > 0 ? (
              <div>More: {review.navigationPreview.overflow?.join(" · ")}</div>
            ) : null}
            <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
              Digital employees stay under {review.navigationPreview.employeePlacement?.replace(/_/g, " ")}.
            </div>
          </div>
        </ShellPanel>
      ) : null}
      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
        <button type="button" onClick={() => void runDryRun()} disabled={busy || !specification} style={buttonStyle}>
          Run dry run
        </button>
        <button type="button" onClick={() => void approveAndInstall()} disabled={busy || !specification} style={buttonStyle}>
          Approve and install
        </button>
        <Link href={`/builder/${sessionId}/discovery`} style={{ alignSelf: "center" }}>Back to discovery</Link>
      </div>
    </div>
  );
}

export function BuilderDryRunClient({ sessionId }: { sessionId: string }) {
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: spacing.xl, display: "grid", gap: spacing.lg }}>
      <PageHeader title="Dry run" description="Installation actions were simulated without changing business records." />
      <ShellPanel title="Next">
        <div style={{ padding: spacing.md, display: "grid", gap: spacing.sm }}>
          <div>Review the proposal again, then approve install when ready.</div>
          <Link href={`/builder/${sessionId}/proposal`}>Return to proposal</Link>
        </div>
      </ShellPanel>
    </div>
  );
}

export function BuilderInstallClient({ sessionId }: { sessionId: string }) {
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: spacing.xl, display: "grid", gap: spacing.lg }}>
      <PageHeader title="Installed" description="The approved operating system configuration was installed for this builder session." />
      <ShellPanel title="Recovery">
        <div style={{ padding: spacing.md, display: "grid", gap: spacing.sm }}>
          <div>Install actions are idempotent. Re-running the same approved plan will no-op safely.</div>
          <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>Session {sessionId}</div>
          <Link href="/builder">Start another business</Link>
        </div>
      </ShellPanel>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  border: "none",
  borderRadius: radius.medium,
  background: cockpitColors.accent,
  color: "#fff",
  fontWeight: 700,
  padding: "10px 14px",
  cursor: "pointer",
};
