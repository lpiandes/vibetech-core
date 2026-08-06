"use client";

import { useContext, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { MissionControlViewModelContext } from "@/components/mission-control/MissionControlContext";
import { HomeCanvas, HomeHero } from "@/components/operating/home/EditorialHome";
import {
  humanizeHomeDecisionTitle,
  resolveBusinessDisplayName,
  scrubInternalWording,
} from "@/lib/operating/businessLanguage";
import RftLaunchPath from "@/components/home/RftLaunchPath";
import ResponsibilityGoLivePanel from "@/components/home/ResponsibilityGoLivePanel";
import {
  SimpleEmptyLine,
  SimplePanel,
  SimplePanelLink,
  SimpleRow,
} from "@/components/product/SimpleUI";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import DecisionCard from "@/components/operating/DecisionCard";
import { Button } from "@/components/ui/button";

/**
 * Today — operating brief (Plan 3).
 * No CRM count cards, no AI-teammate theater, no Setup/dashboard toggle.
 */
export default function OperatingHomeExperience() {
  const viewModel = useContext(MissionControlViewModelContext) as any;
  const experience = viewModel?.experience ?? null;
  const supervision = experience?.supervision ?? viewModel?.supervision ?? null;
  const scope = useOptionalBusinessScope();
  const businessId = scope?.businessId ?? "";
  const base = businessId ? `/b/${businessId}` : "";

  const businessName = resolveBusinessDisplayName(
    scope?.businessName,
    experience?.hero?.businessName,
    viewModel?.hero?.businessName,
    viewModel?.businessName,
  );

  if (!supervision) {
    return (
      <HomeCanvas>
        <HomeHero greeting="Welcome." />
      </HomeCanvas>
    );
  }

  const decisions = supervision.needsDecision ?? { items: [], viewAllHref: null };
  const approvals = supervision.approvalsInbox ?? { items: [], viewAllHref: null };
  const waitingItems = (decisions.items ?? [])
    .map((item: any) => presentWaitingItem(item))
    .filter((item: { href?: string | null }) => Boolean(item.href));
  const approvalItems = Array.isArray(approvals.items) ? approvals.items : [];
  const workingNow = Array.isArray(supervision.workingNow) ? supervision.workingNow : [];
  const outcomes = (supervision.recentOutcomes ?? supervision.recentActivity ?? [])
    .filter((entry: any) =>
      entry?.proven !== false
      && !/exception|unproven/i.test(String(entry.result ?? entry.status ?? entry.title ?? "")),
    )
    .slice(0, 8);
  const summary = supervision.operatingSummary ?? null;
  const greeting = supervision.greeting?.headline ?? "Good day.";
  const launchGoLiveAt = viewModel?.rftGoLiveAt
    ?? viewModel?.productContext?.installationResult?.configuration?.rftLaunch?.goLiveAt
    ?? null;
  const showRftLaunch = Boolean(businessId) && !launchGoLiveAt;

  const needsCount = waitingItems.length + approvalItems.length;
  const completedToday = outcomes.filter((entry: any) =>
    isToday(entry.timestamp ?? entry.at ?? entry.when)
    && entry.proven !== false
    && !/exception/i.test(String(entry.result ?? entry.title ?? "")),
  ).length;
  const exceptionCount = [
    ...waitingItems,
    ...approvalItems,
  ].filter((item: any) => /exception|fail|error|blocked/i.test(String(item.title ?? item.detail ?? ""))).length;
  const waitingExternally = workingNow.filter((episode: any) =>
    /wait|prospect|external/i.test(String(episode.currentStep ?? episode.status ?? "")),
  ).length;

  const healthLine = buildHealthLine({
    summary,
    needsCount,
    remainingSetup: showRftLaunch ? 1 : 0,
    businessName,
  });

  const topDecision = approvalItems[0] ?? waitingItems[0] ?? null;
  const decisionsHref = decisions.viewAllHref || (base ? `${base}/intelligence` : null);
  const outcomesHref = base ? `${base}/outcomes` : null;

  return (
    <HomeCanvas>
      <HomeHero greeting={greeting} />

      {showRftLaunch ? (
        <section
          aria-label="Launch status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.md,
            padding: "14px 18px",
            borderRadius: radius.large,
            background: "rgba(34, 211, 238, 0.08)",
            border: "1px solid rgba(34, 211, 238, 0.28)",
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 650, color: cockpitColors.textPrimary }}>
            Finish setup to go live
          </p>
          <span style={{ fontSize: 13, color: cockpitColors.accent, fontWeight: 700, whiteSpace: "nowrap" }}>
            Connect → Prove → Live
          </span>
        </section>
      ) : healthLine.headline ? (
        <section
          aria-label="Operation health"
          style={{
            ...panelStyle,
            display: "grid",
            gap: 4,
          }}
        >
          <p style={{ margin: 0, fontSize: typography.cardTitle.fontSize, fontWeight: 650, color: cockpitColors.textPrimary }}>
            {healthLine.headline}
          </p>
          {healthLine.detail ? (
            <p style={{ margin: 0, color: cockpitColors.textSecondary, fontSize: 14, lineHeight: 1.45 }}>
              {healthLine.detail}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Managed RFT: RftLaunchPath owns setup — don't stack a second dense checklist. */}
      {!showRftLaunch && viewModel?.responsibilityGoLive?.total ? (
        <ResponsibilityGoLivePanel
          businessId={businessId}
          view={viewModel.responsibilityGoLive}
        />
      ) : null}

      {showRftLaunch ? (
        <RftLaunchPath
          businessId={businessId}
          connectionStatuses={viewModel?.connectionStatuses ?? {}}
          proofRecords={viewModel?.proofRecords ?? {}}
        />
      ) : null}

      {!showRftLaunch && (completedToday > 0 || needsCount > 0 || waitingExternally > 0 || exceptionCount > 0 || workingNow.length > 0) ? (
        <section aria-label="Work handled today" style={{ display: "grid", gap: spacing.sm }}>
          <h2 style={{ margin: 0, fontSize: typography.meta.fontSize, fontWeight: 700, color: cockpitColors.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Today
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: spacing.sm }}>
            <BriefStat label="Completed" value={completedToday} href={outcomesHref} hideZero={false} />
            <BriefStat label="Needs approval" value={approvalItems.length} href={decisionsHref} tone={approvalItems.length ? "attention" : "default"} />
            <BriefStat label="Waiting on prospect" value={waitingExternally} href={base ? `${base}/work` : null} />
            <BriefStat label="Exceptions" value={exceptionCount} tone={exceptionCount ? "attention" : "default"} href={decisionsHref} />
          </div>
        </section>
      ) : null}

      <PerformanceBrief
        baseline={viewModel?.outcomesLedger?.baseline ?? viewModel?.productContext?.rftObservation?.baseline ?? null}
        metrics={viewModel?.outcomesLedger?.metrics ?? null}
        outcomesHref={outcomesHref}
        hidden={showRftLaunch}
      />

      <section aria-label="Needs you" style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: spacing.md }}>
          <h2 style={{ margin: 0, fontSize: typography.sectionTitle?.fontSize ?? 18, fontWeight: 700, color: cockpitColors.textPrimary }}>
            Needs you
          </h2>
          {decisionsHref ? (
            <Link href={decisionsHref} style={{ color: cockpitColors.accent, fontWeight: 650, fontSize: 13, textDecoration: "none" }}>
              All decisions →
            </Link>
          ) : null}
        </div>
        {!topDecision ? (
          <div style={{ ...panelStyle, color: cockpitColors.textSecondary }}>
            {launchGoLiveAt ? (
              <>
                <p style={{ margin: 0, color: cockpitColors.textPrimary, fontWeight: 650 }}>
                  Live — waiting for the next opportunity
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.45 }}>
                  Revenue Follow-Through is watching connected email and calendar.
                  When something eligible arrives, it will show up here for your approval.
                </p>
                <SeedTestDecisionButton businessId={businessId} />
              </>
            ) : (
              "Nothing waiting."
            )}
          </div>
        ) : (
          <DecisionCard
            title={String(topDecision.title ?? "Decision needed")}
            why={topDecision.detail ?? topDecision.why ?? topDecision.auditSummary ?? null}
            impact={topDecision.priority ? `Priority: ${topDecision.priority}` : null}
            timeHint={topDecision.when ?? null}
            evidence={topDecision.meta ?? null}
            actions={[
              {
                id: "review",
                label: topDecision.actionLabel ?? "Review",
                href: topDecision.href ?? topDecision.workHref ?? decisionsHref,
              },
            ]}
            askHref={base && topDecision
              ? `${base}/architect?${new URLSearchParams({
                prompt: `Why was ${String(topDecision.title ?? "this")} escalated?`,
              }).toString()}`
              : (base ? `${base}/architect` : null)}
            priority={topDecision.priority ?? null}
          />
        )}
      </section>

      {!showRftLaunch ? (
        <div className="vt-home-panel-grid">
          <SimplePanel
            title="Recent completed work"
            action={outcomesHref ? <SimplePanelLink href={outcomesHref}>Outcomes</SimplePanelLink> : null}
          >
            {!outcomes.length ? (
              <SimpleEmptyLine>No completed outcomes yet.</SimpleEmptyLine>
            ) : (
              outcomes.slice(0, 6).map((entry: any) => (
                <SimpleRow
                  key={entry.id ?? entry.title}
                  title={humanizeHomeDecisionTitle(entry.title ?? "Completed work")}
                  meta={[entry.actorLabel, formatWhen(entry.timestamp ?? entry.at)].filter(Boolean).join(" · ") || null}
                  href={entry.href ?? outcomesHref}
                  trailing={entry.href || outcomesHref ? rowAction("Open") : null}
                />
              ))
            )}
          </SimplePanel>

          <SimplePanel
            title="In motion"
            count={workingNow.length || null}
            action={base ? <SimplePanelLink href={`${base}/work`}>Work</SimplePanelLink> : null}
          >
            {!workingNow.length ? (
              <SimpleEmptyLine>Nothing live right now.</SimpleEmptyLine>
            ) : (
              workingNow.slice(0, 5).map((episode: any) => (
                <SimpleRow
                  key={episode.id}
                  title={humanizeHomeDecisionTitle(episode.title)}
                  meta={[episode.relatedLabel, episode.currentStep].filter(Boolean).join(" · ") || null}
                  href={episode.openWorkHref}
                  trailing={episode.openWorkHref ? rowAction("Open") : null}
                />
              ))
            )}
          </SimplePanel>
        </div>
      ) : null}
    </HomeCanvas>
  );
}

const panelStyle = {
  padding: spacing.lg,
  borderRadius: radius.large,
  background: cockpitColors.panel,
  border: `1px solid ${cockpitColors.panelBorder}`,
} as const;

function BriefStat({
  label,
  value,
  href,
  tone = "default",
  hideZero = false,
}: {
  label: string;
  value: number;
  href?: string | null;
  tone?: "default" | "attention";
  hideZero?: boolean;
}) {
  if (hideZero && !value) return null;
  const content = (
    <div
      style={{
        padding: spacing.md,
        borderRadius: radius.medium,
        background: cockpitColors.panel,
        border: `1px solid ${cockpitColors.panelBorder}`,
        display: "grid",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: cockpitColors.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 750, color: tone === "attention" && value > 0 ? cockpitColors.warning : cockpitColors.textPrimary }}>
        {Number.isFinite(value) ? value : 0}
      </span>
    </div>
  );
  if (!href) return content;
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {content}
    </Link>
  );
}

function PerformanceBrief({
  baseline,
  metrics,
  outcomesHref,
  hidden = false,
}: {
  baseline: any;
  metrics: any;
  outcomesHref: string | null;
  hidden?: boolean;
}) {
  if (hidden) return null;
  const first = baseline?.metrics?.firstResponse ?? null;
  const sla = metrics?.slaAttainment ?? null;
  const autoVsHuman = metrics?.autoVsHuman ?? null;
  const hasObservable =
    (first?.status === "observable" && Number.isFinite(first.medianMinutes))
    || sla?.status === "observable"
    || (autoVsHuman && (autoVsHuman.auto > 0 || autoVsHuman.human > 0));
  if (!hasObservable) return null;

  const rows: Array<{ label: string; value: string }> = [];
  if (first?.status === "observable" && Number.isFinite(first.medianMinutes)) {
    rows.push({ label: "First response", value: formatMinutes(first.medianMinutes) });
  }
  if (sla?.status === "observable") {
    rows.push({
      label: "SLA",
      value: sla.withinSla
        ? `Within ${sla.slaMinutes} min`
        : `Above ${sla.slaMinutes} min`,
    });
  }
  if (autoVsHuman && (autoVsHuman.auto > 0 || autoVsHuman.human > 0)) {
    rows.push({
      label: "Auto vs human",
      value: `${autoVsHuman.auto} auto · ${autoVsHuman.human} human`,
    });
  }

  return (
    <section aria-label="Performance" style={{ display: "grid", gap: spacing.sm }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: spacing.md }}>
        <h2 style={{ margin: 0, fontSize: typography.meta.fontSize, fontWeight: 700, color: cockpitColors.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Performance
        </h2>
        {outcomesHref ? (
          <Link href={outcomesHref} style={{ color: cockpitColors.accent, fontWeight: 650, fontSize: 13, textDecoration: "none" }}>
            Outcomes →
          </Link>
        ) : null}
      </div>
      <div style={{ ...panelStyle, display: "grid", gap: spacing.sm }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
            <span style={{ color: cockpitColors.textSecondary, fontSize: typography.meta.fontSize }}>{row.label}</span>
            <strong style={{ fontSize: typography.meta.fontSize, color: cockpitColors.textPrimary }}>{row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatMinutes(n: number) {
  const m = Math.round(Number(n) || 0);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h} hour${h === 1 ? "" : "s"}`;
}

function buildHealthLine({
  summary,
  needsCount,
  remainingSetup,
  businessName,
}: {
  summary: { headline?: string; detail?: string | null } | null;
  needsCount: number;
  remainingSetup: number;
  businessName: string;
}) {
  if (remainingSetup > 0) {
    return {
      headline: `${businessName || "This business"} is still launching.`,
      detail: "Finish the launch checklist before treating this as live.",
    };
  }
  if (needsCount > 0) {
    return {
      headline: `${businessName || "Operation"} needs your judgment.`,
      detail: scrubInternalWording(summary?.detail)
        || `${needsCount} item${needsCount === 1 ? "" : "s"} waiting in Decisions.`,
    };
  }
  const headline = scrubInternalWording(summary?.headline ?? "");
  return {
    headline: headline || `${businessName || "Operation"} is operating normally.`,
    detail: scrubInternalWording(summary?.detail ?? "") || "VIBETech is handling follow-through and will surface exceptions here.",
  };
}

function rowAction(label: string) {
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.accent, whiteSpace: "nowrap" }}>
      {label} →
    </span>
  );
}

function SeedTestDecisionButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!businessId) return null;
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/rft/launch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "seedDecision" }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok || data.ok === false) {
                setError(String(data.error ?? data.message ?? "Could not create test decision"));
                return;
              }
              router.push(`/b/${encodeURIComponent(businessId)}/intelligence`);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Network error");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? "Creating…" : "Create a test decision"}
      </Button>
      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: cockpitColors.critical ?? "#f87171" }}>{error}</p>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: cockpitColors.textMuted }}>
          Creates one Approve-and-send item so you can prove the live loop without waiting for inbound mail.
        </p>
      )}
    </div>
  );
}

function presentWaitingItem(item: any) {
  const rawTitle = String(item.title ?? "Item waiting for you");
  const reviewHref =
    item.actions?.find((action: any) => /review/i.test(String(action?.label ?? "")) && action?.href)?.href
    ?? item.actions?.find((action: any) => action?.href)?.href
    ?? item.askHref
    ?? null;
  return {
    id: String(item.id ?? rawTitle),
    title: humanizeHomeDecisionTitle(rawTitle),
    detail: scrubInternalWording(item.why ?? item.detail ?? "") || null,
    why: item.why ?? null,
    auditSummary: item.auditSummary ?? null,
    meta: item.meta ?? null,
    priority: normalizeWaitingPriority(item.priority ?? item.urgency),
    when: formatWhen(item.when ?? item.updatedAt ?? item.createdAt ?? item.ageOrDue),
    actionLabel: "Review",
    href: reviewHref,
    workHref: item.workHref ?? null,
  };
}

function normalizeWaitingPriority(priority: unknown): string | null {
  const raw = String(priority ?? "").trim().toLowerCase();
  if (!raw || raw === "neutral" || raw === "none") return null;
  if (/critical|urgent|high/.test(raw) || raw === "warning") return "high";
  if (/medium|moderate/.test(raw)) return "medium";
  if (/low/.test(raw)) return "low";
  return null;
}

function isToday(value: unknown): boolean {
  const ms = Date.parse(String(value ?? ""));
  if (!Number.isFinite(ms)) return false;
  const d = new Date(ms);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function formatWhen(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  const delta = Date.now() - ms;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
