import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { platformStore } from "@/lib/server/platformStore";
import { isDigitalEmployeeOperationalReady } from "../../../../../../backend/core/industries/employees/digitalEmployeeReadinessHelpers.js";

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
    const message = String(body?.message ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const subjectId = String(body?.subjectId ?? "").trim() || undefined;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    ctx.service.refreshOperationalState(knowledgeCount);

    const residentCoordinator = ctx.service.getResidentProspectCoordinatorReadiness();
    if (!isDigitalEmployeeOperationalReady(residentCoordinator)) {
      return NextResponse.json(
        {
          error: "Resident & Prospect Coordinator is not ready. Upload knowledge and connect business email first.",
          code: "EMPLOYEE_NOT_READY",
          blockers: residentCoordinator.blockers ?? [],
        },
        { status: 409 },
      );
    }

    const result = await ctx.service.submitProspectInquiry(
      { name, email, message, phone: phone || undefined, subjectId },
      new Date().toISOString(),
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message ?? result.reason ?? "Prospect inquiry failed.", code: result.reason ?? "FAILED" },
        { status: 400 },
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
      prospectFollowUpWork: result.prospectFollowUpWork
        ? {
            id: result.prospectFollowUpWork.id,
            title: result.prospectFollowUpWork.title,
            workType: result.prospectFollowUpWork.workType,
          }
        : null,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
