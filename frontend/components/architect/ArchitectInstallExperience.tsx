"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { architect } from "./architectTheme";
import {
  ArchitectBadge,
  ArchitectButton,
  ArchitectPanel,
  ArchitectShell,
  ArchitectSkeleton,
  ThinkingDots,
} from "./ArchitectPrimitives";
import {
  ARCHITECT_COMPLETION_ACTIONS,
  ARCHITECT_INSTALL_STAGES,
  architectRoutes,
  installStageProgress,
} from "./architectSemantics";

export function ArchitectDryRunClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const routes = architectRoutes(sessionId);
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
      setError(err instanceof Error ? err.message : "Dry run failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void run();
  }, [sessionId]);

  const checklist = result?.checklist;

  return (
    <ArchitectShell maxWidth={920}>
      <header style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        <ArchitectBadge tone="accent">Dry run</ArchitectBadge>
        <h1 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.8rem, 3vw, 2.4rem)" }}>
          Simulate installation
        </h1>
        <p style={{ margin: 0, color: architect.inkMuted, maxWidth: 640 }}>
          Architect rehearses the install without changing your live business. Nothing is installed yet.
        </p>
      </header>

      <ArchitectPanel>
        {busy ? (
          <div style={{ display: "grid", gap: 12 }}>
            <ThinkingDots label="Preparing your installation checklist" />
            <ArchitectSkeleton height={56} />
            <ArchitectSkeleton height={56} />
            <ArchitectSkeleton height={56} />
          </div>
        ) : null}
        {error ? <div style={{ color: architect.danger }} role="alert">{error}</div> : null}
        {checklist ? (
          <div style={{ display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{checklist.headline}</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {(checklist.items ?? []).map((item: any) => (
                <div key={item.id} style={rowCard}>
                  <div style={{ fontWeight: 650 }}>{item.label}</div>
                  <ArchitectBadge tone={item.status === "ready" || item.status === "ok" ? "success" : "warning"}>
                    {item.statusLabel ?? String(item.status).replace(/_/g, " ")}
                  </ArchitectBadge>
                </div>
              ))}
            </div>
            {(checklist.warnings ?? []).length ? (
              <div style={{ ...rowCard, borderColor: "rgba(251,191,36,.35)", background: "rgba(251,191,36,.08)" }}>
                <strong>Warnings</strong>
                <ul style={{ marginBottom: 0 }}>{checklist.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            ) : null}
            <p style={{ color: architect.inkMuted, margin: 0 }}>No live records were changed.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ArchitectButton onClick={() => router.push(routes.install)}>Review and approve install</ArchitectButton>
              <ArchitectButton variant="secondary" onClick={() => router.push(routes.session)}>Back to Architect</ArchitectButton>
              <ArchitectButton variant="ghost" disabled={busy} onClick={() => void run()}>Re-run dry run</ArchitectButton>
            </div>
          </div>
        ) : null}
      </ArchitectPanel>
    </ArchitectShell>
  );
}

export function ArchitectInstallClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const routes = architectRoutes(sessionId);
  const [workspace, setWorkspace] = useState<any>(null);
  const [status, setStatus] = useState<"awaiting_approval" | "installing" | "installed" | "failed">("awaiting_approval");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  async function install({ resume = false } = {}) {
    setBusy(true);
    setError(null);
    setStatus("installing");
    setActiveStep(0);
    const timer = setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, ARCHITECT_INSTALL_STAGES.length - 1));
    }, 520);
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
      setActiveStep(ARCHITECT_INSTALL_STAGES.length - 1);
      setOpenHref(data.openHref);
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Install failed.");
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  const proposal = workspace?.proposal;
  const session = workspace?.session;
  const stages = installStageProgress(activeStep, status);
  const businessName = proposal?.businessName ?? session?.businessSummary?.businessName ?? "Your Business OS";

  if (status === "installed") {
    return (
      <ArchitectShell maxWidth={820}>
        <ArchitectPanel style={{ textAlign: "center", padding: "48px 32px", display: "grid", gap: 18, animation: "architectFadeUp .6s ease" }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>✦</div>
          <ArchitectBadge tone="success">Installation complete</ArchitectBadge>
          <h1 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(2rem, 4vw, 2.8rem)" }}>
            Your Business OS is ready.
          </h1>
          <p style={{ margin: "0 auto", color: architect.inkMuted, maxWidth: 480, fontSize: 17 }}>
            {businessName} is installed. Architect stays with you forever via Ask VIBETech — never restart discovery.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
            {ARCHITECT_COMPLETION_ACTIONS.map((action) => (
              <ArchitectButton
                key={action.id}
                variant={action.id === "open_portal" ? "primary" : "secondary"}
                onClick={() => {
                  if (action.id === "open_portal" && openHref) router.push(openHref);
                  else if (action.id === "invite" && openHref) router.push(`${openHref.replace(/\/home$/, "")}/settings`);
                  else router.push(routes.session);
                }}
              >
                {action.label}
              </ArchitectButton>
            ))}
          </div>
        </ArchitectPanel>
      </ArchitectShell>
    );
  }

  return (
    <ArchitectShell maxWidth={920}>
      <header style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        <ArchitectBadge tone="accent">Install</ArchitectBadge>
        <h1 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.8rem, 3vw, 2.4rem)" }}>
          Final review & install
        </h1>
        <p style={{ margin: 0, color: architect.inkMuted, maxWidth: 640 }}>
          Approval is bound to this exact proposal. If anything changes, Architect will ask for a new dry run.
        </p>
      </header>

      <ArchitectPanel style={{ display: "grid", gap: 18 }}>
        <h2 style={{ margin: 0 }}>{businessName}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <SummaryTile label="Workspaces" value={proposal?.views?.navigation?.items?.length ?? "—"} />
          <SummaryTile label="Employees" value={proposal?.views?.digitalWorkforce?.items?.length ?? "—"} />
          <SummaryTile label="Roles" value={proposal?.views?.rolesAccess?.items?.length ?? "—"} />
          <SummaryTile label="Integrations" value={proposal?.views?.integrations?.items?.length ?? "—"} />
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Installation stages</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {stages.map((stage) => (
              <div key={stage.id} style={{
                ...rowCard,
                opacity: stage.state === "pending" ? 0.55 : 1,
                borderColor: stage.state === "active" ? architect.accent : architect.border,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StageGlyph state={stage.state} />
                  <span style={{ fontWeight: stage.state === "active" || stage.state === "done" ? 700 : 500 }}>
                    {stage.label}
                    {stage.state === "active" ? "…" : ""}
                  </span>
                </div>
                <ArchitectBadge tone={stage.state === "done" ? "success" : stage.state === "failed" ? "warning" : stage.state === "active" ? "accent" : "neutral"}>
                  {stage.state}
                </ArchitectBadge>
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <div style={{ color: architect.danger }} role="alert">
            {error}
            <div style={{ marginTop: 10 }}>
              <ArchitectButton variant="secondary" disabled={busy} onClick={() => void install({ resume: true })}>
                Retry / resume install
              </ArchitectButton>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ArchitectButton variant="secondary" disabled={busy || approved} onClick={() => void approveOnly()}>
            {approved ? "Approved" : "Record approval"}
          </ArchitectButton>
          <ArchitectButton disabled={busy} onClick={() => void install()}>
            {busy ? "Installing…" : "Approve and install"}
          </ArchitectButton>
          <ArchitectButton variant="ghost" onClick={() => router.push(routes.session)}>
            Back to Architect
          </ArchitectButton>
        </div>
      </ArchitectPanel>
    </ArchitectShell>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={rowCard}>
      <div style={{ fontSize: 12, color: architect.inkMuted }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 750 }}>{value}</div>
    </div>
  );
}

function StageGlyph({ state }: { state: string }) {
  if (state === "done") return <span style={{ color: architect.success }}>✓</span>;
  if (state === "active") {
    return (
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `2px solid ${architect.accent}`,
          borderTopColor: "transparent",
          display: "inline-block",
          animation: "architectSpin .8s linear infinite",
        }}
      />
    );
  }
  if (state === "failed") return <span style={{ color: architect.danger }}>!</span>;
  return <span style={{ color: architect.inkMuted }}>○</span>;
}

const rowCard = {
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(15,23,42,.55)",
  padding: 14,
  display: "flex" as const,
  justifyContent: "space-between" as const,
  gap: 12,
  alignItems: "center" as const,
};
