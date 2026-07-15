import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId, employeeId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const body = await request.json().catch(() => ({}));
    const status = String(body?.status ?? "").toUpperCase();
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      return NextResponse.json({ ok: false, error: "status must be ACTIVE or INACTIVE" }, { status: 400 });
    }
    const result = await ctx.service.setAutomationsStatusForEmployee(
      employeeId,
      status as "ACTIVE" | "INACTIVE",
    );
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
