import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import { requireSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import {
  createFeRetentionBillingPortalSession,
  createFeRetentionCheckoutSession,
  readFeRetentionBilling,
} from "../../../../../backend/core/fe-retention/FeRetentionBilling.js";
import { PLATFORM_ROLES } from "../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = await request.json().catch(() => ({}));
    const access = await getFeRetentionAccess();
    const businessId = String(body.businessId ?? access.primaryBusinessId ?? "").trim();
    if (!businessId) {
      return NextResponse.json({ error: "No FE Retention book on this account." }, { status: 400 });
    }

    const isAdmin = user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
    const owned = access.businesses.some((b) => b.id === businessId);
    if (!isAdmin && !owned) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const business = await platformStore.getBusinessById(businessId);
    if (!business) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }
    const billing = readFeRetentionBilling(business.packageConfiguration ?? {});
    const checkout = await createFeRetentionCheckoutSession({
      businessId,
      email: user.email,
      stripeCustomerId: billing.stripeCustomerId,
      requestUrl: request.url,
    });
    if (!checkout.ok) {
      return NextResponse.json({ error: checkout.message || checkout.reason }, { status: 503 });
    }
    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    const status = message === "Sign in required." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireSessionUser();
    const access = await getFeRetentionAccess();
    const body = await request.json().catch(() => ({}));
    const businessId = String(body.businessId ?? access.primaryBusinessId ?? "").trim();
    const business = businessId ? await platformStore.getBusinessById(businessId) : null;
    if (!business) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }
    const isAdmin = user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
    if (!isAdmin && !access.businesses.some((b) => b.id === businessId)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    const billing = readFeRetentionBilling(business.packageConfiguration ?? {});
    const portal = await createFeRetentionBillingPortalSession({
      stripeCustomerId: billing.stripeCustomerId,
      requestUrl: request.url,
    });
    if (!portal.ok) {
      return NextResponse.json({ error: portal.message || portal.reason }, { status: 503 });
    }
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Billing portal failed.";
    const status = message === "Sign in required." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
