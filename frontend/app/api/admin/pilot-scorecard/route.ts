import { NextResponse } from "next/server";

import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";

export async function GET(request: Request) {
  try {
    const user = await requirePlatformAdminApi();
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const windowDays = Number(url.searchParams.get("windowDays") ?? 7) || 7;
    const result = await getAdminPlatformService().getPilotScorecard({
      adminUserId: user.id,
      platformRole: user.platformRole,
      businessId: businessId as any,
      windowDays,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: result.reason === "installation_missing" ? 404 : 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 401 },
    );
  }
}
