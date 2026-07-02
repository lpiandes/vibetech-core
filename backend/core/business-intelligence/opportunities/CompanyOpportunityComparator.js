import { recommendedOrderKey } from "./CompanyOpportunityScorer.js";

export function compareOpportunities(a, b) {
  if (!a || !b) return 0;
  const ra = recommendedOrderKey(a);
  const rb = recommendedOrderKey(b);
  if (ra !== rb) return ra - rb;
  return String(a.id).localeCompare(String(b.id));
}

