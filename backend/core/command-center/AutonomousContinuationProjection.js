import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { formatBusinessDate, formatBusinessDateWithOverdue } from "../presentation/formatBusinessDate.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Truthful autonomous continuation — what can proceed without the owner.
 */
export function projectAutonomousContinuation({ episodes, ctx, presentation, nowISO } = {}) {
  const items = [];
  const pendingApprovals = safeArray(ctx?.approvalRuntime?.getRequests?.()).filter((a) => a.status === "PENDING");
  const templates = presentation?.autonomousContinuationTemplates ?? {};

  for (const ep of safeArray(episodes)) {
    const party = ep.primaryParty?.displayName ?? "Contact";
    const subject = ep.primarySubject?.displayName ?? null;

    if (ep.operatingState === "handling" && ep.whatHappensNext?.length) {
      const next = ep.whatHappensNext[0];
      const detailDate = next.detail?.startsWith("Due ") || next.detail?.startsWith("Overdue ")
      ? null
      : formatBusinessDate(next.detail, { nowISO });
    const detailText = detailDate ?? (next.detail?.includes("Invalid Date") ? "" : next.detail ?? "");
      items.push(
        deepFreeze({
          id: `auto_${ep.episodeId}`,
          title: next.title ?? ep.journeyLine ?? "Continue coordination",
          detail: formatTemplate(templates.monitorParty ?? "Monitor {party}{subject} — {detail}", {
            party,
            subject: subject ? ` · ${subject}` : "",
            detail: detailText,
          }),
          blocker: null,
          episodeId: ep.episodeId,
          canProceed: true,
        }),
      );
      continue;
    }

    if (String(ep.currentState ?? "").includes("blocked") || ep.operatingState === "blocked") {
      items.push(
        deepFreeze({
          id: `blocked_${ep.episodeId}`,
          title: formatTemplate(templates.afterBlocker ?? "Continue after blocker clears — {party}", { party }),
          detail: ep.summary,
          blocker: templates.externalBlocker ?? "External confirmation required",
          episodeId: ep.episodeId,
          canProceed: false,
        }),
      );
    }
  }

  for (const approval of pendingApprovals) {
    items.push(
      deepFreeze({
        id: `auto_approval_${approval.id}`,
        title: templates.afterApproval ?? "Send approved owner communication after authorization",
        detail: String(approval.title ?? approval.description ?? "Owner approval required"),
        blocker: templates.waitingApproval ?? "Waiting for your approval",
        episodeId: null,
        canProceed: false,
      }),
    );
  }

  const followUps = safeArray(ctx?.interactionRuntime?.getInteractions?.()).filter((i) => i.followUpAt);
  for (const i of followUps.slice(0, 2)) {
    const { label, overdue } = formatBusinessDateWithOverdue(i.followUpAt, { nowISO });
    if (!label) continue;
    items.push(
      deepFreeze({
        id: `auto_follow_${i.id}`,
        title: templates.scheduledFollowUp ?? "Execute scheduled follow-up",
        detail: overdue
          ? formatTemplate(templates.overdueFollowUp ?? "Overdue since {date}", { date: label })
          : formatTemplate(templates.followUpOn ?? "Follow-up on {date}", { date: label }),
        blocker: null,
        canProceed: !overdue,
      }),
    );
  }

  return deepFreeze(items.slice(0, 6));
}

function formatTemplate(template, vars) {
  let out = String(template ?? "");
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v ?? ""));
  }
  return out.trim();
}
