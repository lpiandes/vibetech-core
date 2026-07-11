import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { isRegisteredDashboardComponent } from "../business-os/BusinessOSDashboardComponentRegistry.js";

export function createExecutiveDashboardDefinition({
  dashboardId,
  label,
  audience = "owner",
  cards = [],
} = {}) {
  return deepFreeze({
    dashboardId: String(dashboardId),
    label: String(label),
    audience: String(audience),
    cards: deepFreeze(cards),
  });
}

export class DashboardRecommendationEngine {
  recommend({ businessSummary = {}, modules = [] } = {}) {
    const industry = String(businessSummary.industry ?? "");
    const cards = [
      card("health", "Business health", "metric_cards", "metrics", "Shows real counts once you have activity."),
      card("attention", "Needs attention", "attention_queue", "attention", "Work and approvals waiting on you."),
      card("work", "Open work", "work_queue", "work", "Human-approved work across the business."),
      card("workforce", "Digital workforce", "digital_workforce", "workforce", "Employees stay grouped here."),
      card("comms", "Communications", "communication_summary", "communications", "Inbox and campaign delivery once connected."),
      card("deadlines", "Upcoming", "calendar_deadlines", "calendar", "Deadlines appear after scheduling setup."),
    ];

    if (industry === "property_management" || modules.some((module) => module.moduleId === "properties")) {
      cards.push(card("properties", "Property demand", "subject_summaries", "subjects", "Property interest from trusted imports."));
      cards.push(card("pipeline", "Relationship pipeline", "pipeline", "relationships", "Prospect and owner follow-up."));
    }
    if (industry === "dental") {
      cards.push(card("patients", "Patients", "subject_summaries", "subjects", "Patient records you have added."));
    }
    if (industry === "sports") {
      cards.push(card("teams", "Teams and players", "subject_summaries", "subjects", "Club records on the universal runtime."));
    }

    const definition = createExecutiveDashboardDefinition({
      dashboardId: "executive_home",
      label: "Home",
      cards: cards.filter((entry) => isRegisteredDashboardComponent(entry.componentType)),
    });

    return deepFreeze({ ok: true, dashboard: definition });
  }
}

export function bindDashboardProjection(card, { dataAvailable = false } = {}) {
  return deepFreeze({
    ...card,
    projectionId: card.dataSource,
    emptyState: dataAvailable ? null : card.emptyState,
    fabricatedMetricsForbidden: true,
  });
}

export function validateDashboardDefinition(definition) {
  const errors = [];
  for (const card of definition.cards ?? []) {
    if (!isRegisteredDashboardComponent(card.componentType)) {
      errors.push({ code: "unknown_component", message: card.componentType });
    }
    if (!card.dataSource && !card.projectionId) {
      errors.push({ code: "missing_projection", message: card.id });
    }
  }
  return deepFreeze({ ok: errors.length === 0, errors });
}

function card(id, title, componentType, dataSource, emptyState) {
  return {
    id,
    title,
    componentType,
    dataSource,
    permissions: [],
    ordering: 0,
    size: "md",
    emptyState,
    drillDownRoute: null,
  };
}
