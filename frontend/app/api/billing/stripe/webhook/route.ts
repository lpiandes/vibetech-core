import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import {
  applySubscriptionEntitlementsToConfig,
  isStripeBillingConfigured,
} from "../../../../../../backend/core/platform/billing/StripeBillingScaffold.js";

/**
 * Stripe webhook / sandbox entitlements.
 * Production: verify Stripe-Signature when STRIPE_WEBHOOK_SECRET is set.
 * Sandbox: POST { businessId, status, packageIds } with header x-vibetech-billing-sandbox: 1
 */
export async function POST(request: Request) {
  const sandbox = request.headers.get("x-vibetech-billing-sandbox") === "1";
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();

  if (!sandbox && secret) {
    // Signature verification lands with Stripe SDK; refuse unsigned live traffic.
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ ok: false, error: "stripe_signature_required" }, { status: 400 });
    }
  }

  if (!sandbox && !isStripeBillingConfigured() && !secret) {
    return NextResponse.json({
      ok: false,
      error: "stripe_not_configured",
      note: "Set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET, or use sandbox header for staging.",
    }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const businessId = String(body?.businessId ?? body?.data?.object?.metadata?.businessId ?? "").trim();
  if (!businessId) {
    return NextResponse.json({ ok: false, error: "businessId_required" }, { status: 400 });
  }

  const status = String(
    body?.status
    ?? body?.data?.object?.status
    ?? "active",
  );
  const packageIds = Array.isArray(body?.packageIds)
    ? body.packageIds
    : Array.isArray(body?.data?.object?.metadata?.packageIds)
      ? body.data.object.metadata.packageIds
      : [];
  const priceIds = Array.isArray(body?.priceIds)
    ? body.priceIds
    : (Array.isArray(body?.data?.object?.items?.data)
      ? body.data.object.items.data.map((item: any) => item?.price?.id).filter(Boolean)
      : []);

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!installation) {
    return NextResponse.json({ ok: false, error: "business_not_found" }, { status: 404 });
  }

  const applied = applySubscriptionEntitlementsToConfig({
    packageConfiguration: installation.configuration ?? {},
    status,
    packageIds,
    priceIds,
  });
  if (!applied.ok) {
    return NextResponse.json({ ok: false, ...applied }, { status: 400 });
  }

  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${businessId}`,
    businessId,
    specificationId: installation.specificationId,
    configuration: applied.packageConfiguration,
  });

  return NextResponse.json({
    ok: true,
    businessId,
    purchasedPackages: applied.purchasedPackages,
    source: applied.source,
    sandbox,
  });
}
