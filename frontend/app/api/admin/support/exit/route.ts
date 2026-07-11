import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminSupportService } from "@/lib/admin/getAdminServices";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(request: Request) {
  try {
    const user = await requirePlatformAdmin();
    const body = await request.json();
    const result = await getAdminSupportService().exit({
      adminUserId: user.id,
      businessId: String(body.businessId ?? ""),
      ...(body.sessionId ? { sessionId: String(body.sessionId) } : {}),
    } as { adminUserId: string; businessId: string; sessionId?: string | null });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
