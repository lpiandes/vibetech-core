import { NextResponse } from "next/server";

import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import {
  listCommercialOffers,
  listOfferableOffers,
  presentOfferMatrixSummary,
  getCommercialOffer,
} from "../../../../../backend/core/platform/commercial/CommercialOfferMatrix.js";
import { canSellOffer } from "../../../../../backend/core/platform/commercial/CanSellOffer.js";
import { getPlaybook, listMissingPlaybooksForMatrix } from "../../../../../backend/core/platform/commercial/DeliveryPlaybookRegistry.js";

export async function GET(request: Request) {
  try {
    await requirePlatformAdminApi();
    const url = new URL(request.url);
    const sheetLine = url.searchParams.get("sheetLine");
    const offerId = url.searchParams.get("offerId");
    const packageId = url.searchParams.get("packageId");
    const offerableOnly = url.searchParams.get("offerableOnly") === "1";

    if (sheetLine || offerId || packageId) {
      const gate = canSellOffer({
        sheetLine: sheetLine ?? undefined,
        offerId: offerId ?? undefined,
        packageId: packageId ?? undefined,
      });
      const offer = getCommercialOffer(offerId || sheetLine || "");
      const playbook = gate.playbookId ? getPlaybook(gate.playbookId) : null;
      return NextResponse.json({ ok: true, gate, offer, playbook });
    }

    const offers = offerableOnly ? listOfferableOffers() : listCommercialOffers();
    const summary = presentOfferMatrixSummary();
    const missingPlaybooks = listMissingPlaybooksForMatrix(listCommercialOffers());
    return NextResponse.json({
      ok: true,
      summary,
      offers,
      missingPlaybooks,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 401 },
    );
  }
}
