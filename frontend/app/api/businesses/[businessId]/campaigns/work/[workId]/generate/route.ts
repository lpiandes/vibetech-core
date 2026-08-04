import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { composeNewsletterDraftFromWebsite } from "../../../../../../../../../backend/core/campaigns/composeNewsletterDraftFromWebsite.js";

type Params = { params: Promise<{ businessId: string; workId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const brand = (ctx.service as any)?.connected?.identityViewModel ?? {};
    const businessName = String(
      body.businessName
        ?? brand.businessName
        ?? brand.name
        ?? "Your team",
    );
    const result = await composeNewsletterDraftFromWebsite({
      websiteUrl: body.websiteUrl ?? body.url ?? null,
      businessName,
      listingName: body.listingName ?? body.propertyName ?? null,
    });
    return NextResponse.json({
      ok: true,
      draft: result.draft,
      websiteFetched: result.websiteFetched,
      llmUsed: result.llmUsed,
      error: result.error ?? null,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
