import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);

    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const subjectId = String(body?.subjectId ?? "").trim();
    const urgency = String(body?.urgency ?? "high").trim();
    const permissionToContact = body?.permissionToContact;

    if (!name || !email || !description || !subjectId) {
      return NextResponse.json(
        {
          error: "Name, email, issue description, and property are required.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }
    if (permissionToContact === undefined || permissionToContact === null) {
      return NextResponse.json(
        { error: "Permission to contact must be explicitly provided.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const result = await ctx.service.submitMaintenanceRequest(
      {
        name,
        email,
        description,
        subjectId,
        permissionToContact: Boolean(permissionToContact),
        phone: phone || undefined,
        urgency,
      },
      new Date().toISOString(),
    );

    if (!result.ok) {
      const status =
        result.reason === "subject_not_found" || result.reason === "property_inactive" ? 404 : 400;
      return NextResponse.json(
        { error: result.message ?? result.reason ?? "Maintenance request failed.", code: result.reason ?? "FAILED" },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate ?? false,
      requestId: result.requestId,
      partyId: result.partyId,
      interactionId: result.interactionId,
      email: {
        status: result.emailResult?.status ?? "unknown",
        messageId: result.emailResult?.messageId ?? null,
        reason: result.emailResult?.reason ?? null,
      },
      maintenanceCoordinationWork: result.maintenanceCoordinationWork
        ? {
            id: result.maintenanceCoordinationWork.id,
            title: result.maintenanceCoordinationWork.title,
            workType: result.maintenanceCoordinationWork.workType,
            assignedTo: result.maintenanceCoordinationWork.assignedTo,
          }
        : null,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
