export {
  ADAPTIVE_TOUR_VERSION as PRODUCT_TOUR_VERSION,
  buildAdaptiveProductTour,
} from "../../../backend/core/onboarding/buildAdaptiveProductTour.js";

export type ProductTourStep = {
  id: string;
  title: string;
  body: string;
  navTarget?: string;
  navHint?: string;
  hrefSuffix?: string;
  priority?: number;
  reason?: string;
  source?: string;
  capabilityStatus?: string | null;
  requiresNavId?: string;
};

/** Fallback only if the adaptive API fails — still package-agnostic minimal path. */
export const PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    id: "welcome",
    title: "Welcome to your operating system",
    body: "We’re loading a walkthrough tailored to this business. Tap Next to continue on Home.",
    navTarget: "home",
    navHint: "Home",
    hrefSuffix: "/home",
  },
  {
    id: "ask",
    title: "Ask VIBETech",
    body: "Describe custom builds here — newsletters, quote flows, automations — then approve before they go live.",
    navTarget: "ask",
    navHint: "Ask",
    hrefSuffix: "/architect",
  },
  {
    id: "settings",
    title: "Settings",
    body: "Replay this tutorial anytime from Settings → See tutorial again.",
    navTarget: "settings",
    navHint: "Settings",
    hrefSuffix: "/settings",
  },
];

export function filterTourStepsForNav(
  steps: ProductTourStep[],
  availableNavIds: Set<string> | string[],
): ProductTourStep[] {
  const ids = availableNavIds instanceof Set ? availableNavIds : new Set(availableNavIds);
  return steps.filter((step) => {
    if (!step.requiresNavId) return true;
    if (step.requiresNavId === "ask") return true;
    return ids.has(step.requiresNavId);
  });
}
