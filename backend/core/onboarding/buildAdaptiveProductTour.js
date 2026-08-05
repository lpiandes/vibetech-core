/**
 * Adaptive product tour — steps derived from this business's packages,
 * Launch missions, and entitled surfaces (not a fixed walkthrough for everyone).
 */
import {
  resolvePurchasedPackageScope,
  presentLaunchPathLabel,
} from "../platform/packages/SalesPackageCatalog.js";
import { isSocialCheckerOnlyPurchasedScope } from "../platform/packages/socialCheckerEntitlement.js";

export const ADAPTIVE_TOUR_VERSION = 4;

/** Mission / capability id → where to take the user in the shell. */
const MISSION_ROUTES = Object.freeze({
  meta_lead_intake: { navTarget: "integrations", hrefSuffix: "/integrations", navHint: "Integrations" },
  sms_send: { navTarget: "integrations", hrefSuffix: "/integrations", navHint: "Integrations" },
  voice_calls: { navTarget: "integrations", hrefSuffix: "/integrations", navHint: "Integrations" },
  customer_email_send: { navTarget: "integrations", hrefSuffix: "/integrations", navHint: "Integrations" },
  calendar_scheduling: { navTarget: "calendar", hrefSuffix: "/calendar", navHint: "Calendar" },
  knowledge_consult: { navTarget: "knowledge", hrefSuffix: "/knowledge", navHint: "Knowledge" },
  outbound_approvals: { navTarget: "work", hrefSuffix: "/work", navHint: "Work" },
  website_forms: { navTarget: "home", hrefSuffix: "/intake", navHint: "Intake" },
  social_screen_prove: { navTarget: "integrations", hrefSuffix: "/integrations", navHint: "Integrations" },
  sports_registration_golden_path: { navTarget: "home", hrefSuffix: "/home", navHint: "Home" },
  dental_intake_golden_path: { navTarget: "home", hrefSuffix: "/home", navHint: "Home" },
});

/** Surfaces to introduce when entitled (after mission-driven steps). */
const NAV_INTROS = Object.freeze([
  {
    id: "nav:people",
    requiresNavId: "people",
    navTarget: "people",
    hrefSuffix: "/people",
    navHint: "People",
    title: "People",
    body: "Leads and customers land here. Open anyone to see their timeline.",
    priority: 40,
  },
  {
    id: "nav:pipelines",
    requiresNavId: "pipelines",
    navTarget: "pipelines",
    hrefSuffix: "/pipelines",
    navHint: "Pipelines",
    title: "Pipelines",
    body: "See where every opportunity sits — one shared view for the team.",
    priority: 42,
  },
  {
    id: "nav:subjects",
    requiresNavId: "subjects",
    navTarget: "subjects",
    hrefSuffix: "/properties",
    navHint: "Properties",
    title: "Properties",
    body: "Keep listings current so follow-ups reference real inventory.",
    priority: 43,
  },
  {
    id: "nav:automations",
    requiresNavId: "automations",
    navTarget: "automations",
    hrefSuffix: "/automations",
    navHint: "Automations",
    title: "Automations",
    body: "Test a workflow before customers feel it.",
    priority: 45,
  },
  {
    id: "nav:campaigns",
    requiresNavId: "campaigns",
    navTarget: "campaigns",
    hrefSuffix: "/campaigns",
    navHint: "Campaigns",
    title: "Campaigns",
    body: "Drafts appear here. Approve before anything sends.",
    priority: 46,
  },
  {
    id: "nav:inbox",
    requiresNavId: "inbox",
    navTarget: "inbox",
    hrefSuffix: "/inbox",
    navHint: "Inbox",
    title: "Inbox",
    body: "Customer conversations live with the rest of the business.",
    priority: 47,
  },
]);

function hrefToSuffix(href, businessId) {
  const raw = String(href ?? "");
  if (!raw) return null;
  const marker = `/b/${businessId}`;
  if (raw.startsWith(marker)) return raw.slice(marker.length) || "/home";
  if (raw.startsWith("/b/")) {
    const parts = raw.split("/");
    // /b/{id}/rest...
    if (parts.length >= 4) return `/${parts.slice(3).join("/")}`;
  }
  if (raw.startsWith("/")) return raw;
  return null;
}

function missionToStep(mission, { businessId, priority }) {
  const id = String(mission?.id ?? "");
  if (!id) return null;
  const route = MISSION_ROUTES[id] ?? {
    navTarget: "home",
    hrefSuffix: "/home",
    navHint: "Home",
  };
  const fromMission = hrefToSuffix(mission.href, businessId);
  const status = String(mission.status ?? "");
  const incomplete = !mission.complete && status !== "proven" && status !== "deferred";
  const action = String(mission.actionLabel ?? "Open").trim();
  const detail = String(mission.detail ?? "").trim();
  return {
    id: `mission:${id}`,
    title: String(mission.title ?? id),
    body: incomplete
      ? `${detail || "Still open."} Finish with “${action}” on Today when ready.`
      : `${detail || "Done."} You’ll find it on Today.`,
    hrefSuffix: fromMission || route.hrefSuffix,
    navTarget: route.navTarget,
    navHint: route.navHint,
    priority,
    reason: incomplete
      ? `Incomplete Launch mission (${status || "needs work"}) for your packages`
      : `Launch mission for your packages (${status || "done"})`,
    source: "launch_mission",
    capabilityStatus: status || null,
    skipIfComplete: false,
  };
}

/**
 * @param {object} input
 * @param {string[]} [input.purchasedPackages]
 * @param {object[]} [input.missions] curated Launch missions
 * @param {string[]} [input.availableNavIds] CanonicalNavItem ids currently shown
 * @param {string} [input.businessId]
 * @param {string} [input.businessName]
 * @param {boolean} [input.includeCompletedMissions] when replaying tutorial
 * @returns {{ version: number, mode: string, packageLabel: string, steps: object[], skipTour: boolean, skipReason: string|null }}
 */
export function buildAdaptiveProductTour({
  purchasedPackages = [],
  missions = [],
  availableNavIds = [],
  businessId = "",
  businessName = "",
  includeCompletedMissions = false,
} = {}) {
  const packages = Array.isArray(purchasedPackages) ? purchasedPackages.map(String) : [];
  const navIds = new Set(
    (Array.isArray(availableNavIds) ? availableNavIds : []).map(String).filter(Boolean),
  );
  // Ask is always available in the shell top bar when OS is installed.
  navIds.add("ask");

  if (isSocialCheckerOnlyPurchasedScope(packages)) {
    return {
      version: ADAPTIVE_TOUR_VERSION,
      mode: "social_only",
      packageLabel: "Social Background Checker",
      skipTour: true,
      skipReason: "social_checker_only",
      steps: [
        {
          id: "social:welcome",
          title: "Your Social Checker workspace",
          body: "This account is Social Background Checker–focused. Open Social Checker from Settings or social.vtechdevelopment.com to run screens — the full operating-system walkthrough doesn’t apply here.",
          hrefSuffix: "/settings",
          navTarget: "settings",
          navHint: "Settings",
          priority: 1,
          reason: "Social-only package scope",
          source: "package",
        },
      ],
    };
  }

  const scope = resolvePurchasedPackageScope(packages);
  const managedRevenueFollowThrough = packages.includes("managed_revenue_follow_through");
  const packageLabel =
    presentLaunchPathLabel({ purchasedPackages: packages })
    || (scope.fullOs ? "Full AI Business OS" : packages.join(", ") || "Your workspace");

  const steps = [];

  steps.push({
    id: "welcome",
    title: `Welcome${businessName ? ` — ${businessName}` : ""}`,
    body: managedRevenueFollowThrough
      ? "You’re on Managed Revenue Follow-Through. We’ll show the few screens that matter."
      : `You’re set up for ${packageLabel}. We’ll show the screens that matter for you.`,
    hrefSuffix: "/home",
    navTarget: "home",
    navHint: "Today",
    priority: 1,
    reason: "Personalized welcome from purchased packages",
    source: "package",
  });

  steps.push({
    id: "home:launch",
    title: "Today",
    body: managedRevenueFollowThrough
      ? "Start here. Finish the launch checklist, then run the day from this screen."
      : "Start here. Finish open setup items, then come back for the day’s work.",
    hrefSuffix: "/home",
    navTarget: "home",
    navHint: "Today",
    priority: 2,
    reason: "Every entitled workspace starts on Home / Launch",
    source: "nav_intro",
  });

  const missionList = Array.isArray(missions) ? missions : [];
  let missionPriority = 10;
  for (const mission of missionList) {
    const complete = Boolean(mission?.complete)
      || ["proven", "deferred"].includes(String(mission?.status ?? ""));
    if (complete && !includeCompletedMissions) continue;
    const step = missionToStep(mission, { businessId, priority: missionPriority });
    if (!step) continue;
    // Only route to nav targets the shell actually shows (intake/home always ok).
    if (step.navTarget && step.navTarget !== "home" && !navIds.has(step.navTarget) && step.navTarget !== "ask") {
      // Still keep the step but land on Home if the deep link nav is hidden.
      if (!navIds.has(step.navTarget)) {
        step.navTarget = "home";
        step.navHint = "Home";
        if (!step.hrefSuffix?.startsWith("/intake")) {
          step.hrefSuffix = "/home";
        }
      }
    }
    steps.push(step);
    missionPriority += 1;
  }

  const coveredNav = new Set(
    steps.map((s) => s.navTarget).filter(Boolean),
  );
  coveredNav.add("home");

  for (const intro of NAV_INTROS) {
    if (managedRevenueFollowThrough && intro.id === "nav:people") continue;
    if (!navIds.has(intro.requiresNavId)) continue;
    if (coveredNav.has(intro.navTarget)) continue;
    steps.push({
      ...intro,
      reason: `Your packages include the ${intro.navHint} surface`,
      source: "nav_intro",
    });
    coveredNav.add(intro.navTarget);
  }

  if (navIds.has("needs_attention")) {
    steps.push({
      id: "nav:needs_attention",
      title: "Decisions",
      body: "Anything that needs your judgment shows up here.",
      hrefSuffix: "/intelligence",
      navTarget: "needs_attention",
      navHint: "Decisions",
      priority: 50,
      reason: "Entitled Needs Attention surface",
      source: "nav_intro",
    });
  }

  if (managedRevenueFollowThrough && navIds.has("outcomes")) {
    steps.push({
      id: "nav:outcomes",
      title: "Outcomes",
      body: "Completed work with real proof — nothing invented.",
      hrefSuffix: "/outcomes",
      navTarget: "outcomes",
      navHint: "Outcomes",
      priority: 52,
      reason: "RFT outcomes ledger",
      source: "nav_intro",
    });
  }

  if (managedRevenueFollowThrough && navIds.has("knowledge")) {
    steps.push({
      id: "nav:company_rules",
      title: "Company Rules",
      body: "How your business should operate — SLAs, approvals, and memory.",
      hrefSuffix: "/knowledge",
      navTarget: "knowledge",
      navHint: "Company Rules",
      priority: 54,
      reason: "RFT company rules",
      source: "nav_intro",
    });
  }

  steps.push({
    id: "ask",
    title: "Ask",
    body: "Tell VIBETech what you need. You’ll approve before anything changes.",
    hrefSuffix: "/architect",
    navTarget: "ask",
    navHint: "Ask",
    priority: 90,
    reason: "Custom-build entry for every installed OS",
    source: "nav_intro",
  });

  if (navIds.has("settings") || true) {
    steps.push({
      id: "settings",
      title: "Settings",
      body: "Team and account. Replay this tour anytime from here.",
      hrefSuffix: "/settings",
      navTarget: "settings",
      navHint: "Settings",
      priority: 99,
      reason: "Replay entry point",
      source: "nav_intro",
    });
  }

  steps.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

  return {
    version: ADAPTIVE_TOUR_VERSION,
    mode: scope.fullOs ? "full_os" : "package_scoped",
    packageLabel,
    skipTour: false,
    skipReason: null,
    steps,
  };
}
