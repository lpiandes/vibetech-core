import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { formatBusinessDate } from "../presentation/formatBusinessDate.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isOpenWork(w) {
  return !["completed", "cancelled", "closed"].includes(String(w?.status ?? ""));
}

function formatTemplate(template, vars) {
  let out = String(template ?? "");
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v ?? ""));
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Deterministic business-wide state summary from pulse + attention + work facts.
 * Wording templates live in package presentation config.
 */
export function projectBusinessStateSummary({
  pulse,
  attentionItems,
  episodes,
  workMovingNow,
  operatingStates,
  presentation,
  nowISO,
} = {}) {
  const attention = safeArray(attentionItems);
  const work = safeArray(workMovingNow);
  const metrics = safeArray(pulse);
  const templates = presentation?.businessStateSummaryTemplates ?? {};

  const inboundCount = Number(metrics.find((m) => m.id === "new_inquiries")?.value ?? 0);
  const responsesCount = Number(metrics.find((m) => m.id === "responses_sent")?.value ?? 0);
  const showingsActive = Number(metrics.find((m) => m.id === "showings_active")?.value ?? 0);
  const urgentWork = Number(metrics.find((m) => m.id === "urgent_work")?.value ?? 0);
  const overdueWork = work.filter((w) => w.overdue).length;
  const decisionCount = attention.length;
  const criticalCount = attention.filter((a) => a.priority === "critical").length;

  const positiveSignals = [];
  const concernSignals = [];
  const summaryParts = [];

  if (responsesCount > 0 && inboundCount > 0) {
    const tpl =
      responsesCount >= inboundCount
        ? templates.allInquiriesResponded ?? "VIBETech responded to all {inboundCount} new inquiries"
        : templates.partialInquiriesResponded ?? "VIBETech responded to {responsesCount} of {inboundCount} inquiries";
    summaryParts.push(formatTemplate(tpl, { inboundCount, responsesCount }));
    positiveSignals.push(formatTemplate(tpl, { inboundCount, responsesCount }));
  }

  if (showingsActive > 0) {
    const tpl =
      showingsActive === 1
        ? templates.showingMovingSingular ?? "1 showing moving forward"
        : templates.showingsMoving ?? "{showingsActive} showings moving forward";
    const phrase = showingsActive === 1 ? tpl : formatTemplate(tpl, { showingsActive });
    summaryParts.push(phrase);
    positiveSignals.push(phrase);
  }

  if (decisionCount > 0) {
    const phrase =
      decisionCount === 1
        ? templates.decisionWaitingSingular ?? "1 decision waiting on you"
        : formatTemplate(templates.decisionsWaiting ?? "{decisionCount} decisions waiting on you", { decisionCount });
    summaryParts.push(phrase);
    concernSignals.push(phrase);
  }

  const movingWork = work.filter(isOpenWork).length;
  if (overdueWork === 0 && urgentWork === 0 && summaryParts.length) {
    summaryParts.push(templates.noUrgentOverdue ?? "no urgent work is overdue");
  } else if (overdueWork > 0) {
    summaryParts.push(formatTemplate(templates.overdueWork ?? "{overdueWork} overdue", { overdueWork }));
    concernSignals.push(formatTemplate(templates.overdueWork ?? "{overdueWork} overdue", { overdueWork }));
  }

  let status = "UNDER_CONTROL";
  if (criticalCount > 0 || overdueWork > 0 || decisionCount > 0) status = "NEEDS_YOUR_ATTENTION";
  if (operatingStates?.atRisk > 0) status = "AT_RISK";

  const headline =
    status === "UNDER_CONTROL"
      ? presentation?.businessStateHeadlines?.underControl ?? "Your business is operating"
      : presentation?.businessStateHeadlines?.needsAttention ?? "Your business needs your attention";

  const summary =
    summaryParts.length > 0
      ? `${summaryParts.join(". ")}.`
      : movingWork > 0
        ? formatTemplate(templates.workInProgress ?? "{movingWork} work item(s) in progress", { movingWork })
        : templates.monitoring ?? "VIBETech is monitoring your business. Activity will appear as operations run.";

  const reason =
    concernSignals.length > 0
      ? concernSignals.join(" ")
      : positiveSignals.length > 0
        ? positiveSignals.join(" ")
        : templates.noExceptions ?? "No urgent exceptions.";

  void episodes;
  void nowISO;

  return deepFreeze({
    status,
    headline,
    summary,
    reason,
    decisionCount,
    positiveSignals: deepFreeze(positiveSignals),
    concernSignals: deepFreeze(concernSignals),
  });
}
