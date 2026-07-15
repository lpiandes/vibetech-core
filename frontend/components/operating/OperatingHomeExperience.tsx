"use client";

import { useContext } from "react";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import { MissionControlViewModelContext } from "@/components/mission-control/MissionControlContext";
import {
  HomeCanvas,
  HomeHero,
  MetricStrip,
  DashGrid,
  DashCard,
  QueueRow,
  ActivityItem,
  WorkforceRow,
  SituationRow,
  CommRow,
  EmptyLine,
  QuietLink,
} from "@/components/operating/home/EditorialHome";
import {
  humanizeHomeDecisionTitle,
  resolveBusinessDisplayName,
  scrubInternalWording,
} from "@/lib/operating/businessLanguage";
import SetupChecklistBanner from "@/components/home/SetupChecklistBanner";

/**
 * Operating Home — mockup-density dashboard from live supervision only.
 * Interactive chrome only when a real destination exists.
 * Ask lives in the shell (sidebar / top bar), not as a home composer.
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
        <HomeHero
          greeting="Welcome."
          subtitle="VIBETech is gathering live signals for this business."
        />
      </HomeCanvas>
    );
  }

  const decisions = supervision.needsDecision ?? { items: [], viewAllHref: null };
  const approvals = supervision.approvalsInbox ?? { items: [], viewAllHref: null, emptyTitle: "No outbound approvals waiting." };
  // Same queue as Needs Attention (/intelligence) — never invent items from outcome titles.
  const waitingItems = (decisions.items ?? [])
    .map((item: any) => presentWaitingItem(item))
    .filter((item: { href?: string | null }) => Boolean(item.href));
  const approvalItems = Array.isArray(approvals.items) ? approvals.items : [];
  const workingNow = supervision.workingNow ?? [];
  const workforce = supervision.digitalWorkforce ?? [];
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
  const subtitle = buildSubtitle({
    businessName,
    summary: supervision.operatingSummary,
    waiting: waitingItems.length + approvalItems.length,
    approvalCount: approvalItems.length
      || workforce.filter((emp: any) => emp.status === "needs_approval").length,
    platformIncomplete: setup.visible,
    incompleteSetupCount: fullSetupChecklist.filter((item: any) => !item.complete).length,
  });

  const metrics = buildMetricCards({
    overview,
    waiting: waitingItems.length + approvalItems.length,
    working: workingNow.length,
    wins: outcomes.length,
    team: workforce.length,
    base,
  });

  return (
    <HomeCanvas>
      <HomeHero greeting={greeting} subtitle={subtitle} />

      {fullSetupChecklist.length ? (
        <SetupChecklistBanner
          businessName={businessName}
          checklist={fullSetupChecklist}
        />
      ) : null}

      <MetricStrip metrics={metrics} />

      <DashGrid>
        <DashCard title="What changed">
          {!recentActivity.length ? (
            <EmptyLine>Activity will show here as VIBETech works.</EmptyLine>
          ) : (
            recentActivity.map((entry: any, index: number) => (
              <ActivityItem
                key={entry.id}
                index={index}
                title={humanizeHomeDecisionTitle(entry.title)}
                meta={[entry.actorLabel, formatWhen(entry.timestamp)].filter(Boolean).join(" · ") || null}
                href={entry.href}
              />
            ))
          )}
        </DashCard>

        <DashCard
          title="Approvals"
          count={approvalItems.length || null}
          accent={approvalItems.length > 0}
          action={
            approvalItems.length && approvals.viewAllHref
              ? <QuietLink href={approvals.viewAllHref}>View all</QuietLink>
              : null
          }
        >
          {!approvalItems.length ? (
            <EmptyLine>{approvals.emptyTitle ?? "No outbound approvals waiting."}</EmptyLine>
          ) : (
            approvalItems.slice(0, 7).map((item: any) => (
              <QueueRow
                key={item.id}
                title={item.title}
                detail={item.auditSummary || item.why}
                priority="critical"
                when={item.requestedAt}
                href={item.workHref || (item.actions?.[0]?.href ?? null)}
                actionLabel="Review"
              />
            ))
          )}
        </DashCard>

        <DashCard
          title="Needs you"
          count={waitingItems.length || null}
          accent={waitingItems.length > 0}
          action={
            waitingItems.length && decisions.viewAllHref
              ? <QuietLink href={decisions.viewAllHref}>View all</QuietLink>
              : null
          }
        >
          {!waitingItems.length ? (
            <EmptyLine>Nothing needs your judgment right now.</EmptyLine>
          ) : (
            waitingItems.slice(0, 7).map((item) => (
              <QueueRow
                key={item.id}
                title={item.title}
                detail={item.detail}
                priority={item.priority}
                when={item.when}
                href={item.href}
                actionLabel={item.actionLabel}
              />
            ))
          )}
        </DashCard>

        <DashCard
          title="AI team"
          count={workforce.length || null}
          action={base ? <QuietLink href={`${base}/team`}>Open team</QuietLink> : null}
        >
          {!workforce.length ? (
            <EmptyLine>AI teammates appear as work is assigned.</EmptyLine>
          ) : (
            workforce.slice(0, 6).map((emp: any) => (
              <WorkforceRow
                key={emp.id}
                name={emp.name}
                role={emp.responsibility || emp.role || null}
                status={emp.statusLabel || emp.status || null}
                statusId={emp.status}
                assignment={teammateAssignment(emp)}
                href={emp.askHref}
                actionLabel={teammateActionLabel(emp)}
              />
            ))
          )}
        </DashCard>
      </DashGrid>

      <DashGrid>
        <DashCard
          title="In motion"
          action={base ? <QuietLink href={`${base}/work`}>Open Work</QuietLink> : null}
        >
          {!workingNow.length ? (
            <EmptyLine>No live situations right now.</EmptyLine>
          ) : (
            workingNow.slice(0, 6).map((episode: any) => (
              <SituationRow
                key={episode.id}
                title={humanizeHomeDecisionTitle(episode.title)}
                detail={[episode.relatedLabel, episode.currentStep].filter(Boolean).join(" · ") || null}
                next={episode.nextStep}
                href={episode.openWorkHref}
                actionLabel={episode.openWorkHref ? "Open" : null}
              />
            ))
          )}
        </DashCard>

        <DashCard
          title="Conversations"
          action={base ? <QuietLink href={`${base}/inbox`}>Open Inbox</QuietLink> : null}
        >
          {!conversations.length ? (
            <EmptyLine>Recent conversations will appear here.</EmptyLine>
          ) : (
            conversations.map((entry: any) => (
              <CommRow
                key={entry.id}
                title={humanizeHomeDecisionTitle(entry.person ?? entry.title ?? "Conversation")}
                detail={entry.context ?? entry.direction ?? null}
                status={entry.state ?? entry.direction ?? null}
                when={null}
                href={entry.href}
                actionLabel={entry.actionNeeded || (entry.href ? "Open" : null)}
              />
            ))
          )}
        </DashCard>

        <DashCard title="Today">
          {!outcomes.length ? (
            <EmptyLine>Wins land here as VIBETech finishes work.</EmptyLine>
          ) : (
            outcomes.map((item: any) => (
              <ActivityItem
                key={item.id}
                title={humanizeHomeDecisionTitle(item.title)}
                meta={[cleanResult(item.result), item.who].filter(Boolean).join(" · ") || null}
                href={item.href}
              />
            ))
          )}
        </DashCard>
      </DashGrid>
    </HomeCanvas>
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
