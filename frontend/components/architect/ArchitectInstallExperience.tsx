"use client";

import { useEffect, useRef, useState } from "react";
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
  summarizeInstallProgress,
} from "./architectSemantics";
import ExecutiveBriefing from "./ExecutiveBriefing";
import { presentProductError, type ProductErrorView } from "@/lib/platform/productErrors";
import ProductErrorBanner from "@/components/product/ProductErrorBanner";
import { resolveBusinessDisplayName } from "@/lib/operating/businessLanguage";
import { hardNavigateToBusinessHome } from "@/lib/builder/hardNavigateToBusinessHome";

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
        const base = data.productError ?? presentProductError(data.error ?? data.reason ?? "dry_run_failed");
        const firstValidation = data.validation?.errors?.[0]?.message;
        setError(
          firstValidation
            ? { ...base, whatHappened: String(firstValidation), message: String(firstValidation) }
            : base,
        );
        return;
      }
      setResult(data);
      if (data.alreadyInstalled && data.openHref) {
        hardNavigateToBusinessHome(String(data.openHref));
      }
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
          Everything ready to go live?
        </h1>
        <p style={{ margin: 0, color: architect.inkMuted, maxWidth: 640 }}>
          VIBETech checks the recommendation without changing your live business. Nothing is live yet.
        </p>
      </header>

      <ArchitectPanel>
        {busy ? (
          <div style={{ display: "grid", gap: 12 }}>
            <ThinkingDots label="Preparing your readiness checklist" />
            <ArchitectSkeleton height={56} />
            <ArchitectSkeleton height={56} />
            <ArchitectSkeleton height={56} />
          </div>
        ) : null}
        {error ? <ProductErrorBanner error={error} onRetry={() => void run()} /> : null}
        {checklist ? (
          <div style={{ display: "grid", gap: 22 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{checklist.headline ?? "What VIBETech will set up"}</h2>
              <p style={{ margin: 0, color: architect.inkMuted, fontSize: 14, lineHeight: 1.5 }}>
                Named ingredients for your operating system — nothing goes live until you continue.
              </p>
            </div>

            <div style={readyComposition}>
              {(checklist.items ?? []).map((item: any, index: number) => {
                const ready = item.status === "ready" || item.status === "ok";
                return (
                  <div
                    key={item.id}
                    style={{
                      ...readySection,
                      animation: `architectFadeUp .35s ease ${Math.min(index, 8) * 0.04}s both`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={{ fontWeight: 750, fontSize: 15, letterSpacing: "-0.01em" }}>
                          {item.title ?? item.label}
                          <span style={{ marginLeft: 8, color: architect.inkMuted, fontWeight: 600, fontSize: 13 }}>
                            {(item.details ?? []).length}
                          </span>
                        </div>
                        {item.summary ? (
                          <div style={{ color: architect.inkMuted, fontSize: 12, lineHeight: 1.4 }}>{item.summary}</div>
                        ) : null}
                      </div>
                      <ArchitectBadge tone={ready ? "success" : "warning"}>
                        {item.statusLabel ?? (ready ? "Ready" : "Needs attention")}
                      </ArchitectBadge>
                    </div>
                    {(item.details ?? []).length ? (
                      <div style={chipRow}>
                        {(item.details as string[]).map((detail) => (
                          <span key={detail} style={chip}>{detail}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {(checklist.blocking ?? []).length ? (
              <div style={{ ...rowCard, borderColor: "rgba(251,191,36,.35)", background: "rgba(251,191,36,.08)" }} role="status">
                <strong>Remaining after open</strong>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: architect.inkMuted, lineHeight: 1.45 }}>
                  You can open the business now. Blocked responsibilities stay visible on Today until you finish them — they do not freeze the ones that are ready.
                </p>
                <ul style={{ marginBottom: 0 }}>
                  {(checklist.blocking as string[]).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}

            {(checklist.setupWalkthrough ?? []).length ? (
              <p style={{ margin: 0, color: architect.inkMuted, fontSize: 14, lineHeight: 1.55 }}>
                After you approve, finish email, calendar, SMS, and knowledge on <strong>Home</strong> (Setup missions). We do not walk those steps here.
              </p>
            ) : null}

            <p style={{ color: architect.inkMuted, margin: 0, fontSize: 13 }}>
              {result?.alreadyInstalled
                ? "This business is already live. Open Home to finish setup missions."
                : "No live records were changed."}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {result?.alreadyInstalled && result?.openHref ? (
                <ArchitectButton onClick={() => hardNavigateToBusinessHome(String(result.openHref))}>
                  Open Home
                </ArchitectButton>
              ) : (
                <ArchitectButton
                  onClick={() => router.push(`${routes.install}?launch=1`)}
                >
                  {(checklist.blocking ?? []).length > 0
                    ? "Open business — finish remaining on Today"
                    : "Open your business"}
                </ArchitectButton>
              )}
              <ArchitectButton variant="secondary" onClick={() => router.push(routes.session)}>
                Back
              </ArchitectButton>
            </div>
          </div>
        ) : null}
      </ArchitectPanel>
    </ArchitectShell>
  );
}

export function ArchitectInstallClient({
  sessionId,
  autoLaunch = false,
}: {
  sessionId: string;
  autoLaunch?: boolean;
}) {
  const router = useRouter();
  const routes = architectRoutes(sessionId);
  const [workspace, setWorkspace] = useState<any>(null);
  const [status, setStatus] = useState<"awaiting_approval" | "installing" | "installed" | "failed">("awaiting_approval");
  const [activeStep, setActiveStep] = useState(0);
  const [percent, setPercent] = useState(0);
  const [stageOverride, setStageOverride] = useState<ReturnType<typeof summarizeInstallProgress>["stages"] | null>(null);
  const [error, setError] = useState<ProductErrorView | null>(null);
  const [openHref, setOpenHref] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bootReady, setBootReady] = useState(false);
  const autoLaunchStarted = useRef(false);
  const redirectedHome = useRef(false);

  function goHome(href: string | null | undefined) {
    if (redirectedHome.current) return;
    const url = String(href ?? "").trim();
    if (!url) return;
    redirectedHome.current = true;
    hardNavigateToBusinessHome(url);
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`);
      const data = await response.json();
      if (!data.ok) {
        setBootReady(true);
        return;
      }
      setWorkspace(data);
      const stage = String(data.session?.currentStage ?? "");
      const businessId = data.session?.businessId;
      if (stage === "installed" && businessId) {
        setStatus("installed");
        setActiveStep(ARCHITECT_INSTALL_STAGES.length - 1);
        setPercent(100);
        const href = `/b/${businessId}/home`;
        setOpenHref(href);
        setBootReady(true);
        goHome(href);
        return;
      }
      if (stage === "failed" || stage === "installing") {
        setStatus("failed");
        try {
          const proposalResponse = await fetch(`/api/builder/sessions/${encodeURIComponent(sessionId)}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "get_proposal" }),
          });
          const proposalData = await proposalResponse.json();
          if (proposalData.ok) {
            const actionResults = proposalData.installation?.actionResults
              ?? proposalData.installation?.actionCheckpoints
              ?? [];
            const progress = summarizeInstallProgress(actionResults);
            setStageOverride(progress.stages);
            setActiveStep(progress.activeIndex);
            setPercent(progress.percent);
          }
          const installErrorMeta = proposalData.session?.metadata?.installError ?? null;
          setError(
            installErrorMeta?.message
              ? { ...presentProductError("install_failed"), whatHappened: String(installErrorMeta.message) }
              : presentProductError("install_failed"),
          );
        } catch {
          setError(presentProductError("install_failed"));
        }
      }
      setBootReady(true);
    })();
  }, [sessionId]);

  async function install({ resume = false } = {}) {
    setBusy(true);
    setError(null);
    setStatus("installing");
    setActiveStep(0);
    setPercent(4);
    setStageOverride(null);
    const timer = setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, ARCHITECT_INSTALL_STAGES.length - 2));
      setPercent((current) => Math.min(88, current + 7));
    }, 420);
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
        const progress = summarizeInstallProgress(
          data.actionResults
          ?? data.installation?.actionResults
          ?? data.installation?.installation?.actionCheckpoints
          ?? data.installation?.actionCheckpoints
          ?? [],
        );
        setStageOverride(progress.stages);
        setActiveStep(progress.activeIndex);
        setPercent(data.installProgress?.percent ?? progress.percent);
        setError(data.productError ?? presentProductError(data.error ?? data.reason ?? "install_failed"));
        return;
      }
      if (data.session) setWorkspace((prev: any) => ({ ...(prev ?? {}), session: data.session, proposal: prev?.proposal ?? data.proposal }));
      const progress = summarizeInstallProgress(
        data.actionResults
        ?? data.installation?.actionResults
        ?? data.installation?.installation?.actionCheckpoints
        ?? data.installation?.actionCheckpoints
        ?? [],
      );
      setStageOverride(progress.stages);
      setActiveStep(ARCHITECT_INSTALL_STAGES.length - 1);
      setPercent(data.installProgress?.percent ?? 100);
      setStatus("installed");
      const href = data.openHref ?? (data.session?.businessId ? `/b/${data.session.businessId}/home` : null);
      setOpenHref(href);
      goHome(href);
    } catch (err) {
      setStatus("failed");
      setError(presentProductError(err));
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!bootReady || !autoLaunch || autoLaunchStarted.current) return;
    if (status !== "awaiting_approval") return;
    autoLaunchStarted.current = true;
    void install();
  }, [bootReady, autoLaunch, status, sessionId]);

  const proposal = workspace?.proposal;
  const session = workspace?.session;
  const stages = stageOverride ?? installStageProgress(activeStep, status);
  const businessName = resolveBusinessDisplayName(
    proposal?.businessName,
    session?.businessSummary?.businessName,
    session?.appearance?.businessName,
  );

  if (status === "installed") {
    return (
      <ArchitectShell maxWidth={900}>
        <ArchitectPanel style={{ padding: "40px 32px" }}>
          <ExecutiveBriefing
            proposal={proposal}
            openHref={openHref}
            onOpenPortal={() => goHome(openHref)}
          />
          <p style={{ margin: "16px 0 0", color: architect.inkMuted, fontSize: 13 }}>
            Opening your business Home…
          </p>
        </ArchitectPanel>
      </ArchitectShell>
    );
  }

  return (
    <ArchitectShell maxWidth={920}>
      <header style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        <ArchitectBadge tone="accent">Go live</ArchitectBadge>
        <h1 style={{ margin: 0, fontFamily: architect.display, fontSize: "clamp(1.8rem, 3vw, 2.4rem)" }}>
          {status === "installing" || autoLaunch
            ? "Opening your business"
            : "Ready to open your business?"}
        </h1>
        <p style={{ margin: 0, color: architect.inkMuted, maxWidth: 640 }}>
          {status === "installing" || (autoLaunch && status === "awaiting_approval")
            ? "VIBETech is creating your operating system. You’ll land on Home when it’s ready — this can take a minute."
            : "One click installs your plan and takes you to Home. If anything fails, you can retry without starting over."}
        </p>
      </header>

      <ArchitectPanel style={{ display: "grid", gap: 18 }}>
        <h2 style={{ margin: 0 }}>{businessName}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <SummaryTile label="Navigation areas" value={proposal?.views?.navigation?.items?.length ?? "—"} />
          <SummaryTile label="Responsibilities" value={proposal?.views?.digitalWorkforce?.items?.length ?? "—"} />
          <SummaryTile label="Roles" value={proposal?.views?.rolesAccess?.items?.length ?? "—"} />
          <SummaryTile label="Connections to set up" value={proposal?.views?.integrations?.items?.length ?? "—"} />
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>
            {status === "installing" ? HUMAN_COPY.installing : "What will be created"}
          </h3>
          {(status === "installing" || status === "failed") ? (
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: architect.inkMuted }}>
                <span>{HUMAN_COPY.installing}</span>
                <strong style={{ color: architect.ink }}>{percent}%</strong>
              </div>
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(148,163,184,.22)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${architect.accent}, ${architect.accentSecondary ?? architect.accent})`,
                    transition: "width .35s ease",
                  }}
                />
              </div>
            </div>
          ) : null}
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
          {status !== "installing" ? (
            <ArchitectButton
              disabled={busy}
              onClick={() => void install({ resume: status === "failed" })}
            >
              {busy
                ? HUMAN_COPY.installing
                : status === "failed"
                  ? "Retry — open your business"
                  : "Open your business"}
            </ArchitectButton>
          ) : (
            <ArchitectButton disabled>
              Opening your business…
            </ArchitectButton>
          )}
          <ArchitectButton variant="ghost" disabled={busy || status === "installing"} onClick={() => router.push(routes.session)}>
            Back
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

const readyComposition = {
  borderRadius: architect.radius,
  border: `1px solid ${architect.border}`,
  background: "linear-gradient(180deg, rgba(20,184,166,.07) 0%, rgba(15,23,42,.35) 28%, rgba(12,20,26,.55) 100%)",
  padding: 6,
  display: "grid" as const,
  gap: 6,
};

const readySection = {
  borderRadius: architect.radiusSm,
  border: `1px solid ${architect.border}`,
  background: "rgba(15,23,42,.55)",
  padding: 14,
  display: "grid" as const,
  gap: 10,
};

const chipRow = {
  display: "flex" as const,
  flexWrap: "wrap" as const,
  gap: 6,
};

const chip = {
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 999,
  border: `1px solid ${architect.border}`,
  background: "rgba(2,6,23,.35)",
  color: architect.inkMuted,
};
