/**
 * Persist product-tour progress per user on the business packageConfiguration.
 */
import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { PRODUCT_TOUR_VERSION } from "@/lib/onboarding/productTourSteps";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const userId = String((ctx as any)?.user?.id ?? (ctx as any)?.user?.email ?? "anon");
    const business = await platformStore.getBusinessById(businessId).catch(() => null);
    const cfg = business?.packageConfiguration && typeof business.packageConfiguration === "object"
      ? business.packageConfiguration
      : {};
    const byUser = cfg.productTourProgress && typeof cfg.productTourProgress === "object"
      ? cfg.productTourProgress
      : {};
    const tour = byUser[userId] ?? byUser[String((ctx as any)?.user?.email ?? "")] ?? null;
    return NextResponse.json({
      ok: true,
      version: PRODUCT_TOUR_VERSION,
      tour,
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
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const userId = String((ctx as any)?.user?.id ?? (ctx as any)?.user?.email ?? "anon");
    const body = await request.json().catch(() => ({}));
    const tour = {
      version: PRODUCT_TOUR_VERSION,
      stepIndex: Math.max(0, Number(body.stepIndex) || 0),
      completedAt: body.completedAt ? String(body.completedAt) : null,
      updatedAt: String(body.updatedAt ?? new Date().toISOString()),
      restartedAt: body.restartedAt ? String(body.restartedAt) : null,
    };

    const business = await platformStore.getBusinessById(businessId).catch(() => null);
    const current = business?.packageConfiguration && typeof business.packageConfiguration === "object"
      ? business.packageConfiguration
      : {};
    const productTourProgress = {
      ...(current.productTourProgress && typeof current.productTourProgress === "object"
        ? current.productTourProgress
        : {}),
      [userId]: tour,
    };
    await platformStore.updateBusinessPackageConfiguration({
      businessId,
      packageConfiguration: {
        ...current,
        productTourProgress,
      },
    });

    return NextResponse.json({ ok: true, tour });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
