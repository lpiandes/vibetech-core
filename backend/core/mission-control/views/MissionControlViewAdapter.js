import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { createMissionControlViewModel } from "./MissionControlViewModel.js";
import { createMissionControlSectionView } from "./MissionControlSectionView.js";
import { createMissionControlCardView, deriveCardBadgeAndIcon } from "./MissionControlCardView.js";
import { createMissionControlActionView } from "./MissionControlActionView.js";
import { validateMissionControlViewModel } from "./MissionControlViewValidator.js";

import {
  HERO_STATUS_MAP,
  OVERALL_STATUS_ALLOWED,
  STYLE_MAP_BY_PRIORITY,
  MISSION_CONTROL_VIEW_ID,
  LAYOUT_ALLOWED,
  PRIMARY_FOCUS_ALLOWED,
} from "./MissionControlViewDefaults.js";

function fail(message) {
  throw new Error(`MissionControlViewAdapter: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function humanizePrimaryFocus(primaryFocus) {
  return String(primaryFocus ?? "")
    .split("_")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function getActionPriorityTierFromCards({ actionId, cards } = {}) {
  const id = String(actionId ?? "");
  const cardPriorities = safeArray(cards)
    .filter((c) => safeArray(c?.actions).map(String).includes(id))
    .map((c) => String(c?.priority ?? "later").toLowerCase());
  // choose best tier: immediate < soon < later
  const rank = { immediate: 0, soon: 1, later: 2 };
  const best = cardPriorities
    .reduce((acc, p) => {
      const r = rank[p] ?? 2;
      if (acc === null) return { p, r };
      return r < acc.r ? { p, r } : acc;
    }, null);
  return best?.p ?? "later";
}

function actionViewDisabledFromStatus(status) {
  const s = String(status ?? "open");
  return s !== "open";
}

function mapPrimaryActionAndSecondaries(missionControl, actionViewsById) {
  const actions = safeArray(missionControl.actions);
  const actionIdSet = new Set(actions.map((a) => String(a.id)));
  void actionIdSet;

  // Identify best candidate action based on primaryFocus.
  const primaryFocus = String(missionControl.primaryFocus ?? "");
  const priorityCards = safeArray(missionControl.cards).slice().sort((a, b) => String(a.priority ?? "later").localeCompare(String(b.priority ?? "later")));

  const getActionView = (id) => actionViewsById.get(String(id));

  const preferActionIds = (() => {
    if (primaryFocus === "review_decisions") return ["review_work_queue", "approve_communications"];
    if (primaryFocus === "resolve_risks") {
      const riskCards = safeArray(missionControl.cards).filter((c) => String(c.title ?? "") === "Risk" || String(c.id ?? "").startsWith("card_risk_"));
      const bestRiskCard = riskCards.sort((a, b) => String(a.priority ?? "later").localeCompare(String(b.priority ?? "later")))[0] ?? null;
      const acts = safeArray(bestRiskCard?.actions).map(String);
      return acts.length ? acts : ["review_work_queue"];
    }
    if (primaryFocus === "improve_health") return ["review_operational_readiness", "review_work_queue"];
    if (primaryFocus === "complete_setup")
      return ["complete_business_profile", "complete_company_profile", "publish_knowledge", "connect_disconnected_systems"];
    if (primaryFocus === "monitor_business") return ["review_work_queue", "review_operational_readiness"];
    if (primaryFocus === "act_on_recommendation") return ["review_work_queue", ...safeArray(missionControl.cards.find((c) => c.id === "card_top_recommendation")?.actions)];
    return ["review_work_queue"];
  })();

  const available = preferActionIds.map((id) => getActionView(id)).filter(Boolean);
  const primaryAction = available.find((a) => a.disabled === false) ?? available[0] ?? null;

  // secondaryActions: next two open actions by priority tier
  const openActions = safeArray(missionControl.actions)
    .map((a) => actionViewsById.get(String(a.id)))
    .filter((v) => v && !v.disabled);

  const tierRank = { immediate: 0, soon: 1, later: 2 };
  openActions.sort((a, b) => (tierRank[a.priority ?? "later"] ?? 2) - (tierRank[b.priority ?? "later"] ?? 2) || String(a.id).localeCompare(String(b.id)));

  const secondaryActions = openActions.filter((x) => (primaryAction ? x.id !== primaryAction.id : true)).slice(0, 2);

  return { primaryAction, secondaryActions };
}

export class MissionControlViewAdapter {
  constructor({ workspaceViewModel, companyProfile, businessProfile } = {}) {
    this.workspaceViewModel = workspaceViewModel;
    this.companyProfile = companyProfile;
    this.businessProfile = businessProfile;
  }

  translate(missionControl) {
    if (!missionControl || typeof missionControl !== "object") fail("missionControl required.");

    const overallStatus = String(missionControl.overallStatus ?? "");
    if (!OVERALL_STATUS_ALLOWED.includes(overallStatus)) fail(`invalid missionControl.overallStatus: ${overallStatus}`);

    const actionViews = safeArray(missionControl.actions).map((a) =>
      createMissionControlActionView({
        id: a.id,
        label: a.label,
        type: a.action,
        target: a.target,
        priority: getActionPriorityTierFromCards({ actionId: a.id, cards: missionControl.cards }),
        disabled: actionViewDisabledFromStatus(a.status),
        metadata: a.metadata,
      }),
    );
    const actionViewsById = new Map(actionViews.map((v) => [String(v.id), v]));

    const cardViews = safeArray(missionControl.cards).map((c) => {
      const { badge, icon } = deriveCardBadgeAndIcon({ card: c, overallStatus });
      return createMissionControlCardView({
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        body: c.summary,
        status: c.status,
        priority: c.priority,
        metric: c.metric,
        trend: c.trend,
        badge,
        icon,
        actions: safeArray(c.actions),
        source: c.source,
        metadata: c.metadata,
      });
    });

    const cardsById = new Map(cardViews.map((v) => [String(v.id), v]));
    const sectionViews = safeArray(missionControl.sections).map((s) => {
      const sectionCards = safeArray(s.cards)
        .map((x) => (x && typeof x === "object" ? x.id : x))
        .map((id) => String(id))
        .filter((id) => cardsById.has(id));

      const sectionActions = safeArray(s.actions).map((a) => String(a)).filter((id) => actionViewsById.has(String(id)));

      const emptyState = sectionCards.length === 0 ? "No items available." : "";

      return createMissionControlSectionView({
        id: s.id,
        title: s.title,
        subtitle: s.summary,
        status: s.status,
        priority: s.priority,
        layout: s.layout,
        cards: sectionCards,
        actions: sectionActions,
        emptyState,
        metadata: s.metadata,
      });
    });

    const scoreFromHealthCard = (() => {
      const healthCard = cardViews.find((c) => c.id === "card_company_health") ?? null;
      return typeof healthCard?.metric === "number" ? healthCard.metric : null;
    })();

    const { primaryAction, secondaryActions } = mapPrimaryActionAndSecondaries(missionControl, actionViewsById);

    const hero = deepFreeze({
      title: String(missionControl.headline ?? ""),
      subtitle: humanizePrimaryFocus(missionControl.primaryFocus),
      status: HERO_STATUS_MAP[String(missionControl.overallStatus)],
      score: scoreFromHealthCard,
      primaryAction: primaryAction ? String(primaryAction.label) : "Review work",
      secondaryActions: secondaryActions.map((a) => String(a.label)),
      metadata: deepFreeze({ overallStatus }),
    });

    const vm = createMissionControlViewModel({
      viewId: MISSION_CONTROL_VIEW_ID,
      companyId: String(missionControl.companyId ?? ""),
      generatedAt: String(missionControl.generatedAt ?? ""),
      headline: String(missionControl.headline ?? ""),
      subheadline: String(missionControl.summary ?? missionControl.headline ?? ""),
      overallStatus,
      primaryFocus: String(missionControl.primaryFocus ?? ""),
      hero,
      sections: sectionViews,
      cards: cardViews,
      actions: actionViews,
      alerts: safeArray(missionControl.alerts).map((a) =>
        deepFreeze({
          id: a.id,
          title: a.title ?? "",
          summary: a.summary ?? "",
          status: a.status ?? "open",
          priority: a.priority ?? "later",
          metadata: a.metadata && typeof a.metadata === "object" ? deepFreeze(a.metadata) : deepFreeze({}),
        }),
      ),
      metadata: deepFreeze({ derivedFrom: { missionControlId: missionControl.missionControlId } }),
    });

    validateMissionControlViewModel(vm);
    return vm;
  }
}

