"use client";

import { useContext, useEffect, useState } from "react";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { MissionControlViewModelContext } from "@/components/mission-control/MissionControlContext";
import { HomeCanvas, HomeHero } from "@/components/operating/home/EditorialHome";
import {
  humanizeHomeDecisionTitle,
  resolveBusinessDisplayName,
  scrubInternalWording,
} from "@/lib/operating/businessLanguage";
import LaunchCenter, { type LaunchMission } from "@/components/home/LaunchCenter";
import CrmReportingStrip from "@/components/home/CrmReportingStrip";
import {
  buildCuratedLaunchMissions,
  resolveLaunchVertical,
} from "../../../backend/core/platform/launch/buildCuratedLaunchMissions.js";
import { presentLaunchPathLabel, resolveCanonicalNavIdsForPackages } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { presentTeammateHomeGlance } from "../../../backend/core/operating-home/presentTeammateHomeGlance.js";
import {
  NextBanner,
  SimpleEmptyLine,
  SimpleMetrics,
  SimplePanel,
  SimplePanelLink,
  SimpleRow,
} from "@/components/product/SimpleUI";
import { cockpitColors } from "@/design/tokens";

type HomeViewMode = "setup" | "dashboard";

function homeViewStorageKey(businessId: string) {
  return `vt.homeView.${businessId}`;
}

/**
 * Operating Home — Setup (0/N) by default after install, with a toggle into the
 * dense operating dashboard. Dashboard always shows remaining setup.
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

  const [homeView, setHomeView] = useState<HomeViewMode>("setup");

  useEffect(() => {
    if (!businessId || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(homeViewStorageKey(businessId));
    if (stored === "dashboard" || stored === "setup") {
      setHomeView(stored);
    }
  }, [businessId]);

  function selectHomeView(next: HomeViewMode) {
    setHomeView(next);
    if (businessId && typeof window !== "undefined") {
      window.localStorage.setItem(homeViewStorageKey(businessId), next);
    }
  }

  if (!supervision) {
    return (
      <HomeCanvas>
        <HomeHero greeting="Welcome." />
      </HomeCanvas>
    );
  }

  const decisions = supervision.needsDecision ?? { items: [], viewAllHref: null };
  const approvals = supervision.approvalsInbox ?? { items: [], viewAllHref: null, emptyTitle: "No outbound approvals waiting." };
  const waitingItems = (decisions.items ?? [])
    .map((item: any) => presentWaitingItem(item))
    .filter((item: { href?: string | null }) => Boolean(item.href));
  const approvalItems = Array.isArray(approvals.items) ? approvals.items : [];
  const workingNow = supervision.workingNow ?? [];
  const workforce = mergeHomeWorkforce(
    supervision.digitalWorkforce ?? [],
    viewModel?.bosEmployees ?? [],
    businessId,
  );
  const recentActivity = (supervision.recentActivity ?? []).slice(0, 8);
  const overview = supervision.businessOverview ?? [];
  const conversations = (supervision.conversations ?? []).slice(0, 6);
  const outcomes = (supervision.recentOutcomes ?? []).slice(0, 5);

  const greeting = supervision.greeting?.headline ?? "Good day.";
  const setup = supervision.setup ?? { visible: false, incomplete: [] };
  const fullSetupChecklist = Array.isArray(viewModel?.setupChecklist)
    ? viewModel.setupChecklist
    : (setup.incomplete ?? []).map((item: any) => ({
      id: String(item.id),
      title: String(item.title),
      actionLabel: String(item.actionLabel ?? "Continue"),
      href: String(item.href ?? "#"),
      complete: false,
      summary: item.summary == null ? null : String(item.summary),
      whereInApp: item.whereInApp == null ? null : String(item.whereInApp),
      inApp: Array.isArray(item.inApp) ? item.inApp.map(String) : [],
      external: Array.isArray(item.external) ? item.external.map(String) : [],
    }));
  const launch = buildCuratedLaunchMissions({
    vertical: resolveVerticalFromScope(scope, viewModel, businessName),
    businessId: businessId || null,
    baseHref: base || null,
    connectionStatuses: viewModel?.connectionStatuses ?? {},
    proofRecords: viewModel?.proofRecords ?? {},
    checklist: fullSetupChecklist,
    connections: Array.isArray(viewModel?.connections) ? viewModel.connections : [],
    knowledgeCount: Number(viewModel?.knowledgeCount ?? 0),
    businessName,
    smsSetup: viewModel?.smsSetup ?? null,
    purchasedPackages: scope?.purchasedPackages ?? [],
  } as any);
  const launchMissions = launch.missions as LaunchMission[];
  const entitledNavIds = resolveCanonicalNavIdsForPackages(scope?.purchasedPackages ?? []);
  const navAllows = (id: string) => !entitledNavIds || entitledNavIds.has(id);
  const isDeferred = (m: LaunchMission) =>
    Boolean((m as { deferred?: boolean }).deferred) || String(m.status ?? "") === "deferred";
  const isHardBlocked = (m: LaunchMission) => Boolean(m.blocked) && !isDeferred(m);
  const setupIncomplete = Boolean(setup.visible) || launchMissions.some((m) => !m.complete && !isHardBlocked(m));
  const completeCount = launchMissions.filter((m) => m.complete && !isHardBlocked(m)).length;
  const actionableTotal = launchMissions.filter((m) => !isHardBlocked(m)).length || launchMissions.length;
  const remainingSetup = Math.max(0, actionableTotal - completeCount);

  const needsCount = waitingItems.length + approvalItems.length;
  const nextSetup = fullSetupChecklist.find((item: any) => !item.complete)
    ?? launchMissions.find((m) => !m.complete && !isHardBlocked(m) && !isDeferred(m))
    ?? null;
  const nextLabel = nextSetup
    ? String((nextSetup as any).title ?? "")
      .replace(/^Choose |^Connect |^Set up |^Add /i, "")
      .replace(/ \(.*\)$/, "")
    : null;
  const metrics = buildMetricCards({
    overview,
    waiting: needsCount,
    working: workingNow.length,
    wins: outcomes.length,
    team: workforce.length,
    base,
  });

  const showSetupFirst = setupIncomplete && homeView !== "dashboard";

  if (showSetupFirst) {
    return (
      <HomeCanvas>
        <HomeHero greeting={greeting} />
        <HomeViewToggle
          mode="setup"
          remainingSetup={remainingSetup}
          totalSetup={actionableTotal}
          onSelect={selectHomeView}
        />
        <LaunchCenter
          businessName={businessName}
          businessId={businessId || undefined}
          missions={launchMissions}
          verticalLabel={presentLaunchPathLabel({
            purchasedPackages: scope?.purchasedPackages ?? [],
            industry: resolveIndustryLabelFromScope(scope, viewModel),
          }) ?? undefined}
          liveFlags={viewModel?.liveFlags ?? {
            business_email: true,
            calendar: true,
            sms_channel: true,
            voice_channel: true,
            meta_lead_ads: true,
          }}
        />
      </HomeCanvas>
    );
  }

  return (
    <HomeCanvas>
      <HomeHero greeting={greeting} />

      <HomeViewToggle
        mode="dashboard"
        remainingSetup={remainingSetup}
        totalSetup={actionableTotal}
        onSelect={selectHomeView}
        setupAvailable={setupIncomplete}
      />

      {businessId ? (
        <CrmReportingStrip
          businessId={businessId}
          inboxHref={`${base}/inbox`}
          calendarHref={`${base}/calendar`}
          pipelinesHref={`${base}/pipelines`}
          automationsHref={`${base}/automations`}
          showCalendar={navAllows("calendar")}
          showPipelines={navAllows("pipelines")}
          showAutomations={navAllows("automations")}
        />
      ) : null}

      {setupIncomplete ? (
        <SetupRemainingStrip
          complete={completeCount}
          total={actionableTotal}
          remaining={remainingSetup}
          nextLabel={nextLabel}
          onBackToSetup={() => selectHomeView("setup")}
        />
      ) : nextSetup && nextLabel ? (
        <NextBanner label={nextLabel} href={String((nextSetup as any).href ?? "#")} />
      ) : null}

      <SimpleMetrics
        maxColumns={5}
        items={metrics.map((metric) => ({
          id: metric.id,
          label: metric.label,
          value: metric.value,
        }))}
      />

      <div className="vt-home-panel-grid">
        <SimplePanel
          title="Needs you"
          count={needsCount || null}
          action={
            needsCount && decisions.viewAllHref
              ? <SimplePanelLink href={decisions.viewAllHref}>View all</SimplePanelLink>
              : null
          }
        >
          {!needsCount ? (
            <SimpleEmptyLine>All clear.</SimpleEmptyLine>
          ) : (
            <>
              {approvalItems.slice(0, 4).map((item: any) => (
                <SimpleRow
                  key={item.id}
                  title={item.title}
                  meta={item.auditSummary || item.why || null}
                  href={item.workHref || (item.actions?.[0]?.href ?? null)}
                  trailing={rowAction("Review")}
                />
              ))}
              {waitingItems.slice(0, 4).map((item: any) => (
                <SimpleRow
                  key={item.id}
                  title={item.title}
                  meta={item.detail}
                  href={item.href}
                  trailing={rowAction(item.actionLabel ?? "Open")}
                />
              ))}
            </>
          )}
        </SimplePanel>

        <SimplePanel
          title="AI workforce"
          count={workforce.length || null}
          action={base ? <SimplePanelLink href={`${base}/team`}>Team</SimplePanelLink> : null}
        >
          {!workforce.length ? (
            <SimpleEmptyLine>No AI teammates yet.</SimpleEmptyLine>
          ) : (
            workforce.slice(0, 6).map((emp: any) => (
              <SimpleRow
                key={emp.id}
                title={emp.name}
                meta={teammateAssignment(emp) || emp.responsibility || emp.role || null}
                href={
                  emp.specialtyHref
                  || emp.detailHref
                  || emp.runJobHref
                  || (base ? `${base}/team` : null)
                }
                trailing={
                  <span style={{ fontSize: 13, fontWeight: 700, color: teammateStatusColor(emp), whiteSpace: "nowrap" }}>
                    {scrubInternalWording(emp.statusLabel || emp.status || "Active")}
                  </span>
                }
              />
            ))
          )}
        </SimplePanel>

        <SimplePanel
          title="Work queue"
          count={workingNow.length || null}
          action={base ? <SimplePanelLink href={`${base}/work`}>Work</SimplePanelLink> : null}
        >
          {!workingNow.length ? (
            <SimpleEmptyLine>Nothing live — finish a launch mission to create work.</SimpleEmptyLine>
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

      {recentActivity.length || conversations.length || outcomes.length ? (
        <div className="vt-home-panel-grid">
          <SimplePanel title="What changed">
            {(recentActivity.length ? recentActivity : outcomes).slice(0, 6).map((entry: any) => (
              <SimpleRow
                key={entry.id}
                title={humanizeHomeDecisionTitle(entry.title)}
                meta={[entry.actorLabel, formatWhen(entry.timestamp)].filter(Boolean).join(" · ") || null}
                href={entry.href}
                trailing={entry.href ? rowAction("Open") : null}
              />
            ))}
          </SimplePanel>
          {conversations.length ? (
            <SimplePanel
              title="Conversations"
              action={base ? <SimplePanelLink href={`${base}/people`}>People</SimplePanelLink> : null}
            >
              {conversations.slice(0, 5).map((entry: any) => (
                <SimpleRow
                  key={entry.id ?? entry.title}
                  title={humanizeHomeDecisionTitle(entry.title ?? entry.subject ?? "Conversation")}
                  meta={entry.channel || entry.summary || null}
                  href={entry.href ?? null}
                  trailing={entry.href ? rowAction("Open") : null}
                />
              ))}
            </SimplePanel>
          ) : null}
        </div>
      ) : null}
    </HomeCanvas>
  );
}

function HomeViewToggle({
  mode,
  remainingSetup,
  totalSetup,
  onSelect,
  setupAvailable = true,
}: {
  mode: HomeViewMode;
  remainingSetup: number;
  totalSetup: number;
  onSelect: (mode: HomeViewMode) => void;
  setupAvailable?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "inline-flex", gap: 6, padding: 4, borderRadius: 999, background: "#fff", border: "1px solid rgba(15,23,42,.08)" }}>
        <ToggleChip
          active={mode === "setup"}
          label={totalSetup > 0 ? `Setup ${Math.max(0, totalSetup - remainingSetup)}/${totalSetup}` : "Setup"}
          onClick={() => onSelect("setup")}
          disabled={!setupAvailable && mode === "dashboard"}
        />
        <ToggleChip
          active={mode === "dashboard"}
          label="Operating dashboard"
          onClick={() => onSelect("dashboard")}
        />
      </div>
      {mode === "setup" ? (
        <button
          type="button"
          onClick={() => onSelect("dashboard")}
          style={{
            border: "1px solid rgba(15,118,110,.35)",
            background: "#0f766e",
            color: "#fff",
            borderRadius: 999,
            padding: "8px 14px",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          View operating dashboard
        </button>
      ) : null}
    </div>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
  disabled = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 999,
        padding: "8px 14px",
        fontWeight: 700,
        fontSize: 13,
        cursor: disabled ? "default" : "pointer",
        background: active ? "#0f172a" : "transparent",
        color: active ? "#fff" : "#475569",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );
}

function SetupRemainingStrip({
  complete,
  total,
  remaining,
  nextLabel,
  onBackToSetup,
}: {
  complete: number;
  total: number;
  remaining: number;
  nextLabel: string | null;
  onBackToSetup: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onBackToSetup}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        textAlign: "left",
        border: "1px solid rgba(15,118,110,.22)",
        background: "linear-gradient(135deg, rgba(15,118,110,.10), rgba(255,255,255,.95))",
        borderRadius: 16,
        padding: "14px 16px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <strong style={{ fontSize: 14, color: "#0f172a" }}>
          {complete}/{total} setup complete — {remaining} left
        </strong>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          {nextLabel ? `Next: ${nextLabel}` : "Finish setup to operate fully."}
          {" · "}
          Back to setup
        </span>
      </div>
      <span style={{ fontWeight: 800, color: cockpitColors.accent, whiteSpace: "nowrap" }}>Open →</span>
    </button>
  );
}

function mergeHomeWorkforce(liveWorkforce: any[] = [], bosEmployees: any[] = [], businessId = "") {
  const byId = new Map<string, any>();
  for (const emp of Array.isArray(liveWorkforce) ? liveWorkforce : []) {
    const id = String(emp?.id ?? emp?.employeeId ?? "").trim();
    if (!id) continue;
    byId.set(id, {
      ...emp,
      responsibility: presentTeammateHomeGlance({
        purpose: emp.purpose,
        responsibility: emp.responsibility,
        role: emp.role,
        description: emp.description,
      }),
    });
  }
  const base = businessId ? `/b/${businessId}` : "";
  for (const emp of Array.isArray(bosEmployees) ? bosEmployees : []) {
    const id = String(emp?.employeeId ?? emp?.id ?? "").trim();
    if (!id || byId.has(id)) continue;
    const specialtyHref = base ? `${base}/specialty/${encodeURIComponent(id)}` : null;
    const glance = presentTeammateHomeGlance({
      purpose: emp.purpose,
      responsibility: emp.responsibility,
      role: emp.role,
      description: emp.description,
    });
    byId.set(id, {
      id,
      employeeId: id,
      name: String(emp.label ?? emp.name ?? id),
      responsibility: glance,
      role: glance,
      status: emp.packDefault ? "READY" : (emp.status ?? "READY"),
      statusLabel: emp.packDefault ? "Pack teammate" : "Active",
      specialtyHref,
      detailHref: specialtyHref ?? (base ? `${base}/team` : null),
      runJobHref: specialtyHref,
      // Ask VIBETech is separate (Architect) — never the primary teammate link.
      askHref: base ? `${base}/architect?employeeId=${encodeURIComponent(id)}` : null,
    });
  }
  return [...byId.values()];
}

function rowAction(label: string) {
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color: cockpitColors.accent, whiteSpace: "nowrap" }}>
      {label} →
    </span>
  );
}

function teammateStatusColor(emp: any) {
  if (emp.status === "needs_approval" || /needs your approval/i.test(String(emp.statusLabel ?? ""))) {
    return cockpitColors.warning;
  }
  if (emp.status === "idle" || /standing by|idle/i.test(String(emp.statusLabel ?? emp.status ?? ""))) {
    return cockpitColors.textMuted;
  }
  return cockpitColors.handled;
}

function resolveVerticalFromScope(scope: any, viewModel: any, businessName = ""): string {
  const installationResult = viewModel?.productContext?.installationResult;
  const operatingPackId = String(
    scope?.installedBusinessOS?.operatingPackId
    ?? installationResult?.configuration?.metadata?.operatingPackId
    ?? installationResult?.operatingPackId
    ?? installationResult?.metadata?.operatingPackId
    ?? "",
  );
  const industry = String(
    scope?.industry
    ?? viewModel?.productContext?.identity?.industry
    ?? viewModel?.productContext?.identity?.industryPackageId
    ?? installationResult?.configuration?.businessProfile?.industry
    ?? installationResult?.specification?.businessProfile?.industry
    ?? "",
  );
  return resolveLaunchVertical({
    operatingPackId,
    industry,
    businessName: businessName || String(scope?.businessName ?? ""),
  });
}

function resolveIndustryLabelFromScope(scope: any, viewModel: any): string {
  return String(
    scope?.industry
    ?? viewModel?.productContext?.identity?.industry
    ?? viewModel?.productContext?.identity?.industryDisplayName
    ?? viewModel?.productContext?.installationResult?.configuration?.businessProfile?.industry
    ?? "",
  );
}

function buildSubtitle({
  businessName,
  summary,
  waiting,
  approvalCount = 0,
  platformIncomplete = false,
  incompleteSetupCount = 0,
}: {
  businessName: string;
  summary?: { headline?: string; detail?: string | null } | null;
  waiting: number;
  approvalCount?: number;
  platformIncomplete?: boolean;
  incompleteSetupCount?: number;
}): string {
  if (platformIncomplete && incompleteSetupCount > 0) {
    return incompleteSetupCount === 1
      ? "Platform incomplete — finish one connection to operate."
      : `Platform incomplete — finish ${incompleteSetupCount} connections to operate.`;
  }
  if (waiting > 0) {
    return waiting === 1
      ? `Here’s what needs you at ${businessName} today.`
      : `Here’s what’s happening at ${businessName} — ${waiting} items need you.`;
  }
  if (approvalCount > 0) {
    return approvalCount === 1
      ? `One teammate is waiting on your approval at ${businessName}.`
      : `${approvalCount} teammates are waiting on your approval at ${businessName}.`;
  }
  const headline = scrubInternalWording(summary?.headline ?? "");
  if (headline) return headline;
  return `Here’s what’s happening at ${businessName} today.`;
}

/**
 * Prefer live overview metrics from the ViewModel.
 * Attention counts always match the Needs Attention queue.
 * Every metric gets a real destination when one exists.
 */
function buildMetricCards({
  overview,
  waiting,
  working,
  wins,
  team,
  base,
}: {
  overview: Array<{ id?: string; label?: string; value?: unknown; trend?: string | null }>;
  waiting: number;
  working: number;
  wins: number;
  team: number;
  base: string;
}): Array<{
  id: string;
  label: string;
  value: string | number;
  detail?: string | null;
  tone?: "default" | "attention" | "good";
  href?: string | null;
}> {
  const fromOverview = overview.slice(0, 5).map((metric, index) => {
    const label = scrubInternalWording(String(metric.label ?? "Metric"));
    const isAttentionMetric = /needs (you|decision|attention)|waiting on you/i.test(label);
    if (isAttentionMetric) {
      return {
        id: String(metric.id ?? `overview_${index}`),
        label,
        value: waiting,
        detail: waiting > 0 ? "Requires your review" : "All clear",
        tone: (waiting > 0 ? "attention" : "good") as "attention" | "good",
        href: base ? `${base}/intelligence` : null,
      };
    }
    return {
      id: String(metric.id ?? `overview_${index}`),
      label,
      value: metric.value == null || metric.value === "" ? "—" : (metric.value as string | number),
      detail: metric.trend == null ? null : scrubInternalWording(String(metric.trend)),
      tone: "default" as const,
      href: metricHrefForLabel(label, base),
    };
  });

  if (fromOverview.length >= 3) return fromOverview;

  const derived = [
    {
      id: "needs_you",
      label: "Needs you",
      value: waiting,
      detail: waiting > 0 ? "Requires your review" : "All clear",
      tone: (waiting > 0 ? "attention" : "good") as "attention" | "good",
      href: base ? `${base}/intelligence` : null,
    },
    {
      id: "in_motion",
      label: "In motion",
      value: working,
      detail: working > 0 ? "Being handled now" : "Nothing live",
      tone: "default" as const,
      href: base ? `${base}/work` : null,
    },
    {
      id: "completed_today",
      label: "Completed today",
      value: wins,
      detail: wins > 0 ? "Finished by VIBETech" : "None yet",
      tone: (wins > 0 ? "good" : "default") as "good" | "default",
      href: base ? `${base}/work` : null,
    },
    {
      id: "ai_team",
      label: "AI teammates",
      value: team,
      detail: team > 0 ? "On this business" : "Not assigned yet",
      tone: "default" as const,
      href: base ? `${base}/team` : null,
    },
  ];

  const usedLabels = new Set(fromOverview.map((m) => m.label.toLowerCase()));
  const filled = [...fromOverview];
  for (const metric of derived) {
    if (filled.length >= 5) break;
    if (usedLabels.has(metric.label.toLowerCase())) continue;
    filled.push(metric);
    usedLabels.add(metric.label.toLowerCase());
  }
  return filled.slice(0, 5);
}

function metricHrefForLabel(label: string, base: string): string | null {
  if (!base) return null;
  const lower = label.toLowerCase();
  if (/needs (you|decision|attention)|waiting on you|urgent/.test(lower)) {
    return `${base}/intelligence`;
  }
  if (/work|motion|showing|active|open work|completed/.test(lower)) {
    return `${base}/work`;
  }
  if (/inquir|lead|people|response|conversation|message/.test(lower)) {
    return `${base}/people`;
  }
  if (/team|teammate|employee/.test(lower)) {
    return `${base}/team`;
  }
  if (/inbox|sent/.test(lower)) {
    return `${base}/inbox`;
  }
  return null;
}

function presentWaitingItem(item: any) {
  const rawTitle = String(item.title ?? "Item waiting for you");
  // Prefer Needs Attention / Work destinations — Ask is available from the shell.
  const reviewHref =
    item.actions?.find((action: any) => /review/i.test(String(action?.label ?? "")) && action?.href)?.href
    ?? item.actions?.find((action: any) => action?.href)?.href
    ?? item.askHref
    ?? null;
  const shortAction = shortWaitingActionLabel(item);
  return {
    id: String(item.id ?? rawTitle),
    title: humanizeConnectionTitle(rawTitle),
    detail: usefulDetail(item.why ?? item.detail, rawTitle) ?? usefulDetail(item.proposedAction, rawTitle),
    // Use priority level (high/medium), never tone badges like "neutral".
    priority: normalizeWaitingPriority(item.priority ?? item.urgency),
    when: formatWhen(item.when ?? item.updatedAt ?? item.createdAt ?? item.ageOrDue),
    // Short CTA only — long recommendedAction sentences overflow QueueRow (nowrap) and overlay title text.
    actionLabel: shortAction,
    href: reviewHref,
  };
}

/** Queue row CTAs must stay short; full sentences belong in detail. */
function shortWaitingActionLabel(item: any): string {
  const fromAction = item.actions?.find((action: any) => action?.href && action?.label)?.label;
  const raw = scrubInternalWording(String(fromAction ?? item.proposedAction ?? "Review"));
  if (/open connections|connect/i.test(raw)) return "Connect";
  if (/open work|review work/i.test(raw)) return "Open";
  if (/^review\b/i.test(raw)) return "Review";
  if (raw.length <= 18) return raw;
  return "Review";
}

function humanizeConnectionTitle(title: string): string {
  let out = humanizeHomeDecisionTitle(title);
  out = out.replace(/\s+for production$/i, "");
  if (/^connect\s+business email$/i.test(out) || (/business email/i.test(out) && /connect/i.test(out))) {
    return "Connect business email";
  }
  if (/google calendar/i.test(out)) return "Connect Google Calendar";
  if (/text messaging|sms/i.test(out) && /connect/i.test(out)) return "Connect text messaging";
  if (/phone|voice/i.test(out) && /connect/i.test(out)) return "Connect phone";
  if (/facebook|meta lead/i.test(out) && /connect/i.test(out)) return "Connect Facebook Lead Ads";
  return out;
}

function normalizeWaitingPriority(priority: unknown): string | null {
  const raw = String(priority ?? "").trim().toLowerCase();
  if (!raw || raw === "neutral" || raw === "none") return null;
  if (/critical|urgent|high/.test(raw) || raw === "warning") return "high";
  if (/medium|moderate/.test(raw)) return "medium";
  if (/low/.test(raw)) return "low";
  return null;
}

function usefulDetail(value: string | null | undefined, title?: string | null): string | null {
  const cleaned = cleanResult(value);
  if (!cleaned) return null;
  if (/^(installed|handled|completed|sent)$/i.test(cleaned)) return null;
  const titleLower = String(title ?? "").toLowerCase();
  if (/real business provider is not yet connected/i.test(cleaned)) {
    if (/calendar/i.test(titleLower)) {
      return "Connect Google Calendar in Integrations so scheduling can run.";
    }
    if (/text|sms|messaging/i.test(titleLower)) {
      return "Connect Twilio SMS in Integrations before texting can operate.";
    }
    if (/phone|voice/i.test(titleLower)) {
      return "Connect Twilio phone in Integrations before calling can operate.";
    }
    if (/facebook|meta/i.test(titleLower)) {
      return "Connect Facebook Lead Ads in Integrations to capture leads.";
    }
    return "Connect the required account in Integrations so VIBETech can operate this channel.";
  }
  if (/complete production provider setup/i.test(cleaned)) {
    if (/calendar/i.test(titleLower)) return "Finish connecting Google Calendar in Integrations.";
    if (/text|sms|messaging/i.test(titleLower)) return "Finish connecting Twilio SMS in Integrations.";
    if (/phone|voice/i.test(titleLower)) return "Finish connecting Twilio phone in Integrations.";
    return "Finish connecting the live provider in Integrations.";
  }
  return cleaned;
}

function teammateAssignment(emp: any): string | null {
  if (emp.currentAssignment && emp.currentCustomer) {
    return `${scrubInternalWording(emp.currentAssignment)} · ${scrubInternalWording(emp.currentCustomer)}`;
  }
  if (emp.currentAssignment) return scrubInternalWording(emp.currentAssignment);
  if (emp.waitingFor) return humanizeTeammateNeed(emp.waitingFor);
  if (emp.nextAction && !/standing by/i.test(String(emp.nextAction))) {
    return humanizeTeammateNeed(emp.nextAction);
  }
  return null;
}

function humanizeTeammateNeed(value: string): string | null {
  const cleaned = scrubInternalWording(value);
  if (!cleaned) return null;
  if (/required connection missing:\s*business_email/i.test(cleaned) || /business_email/i.test(cleaned)) {
    return "Needs business email connected before this teammate can work.";
  }
  if (/required connection missing:\s*(\w+)/i.test(cleaned)) {
    return "Needs a required connection before this teammate can work.";
  }
  return cleaned;
}

function teammateActionLabel(emp: any): string {
  if (emp.status === "needs_approval") return "Review";
  if (emp.status === "blocked" || emp.status === "needs_setup") return "Unblock";
  if (emp.status === "idle" || emp.status === "waiting") return "Ask";
  return "Open";
}

function cleanResult(result: string | null | undefined): string | null {
  if (!result) return null;
  const cleaned = scrubInternalWording(result);
  if (/^(review_required|workflow_completed|sent|handled|ok|true|false|installed)$/i.test(cleaned.trim())) {
    return null;
  }
  return cleaned;
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
