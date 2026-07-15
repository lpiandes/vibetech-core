import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { getAdminSupportService } from "@/lib/admin/getAdminServices";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(request: Request) {
  try {
    const user = await requirePlatformAdminApi();
    const body = await request.json();
    const result = await getAdminSupportService().enter({
      adminUserId: user.id,
      platformRole: user.platformRole,
      businessId: String(body.businessId ?? ""),
      reason: String(body.reason ?? ""),
      mode: body.mode === "read_only" ? "read_only" : "elevated",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
