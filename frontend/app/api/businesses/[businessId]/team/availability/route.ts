import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { readTeamAvailability, upsertMemberAvailability } from "../../../../../../../backend/core/integrations/appointment-setter/TeamAvailabilityStore.js";

export async function GET(_request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const availability = readTeamAvailability(installation);
    return NextResponse.json({ ok: true, availability });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const body = await request.json().catch(() => ({}));
    const memberId = String(body?.memberId ?? "").trim();
    if (!memberId) return NextResponse.json({ ok: false, error: "memberId required" }, { status: 400 });
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    const actorId = String((ctx as any).authz?.user?.id ?? (ctx as any).user?.id ?? "owner");
    const member = await (upsertMemberAvailability as any)({
      platformStore,
      installation,
      memberId,
      displayName: body?.displayName,
      timezone: body?.timezone,
      weekly: body?.weekly,
      overrides: body?.overrides,
      bookable: body?.bookable,
      actorId,
    });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
