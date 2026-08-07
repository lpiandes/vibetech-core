/**
 * Executive Dashboard — proof-backed roll-up for owners.
 * Composes sales analytics, usage meters, and open Decisions count.
 * No invented KPIs.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { composeSalesAnalyticsDashboard } from "./SalesAnalyticsDashboard.js";
import { readUsageMetersFromInstallation } from "../billing/InstallationUsageLedger.js";

/**
 * @param {{
 *   installation?: object|null,
 *   businessId?: string|null,
 *   recentOutcomes?: object[],
 *   workItems?: object[]|null,
 *   assignments?: object[],
 *   openDecisionCount?: number,
 *   nowISO?: string,
 * }} input
 */
export function composeExecutiveDashboard({
  installation = null,
  businessId = null,
  recentOutcomes = [],
  workItems = null,
  assignments = [],
  openDecisionCount = 0,
  nowISO = new Date().toISOString(),
} = {}) {
  const sales = composeSalesAnalyticsDashboard({
    installation,
    businessId,
    recentOutcomes,
    workItems,
    assignments,
    nowISO,
  });
  const ledger = readUsageMetersFromInstallation(installation);
  const monthKey = String(nowISO).slice(0, 7);
  const month = ledger?.[monthKey] && typeof ledger[monthKey] === "object" ? ledger[monthKey] : {};
  const profileName = String(
    installation?.configuration?.businessProfile?.businessName
    ?? installation?.configuration?.businessName
    ?? businessId
    ?? "Business",
  );

  return deepFreeze({
    businessId: businessId ?? null,
    title: `${profileName} — Executive view`,
    generatedAt: nowISO,
    openDecisions: Number(openDecisionCount) || 0,
    sales,
    usage: {
      month: monthKey,
      voiceMinutesInbound: Number(month.voice_minutes_inbound ?? 0),
      voiceMinutesOutbound: Number(month.voice_minutes_outbound ?? 0),
      smsSegments: Number(month.sms_segments ?? 0),
      emails: Number(month.emails ?? 0),
      aiCredits: Number(month.ai_work_credits ?? 0),
    },
    honesty: "Metrics are composed from People/CRM cards, Outcomes, Work, and usage meters — not forecasts.",
  });
}
