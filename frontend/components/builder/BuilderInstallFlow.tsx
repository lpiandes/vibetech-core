"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { cockpitColors, spacing } from "@/design/tokens";
import { formatProductErrorMessage } from "@/lib/platform/productErrors";
import {
  builderCanvas,
  builderCard,
  builderMuted,
  builderPanel,
  builderShell,
  builderTitle,
  primaryButton,
  secondaryButton,
  statusTone,
} from "./builderTheme";

export function BuilderDryRunClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dry_run" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.reason ?? "Dry run failed.");
      setResult(data);
    } catch (err) {
      setError(formatProductErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void run();
  }, [sessionId]);

  const checklist = result?.checklist;

  return (
    <div style={builderCanvas}>
      <div style={{ ...builderShell, maxWidth: 920 }}>
        <header style={{ display: "grid", gap: spacing.sm }}>
          <h1 style={builderTitle}>Dry run</h1>
          <p style={builderMuted}>
            We simulate installation without changing your live business. Nothing is installed yet.
          </p>
        </header>

        <section style={builderPanel}>
          {busy ? <div>Preparing your installation checklist…</div> : null}
          {error ? <div style={{ color: cockpitColors.warning }}>{error}</div> : null}
          {checklist ? (
            <div style={{ display: "grid", gap: spacing.md }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{checklist.headline}</h2>
              <div style={{ display: "grid", gap: spacing.sm }}>
                {(checklist.items ?? []).map((item: any) => {
                  const tone = statusTone(item.status);
                  return (
                    <div key={item.id} style={{ ...builderCard, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 650 }}>{item.label}</div>
                      </div>
                      <span style={{ ...tone, borderRadius: 99, padding: "4px 10px", fontSize: 12, fontWeight: 650 }}>
                        {item.statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
              {(checklist.warnings ?? []).length ? (
                <div style={{ ...builderCard, background: "#FFF7ED" }}>
                  <strong>Warnings</strong>
                  <ul style={{ marginBottom: 0 }}>{checklist.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul>
                </div>
              ) : null}
              <p style={builderMuted}>No live records were changed.</p>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                <button type="button" style={primaryButton()} onClick={() => router.push(`/builder/${sessionId}/install`)}>
                  Review and approve install
                </button>
                <button type="button" style={secondaryButton} onClick={() => router.push(`/builder/${sessionId}`)}>
                  Back to proposal
                </button>
                <button type="button" style={secondaryButton} disabled={busy} onClick={() => void run()}>
                  Re-run dry run
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function BuilderInstallClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<any>(null);
  const [status, setStatus] = useState("awaiting_approval");
  const [steps, setSteps] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [openHref, setOpenHref] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`);
      const data = await response.json();
      if (data.ok) setWorkspace(data);
    })();
  }, [sessionId]);

  async function approveOnly() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.reason ?? "Approval failed.");
      setApproved(true);
      setStatus("awaiting_approval");
    } catch (err) {
      setError(formatProductErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function install({ resume = false } = {}) {
    setBusy(true);
    setError(null);
    setStatus("installing");
    const progress = [
      "Creating your workspaces",
      "Configuring roles",
      "Installing digital employees",
      "Preparing dashboards",
      "Checking integrations",
    ];
    setSteps(progress);
    setActiveStep(0);
    const timer = setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, progress.length - 1));
    }, 450);
    try {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: resume ? "resume_install" : "install",
          approved: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? data.reason ?? "Install failed.");
      setStatus("installed");
      setActiveStep(progress.length - 1);
      setOpenHref(data.openHref);
    } catch (err) {
      setStatus("failed");
      setError(formatProductErrorMessage(err));
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  const proposal = workspace?.proposal;
  const session = workspace?.session;

  return (
    <div style={builderCanvas}>
      <div style={{ ...builderShell, maxWidth: 920 }}>
        <header style={{ display: "grid", gap: spacing.sm }}>
          <h1 style={builderTitle}>Final review & install</h1>
          <p style={builderMuted}>
            Approval is bound to this exact proposal version. If anything changes, you will need a new dry run.
          </p>
        </header>

        <section style={builderPanel}>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>{proposal?.businessName ?? session?.businessSummary?.businessName ?? "Your Business OS"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: spacing.sm }}>
            <SummaryTile label="Workspaces" value={proposal?.views?.navigation?.items?.length ?? "—"} />
            <SummaryTile label="Digital employees" value={proposal?.views?.digitalWorkforce?.items?.length ?? "—"} />
            <SummaryTile label="Roles" value={proposal?.views?.rolesAccess?.items?.length ?? "—"} />
            <SummaryTile label="Integrations" value={proposal?.views?.integrations?.items?.length ?? "—"} />
          </div>

          {(proposal?.unresolvedQuestions ?? session?.unresolvedQuestions ?? []).length ? (
            <div style={{ ...builderCard, marginTop: spacing.md, background: "#FFF7ED" }}>
              <strong>Unresolved questions</strong>
              <ul>{(proposal?.unresolvedQuestions ?? session?.unresolvedQuestions ?? []).map((id: string) => (
                <li key={id}>{String(id).replace(/^q_/, "").replace(/_/g, " ")}</li>
              ))}</ul>
            </div>
          ) : null}

          {(proposal?.views?.capabilityGaps?.items ?? []).length ? (
            <div style={{ ...builderCard, marginTop: spacing.md }}>
              <strong>Missing capabilities</strong>
              <ul>{proposal.views.capabilityGaps.items.map((item: any) => (
                <li key={item.id ?? item.label}>{item.label} · {item.kind}</li>
              ))}</ul>
            </div>
          ) : null}

          <div style={{ marginTop: spacing.lg }}>
            <p>Status: <strong>{status.replace(/_/g, " ")}</strong>{approved ? " · approval recorded" : ""}</p>
            <ul style={{ paddingLeft: 18 }}>
              {steps.map((step, index) => (
                <li key={step} style={{ fontWeight: index <= activeStep ? 700 : 400, color: index <= activeStep ? cockpitColors.textPrimary : cockpitColors.textMuted }}>
                  {step}{status === "installing" && index === activeStep ? "…" : ""}
                </li>
              ))}
            </ul>
            {error ? (
              <div style={{ color: cockpitColors.warning, marginTop: spacing.sm }}>
                {error}
                <div style={{ marginTop: 8 }}>
                  <button type="button" style={secondaryButton} disabled={busy} onClick={() => void install({ resume: true })}>
                    Retry / resume install
                  </button>
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.md }}>
              {status !== "installed" ? (
                <>
                  <button type="button" style={secondaryButton} disabled={busy || approved} onClick={() => void approveOnly()}>
                    {approved ? "Approved" : "Record approval"}
                  </button>
                  <button type="button" style={primaryButton()} disabled={busy} onClick={() => void install()}>
                    {busy ? "Installing…" : "Approve and install"}
                  </button>
                  <button type="button" style={secondaryButton} onClick={() => router.push(`/builder/${sessionId}`)}>
                    Back to proposal
                  </button>
                </>
              ) : (
                <button type="button" style={primaryButton()} onClick={() => openHref && router.push(openHref)}>
                  Open my Business OS
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={builderCard}>
      <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 750 }}>{value}</div>
    </div>
  );
}
