import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const result = await ctx.service.listCampaignTemplates();
    return NextResponse.json({
      ok: true,
      ...result,
      // Campaign-lite UI convenience alias
      templates: [
        ...(Array.isArray(result.businessTemplates) ? result.businessTemplates : []),
        ...(Array.isArray(result.packageTemplates) ? result.packageTemplates : []),
      ],
    });
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
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const body = await request.json().catch(() => ({}));
    const channel = String(body?.channel ?? "email") === "sms" ? "sms" : "email";
    const bodyText = String(body?.body ?? body?.subjectLine ?? "").trim();
    const subjectLine = String(body?.subjectLine ?? body?.subject ?? "").trim();
    const name = String(body?.name ?? "").trim()
      || (channel === "sms" ? "SMS campaign" : "Email campaign");

    if (!bodyText && channel === "sms") {
      return NextResponse.json({ ok: false, error: "SMS body is required." }, { status: 400 });
    }
    if (channel === "email" && !bodyText && !subjectLine) {
      return NextResponse.json({ ok: false, error: "Email subject or body is required." }, { status: 400 });
    }

    const template = await ctx.service.createCampaignLiteTemplate({
      name,
      channel,
      subjectLine: channel === "email" ? subjectLine || name : "",
      body: bodyText || subjectLine || name,
      audience: body?.audience && typeof body.audience === "object"
        ? body.audience
        : { type: "all_marketable_contacts" },
      approvalRequired: body?.approvalRequired !== false,
      actorId: ctx.authz?.userId ?? null,
    });

    return NextResponse.json({ ok: true, template });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
