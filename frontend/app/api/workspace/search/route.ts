import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const businessId = url.searchParams.get("businessId");
    const q = url.searchParams.get("q") ?? "";
    if (!businessId) {
      return NextResponse.json({ ok: false, error: "businessId is required." }, { status: 400 });
    }
    const ctx = await getAuthorizedWorkspace(businessId);
    const results = ctx.service.searchWorkspace(q);
    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
