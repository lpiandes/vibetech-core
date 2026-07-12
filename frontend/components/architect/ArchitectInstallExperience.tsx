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
  ARCHITECT_INSTALL_STAGES,
  HUMAN_COPY,
  architectRoutes,
  humanInstallState,
  installStageProgress,
} from "./architectSemantics";
import ExecutiveBriefing from "./ExecutiveBriefing";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";

export function ArchitectDryRunClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const routes = architectRoutes(sessionId);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<ProductErrorView | null>(null);
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
      if (!response.ok || !data.ok) {
        setError(data.productError ?? presentProductError(data.error ?? data.reason ?? "dry_run_failed"));
        return;
      }
      setResult(data);
    } catch (err) {
      setError(presentProductError(err));
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
        <ArchitectBadge tone="accent">{HUMAN_COPY.launchReadiness}</ArchitectBadge>
        <h1 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.8rem, 3vw, 2.4rem)" }}>
          Everything ready for launch?
        </h1>
        <p style={{ margin: 0, color: architect.inkMuted, maxWidth: 640 }}>
          Architect checks the plan without changing your live business. Nothing is installed yet.
        </p>
      </header>

      <ArchitectPanel>
        {busy ? (
          <div style={{ display: "grid", gap: 12 }}>
            <ThinkingDots label="Preparing your launch checklist" />
            <ArchitectSkeleton height={56} />
            <ArchitectSkeleton height={56} />
            <ArchitectSkeleton height={56} />
          </div>
        ) : null}
        {error ? <ProductErrorBanner error={error} onRetry={() => void run()} /> : null}
        {checklist ? (
          <div style={{ display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{checklist.headline ?? "Launch checklist"}</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {(checklist.items ?? []).map((item: any) => {
                const ready = item.status === "ready" || item.status === "ok";
                return (
                  <div key={item.id} style={rowCard}>
                    <div style={{ fontWeight: 650 }}>{item.label}</div>
                    <ArchitectBadge tone={ready ? "success" : "warning"}>
                      {item.statusLabel
                        ?? (ready ? "Ready" : "Needs attention")}
                    </ArchitectBadge>
                  </div>
                );
              })}
            </div>
            {(checklist.warnings ?? []).length ? (
              <div style={{ ...rowCard, borderColor: "rgba(251,191,36,.35)", background: "rgba(251,191,36,.08)" }}>
                <strong>Things to review</strong>
                <ul style={{ marginBottom: 0 }}>{checklist.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            ) : null}
            <p style={{ color: architect.inkMuted, margin: 0 }}>No live records were changed.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <ArchitectButton onClick={() => router.push(routes.install)}>Continue to launch</ArchitectButton>
              <ArchitectButton variant="secondary" onClick={() => router.push(routes.session)}>Back to Architect</ArchitectButton>
              <ArchitectButton variant="ghost" disabled={busy} onClick={() => void run()}>Check again</ArchitectButton>
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
  const [error, setError] = useState<ProductErrorView | null>(null);
  const [openHref, setOpenHref] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`);
      const data = await response.json();
      if (data.ok) setWorkspace(data);
    })();
  }, [sessionId]);

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
      if (!response.ok || !data.ok) {
        setStatus("failed");
        setError(data.productError ?? presentProductError(data.error ?? data.reason ?? "install_failed"));
        return;
      }
      setStatus("installed");
      setActiveStep(ARCHITECT_INSTALL_STAGES.length - 1);
      setOpenHref(data.openHref);
    } catch (err) {
      setStatus("failed");
      setError(presentProductError(err));
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  const proposal = workspace?.proposal;
  const session = workspace?.session;
  const stages = installStageProgress(activeStep, status);
  const businessName = proposal?.businessName ?? session?.businessSummary?.businessName ?? "Your business";

  if (status === "installed") {
    return (
      <ArchitectShell maxWidth={900}>
        <ArchitectPanel style={{ padding: "40px 32px" }}>
          <ExecutiveBriefing
            proposal={proposal}
            openHref={openHref}
            onOpenPortal={() => {
              if (openHref) router.push(openHref);
            }}
            onInvite={() => {
              if (openHref) router.push(`${openHref.replace(/\/home$/, "")}/team`);
              else router.push(routes.session);
            }}
            onImprove={() => {
              const bizId = session?.businessId;
              if (bizId && !String(bizId).startsWith("draft_")) {
                router.push(`/b/${encodeURIComponent(bizId)}/architect`);
              } else {
                router.push(routes.session);
              }
            }}
          />
        </ArchitectPanel>
      </ArchitectShell>
    );
  }

  return (
    <ArchitectShell maxWidth={920}>
      <header style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        <ArchitectBadge tone="accent">Launch</ArchitectBadge>
        <h1 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.8rem, 3vw, 2.4rem)" }}>
          Create your operating system
        </h1>
        <p style={{ margin: 0, color: architect.inkMuted, maxWidth: 640 }}>
          Approval is tied to this exact plan. If anything changes, Architect will ask you to review launch readiness again.
        </p>
      </header>

      <ArchitectPanel style={{ display: "grid", gap: 18 }}>
        <h2 style={{ margin: 0 }}>{businessName}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <SummaryTile label="Workspaces" value={proposal?.views?.navigation?.items?.length ?? "—"} />
          <SummaryTile label="Your team" value={proposal?.views?.digitalWorkforce?.items?.length ?? "—"} />
          <SummaryTile label="Who sees what" value={proposal?.views?.rolesAccess?.items?.length ?? "—"} />
          <SummaryTile label="Connections" value={proposal?.views?.integrations?.items?.length ?? "—"} />
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>
            {status === "installing" ? HUMAN_COPY.installing : "What will be created"}
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            {stages.map((stage) => (
              <div key={stage.id} style={{
                ...rowCard,
                opacity: stage.state === "pending" && status !== "awaiting_approval" ? 0.55 : 1,
                borderColor: stage.state === "active" ? architect.accent : architect.border,
                animation: stage.state === "active" || stage.state === "done"
                  ? "architectAssembleIn .4s ease"
                  : undefined,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StageGlyph state={stage.state} />
                  <span style={{ fontWeight: stage.state === "active" || stage.state === "done" ? 700 : 500 }}>
                    {stage.label}
                    {stage.state === "active" ? "…" : ""}
                  </span>
                </div>
                <ArchitectBadge tone={
                  stage.state === "done" ? "success"
                    : stage.state === "failed" ? "warning"
                      : stage.state === "active" ? "accent"
                        : "neutral"
                }>
                  {humanInstallState(stage.state)}
                </ArchitectBadge>
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <ProductErrorBanner error={error} onRetry={() => void install({ resume: true })} />
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ArchitectButton disabled={busy} onClick={() => void install()}>
            {busy ? HUMAN_COPY.installing : HUMAN_COPY.approveLaunch}
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
