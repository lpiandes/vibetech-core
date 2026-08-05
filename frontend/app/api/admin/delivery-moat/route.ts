import { NextResponse } from "next/server";

import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";

/**
 * Plan 12 — delivery moat pattern candidates.
 * GET — catalog
 * POST actions: extract | promote | reject | refuse_raw
 */
export async function GET() {
  try {
    const user = await requirePlatformAdminApi();
    const result = getAdminPlatformService().getDeliveryMoatCatalog({
      adminUserId: user.id,
      platformRole: user.platformRole,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 401 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePlatformAdminApi();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "extract").trim();
    const service = getAdminPlatformService();

    if (action === "extract") {
      const result = await service.extractDeliveryMoatCandidates({
        adminUserId: user.id,
        platformRole: user.platformRole,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 403 });
    }

    if (action === "promote") {
      const result = await service.promoteDeliveryMoatCandidate({
        adminUserId: user.id,
        platformRole: user.platformRole,
        candidateId: body.candidateId,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === "reject") {
      const result = service.rejectDeliveryMoatCandidate({
        adminUserId: user.id,
        platformRole: user.platformRole,
        candidateId: body.candidateId,
        note: body.note ?? null,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 403 });
    }

    if (action === "refuse_raw") {
      const result = service.refuseRawDeliveryMoatPromotion({
        platformRole: user.platformRole,
        payload: body.payload,
      });
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 401 },
    );
  }
}
