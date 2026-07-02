import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`MissionControlCardView: ${message}`);
}

function iconFromSource(source) {
  const s = String(source ?? "");
  if (s === "company_health") return "health";
  if (s === "company_recommendations") return "recommendation";
  if (s === "company_opportunities") return "opportunity";
  if (s === "company_brief") return "brief";
  return "info";
}

function badgeFromCard({ status, source, title, priority, overallStatus } = {}) {
  // Deterministic, non-domain-specific badges.
  if (String(status ?? "") === "not_applicable") return "neutral";
  if (String(priority ?? "") === "immediate" || overallStatus === "critical") return "danger";
  if (String(priority ?? "") === "soon" || overallStatus === "needs_attention") return "warning";
  if (String(source ?? "") === "company_recommendations") return "action";
  if (String(title ?? "").toLowerCase().includes("risk")) return "danger";
  return "info";
}

export function createMissionControlCardView({
  id,
  title,
  subtitle,
  body,
  status,
  priority,
  metric,
  trend,
  badge,
  icon,
  actions,
  source,
  metadata,
} = {}) {
  if (!id) fail("id required.");
  if (!title) fail("title required.");
  if (!subtitle) fail("subtitle required.");
  if (!body) fail("body required.");

  const view = {
    id: String(id),
    title: String(title),
    subtitle: String(subtitle),
    body: String(body),
    status: String(status ?? ""),
    priority: String(priority ?? "later"),
    metric: metric ?? null,
    trend: trend ?? null,
    badge: String(badge ?? "info"),
    icon: String(icon ?? iconFromSource(source)),
    actions: Array.isArray(actions) ? deepFreeze(actions.map(String)) : deepFreeze([]),
    source: String(source ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

export function deriveCardBadgeAndIcon({ card, overallStatus } = {}) {
  const badge = badgeFromCard({
    status: card?.status,
    source: card?.source,
    title: card?.title,
    priority: card?.priority,
    overallStatus,
  });
  const icon = iconFromSource(card?.source);
  return { badge, icon };
}

