/**
 * Hard gate: can sales offer this commercial line?
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getCommercialOffer, listOffersByPackageId } from "./CommercialOfferMatrix.js";
import { assertPlaybookComplete } from "./DeliveryPlaybookRegistry.js";

/**
 * @param {{ sheetLine?: string, offerId?: string, packageId?: string }} input
 */
export function canSellOffer(input = {}) {
  const offer = resolveOffer(input);
  if (!offer) {
    return deepFreeze({
      allowed: false,
      offerClass: null,
      reason: "unknown_offer",
      playbookId: null,
      proveMissionIds: [],
      blockers: ["Offer not found on commercial matrix"],
    });
  }

  const blockers = [];
  if (offer.implementationStatus !== "complete") {
    blockers.push("implementationStatus is not complete");
  }

  const playbookCheck = assertPlaybookComplete(offer.deliveryPlaybookId);
  if (!playbookCheck.ok) {
    blockers.push(`playbook incomplete: ${playbookCheck.reason}`);
  }

  if (offer.offerClass === "ready" && !(offer.requiredProveMissionIds?.length > 0)) {
    blockers.push("ready offers require prove missions");
  }

  if (offer.offerClass === "custom_build") {
    const factoryOk = assertPlaybookComplete("custom_build_factory");
    if (!factoryOk.ok) blockers.push("custom_build_factory playbook missing");
    if (!(offer.requiredProveMissionIds?.length > 0)) {
      blockers.push("custom_build offers require prove missions");
    }
  }

  const allowed = blockers.length === 0;
  return deepFreeze({
    allowed,
    offerClass: offer.offerClass,
    reason: allowed ? "ok" : blockers[0],
    playbookId: offer.deliveryPlaybookId,
    proveMissionIds: [...(offer.requiredProveMissionIds ?? [])],
    blockers,
    offerId: offer.id,
    sheetLine: offer.sheetLine,
    packageId: offer.packageId,
    setupPriceUsd: offer.setupPriceUsd,
    monthlyPriceUsd: offer.monthlyPriceUsd,
  });
}

function resolveOffer(input) {
  if (input.offerId) return getCommercialOffer(input.offerId);
  if (input.sheetLine) return getCommercialOffer(input.sheetLine);
  if (input.packageId) {
    const rows = listOffersByPackageId(input.packageId);
    return rows.find((r) => r.implementationStatus === "complete") ?? rows[0] ?? null;
  }
  return null;
}
