import { NextResponse } from "next/server";
import {
  getAuthorizedBusinessScope,
  authorizationErrorResponse,
} from "@/lib/platform/AuthorizedWorkspaceService";
import { AuthorizationError } from "@/lib/server/compose";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  composeSalesAnalyticsDashboard,
} from "../../../../../../backend/core/platform/analytics/SalesAnalyticsDashboard.js";

export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const analytics = composeSalesAnalyticsDashboard({ installation, businessId });
    return NextResponse.json({
      ok: true,
      analytics,
      reporting: {
        ok: true,
        digest: {
          generatedAt: analytics.generatedAt,
          headline: `${analytics.pipeline.totalContacts} contacts · ${analytics.pipeline.openCards} open cards · ${analytics.outcomes.completed} outcomes completed`,
          bullets: [
            `Open pipeline value: ${analytics.pipeline.openValue}`,
            `Won cards: ${analytics.pipeline.wonCards}`,
            analytics.honesty.message,
          ],
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
