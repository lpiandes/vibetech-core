import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(request: Request) {
  try {
    const user = await requirePlatformAdminApi();
    const body = await request.json().catch(() => ({}));
    const result = await getAdminPlatformService().releaseFeRetentionSignup({
      adminUserId: user.id,
      platformRole: user.platformRole,
      businessId: String(body.businessId ?? ""),
    });
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "not_found" ? 404 : 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
