/**
 * Persist product-tour progress + return adaptive steps for this business.
 */
import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  assembleAdaptiveTourForBusiness,
  ADAPTIVE_TOUR_VERSION,
} from "@/lib/onboarding/assembleAdaptiveTourForBusiness";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const userId = String((ctx as any)?.user?.id ?? (ctx as any)?.user?.email ?? "anon");
    const business = (ctx as any)?.authz?.business
      ?? await platformStore.getBusinessById(businessId).catch(() => null);
    const cfg = business?.packageConfiguration && typeof business.packageConfiguration === "object"
      ? business.packageConfiguration
      : {};
    const byUser = cfg.productTourProgress && typeof cfg.productTourProgress === "object"
      ? cfg.productTourProgress
      : {};
    const tour = byUser[userId] ?? byUser[String((ctx as any)?.user?.email ?? "")] ?? null;

    const url = new URL(request.url);
    const includeCompleted = url.searchParams.get("includeCompleted") === "1"
      || Boolean(tour?.restartedAt && !tour?.completedAt);

    const adaptive = await assembleAdaptiveTourForBusiness({
      businessId,
      service: (ctx as any).service,
      authzBusiness: business,
      permissions: (ctx as any)?.permissions ?? (ctx as any)?.authz?.permissions ?? [],
      role: (ctx as any)?.role ?? (ctx as any)?.authz?.role ?? null,
      includeCompletedMissions: includeCompleted,
      installedBusinessOS: (ctx as any)?.installedBusinessOS
        ?? (ctx as any)?.authz?.installedBusinessOS
        ?? null,
    });

    return NextResponse.json({
      ok: true,
      version: ADAPTIVE_TOUR_VERSION,
      tour,
      adaptive,
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
      version: ADAPTIVE_TOUR_VERSION,
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
