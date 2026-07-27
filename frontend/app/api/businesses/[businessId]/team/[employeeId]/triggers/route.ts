import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import {
  SPECIALTY_EVENT_CATALOG,
  SPECIALTY_EVENT_IDS,
} from "../../../../../../../../backend/core/ai-builder/specialty/specialtyEventCatalog.js";

/**
 * GET — event catalog for Test picker (vertical-agnostic labels).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    return NextResponse.json({
      ok: true,
      events: SPECIALTY_EVENT_CATALOG,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

/**
 * Fire an automated (or forced manual) specialty trigger for an employee.
 * Creates draft Work when automation is ACTIVE (or forceManual).
 * Optional fanOut=true emits to all LIVE subscribers of the event.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; employeeId: string }> },
) {
  try {
    const { businessId, employeeId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const body = await request.json().catch(() => ({}));
    const eventType = String(body?.eventType ?? "SPECIALTY_JOB_REQUESTED").toUpperCase();
    if (!SPECIALTY_EVENT_IDS.includes(eventType as typeof SPECIALTY_EVENT_IDS[number])) {
      return NextResponse.json({ ok: false, error: `Unsupported eventType: ${eventType}` }, { status: 400 });
    }
    const forceManual = body?.forceManual !== false; // Test UI defaults to forced
    const brief = String(body?.brief ?? "").trim();
    const actorId = String((ctx as { authz?: { user?: { id?: string } } }).authz?.user?.id ?? "owner");
    const eventPayload = body?.eventPayload && typeof body.eventPayload === "object"
      ? body.eventPayload
      : {};

    if (body?.fanOut) {
      const result = await (ctx.service as any).emitSpecialtyBusinessEvent({
        eventType,
        brief,
        forceManual: Boolean(body.forceManual),
        actorId,
        eventPayload,
      });
      return NextResponse.json({ ok: true, result, mode: "fanout" });
    }

    const result = await ctx.service.fireSpecialtyEmployeeTrigger({
      employeeId,
      eventType,
      brief,
      forceManual,
      actorId,
      eventPayload,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, ...result }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result, mode: "single" });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
