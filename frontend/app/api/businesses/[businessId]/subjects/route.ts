import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const index = ctx.service.loadBusinessSubjectIndex(["property", "listing", "unit"]);
    return NextResponse.json(index);
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);

    const body = await request.json();
    const subjectType = String(body?.subjectType ?? "listing").trim();
    const displayName = String(body?.displayName ?? "").trim();
    const address = String(body?.address ?? "").trim();

    if (!displayName) {
      return NextResponse.json(
        { error: "Display name is required.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const subject = await ctx.service.createBusinessSubject({
      subjectType,
      displayName,
      address: address || undefined,
      keyAttributes: body?.keyAttributes ?? {},
    });

    return NextResponse.json({ ok: true, subject });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
