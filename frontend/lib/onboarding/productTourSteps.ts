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
    title: "Welcome",
    body: "A short walkthrough for this business. Tap Next to continue.",
    navTarget: "home",
    navHint: "Today",
    hrefSuffix: "/home",
  },
  {
    id: "ask",
    title: "Ask",
    body: "Tell VIBETech what you need — approve before anything goes live.",
    navTarget: "ask",
    navHint: "Ask",
    hrefSuffix: "/architect",
  },
  {
    id: "settings",
    title: "Settings",
    body: "Replay this tour anytime from Settings.",
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
