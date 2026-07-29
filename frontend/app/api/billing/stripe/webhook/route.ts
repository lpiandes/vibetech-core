import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import {
  applySubscriptionEntitlementsToConfig,
  isStripeBillingConfigured,
} from "../../../../../../backend/core/platform/billing/StripeBillingScaffold.js";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production"
    || String(process.env.VERCEL_ENV ?? "").toLowerCase() === "production";
}

/**
 * Stripe webhook / controlled sandbox entitlements.
 * Production: requires Stripe config + stripe-signature header (SDK verify lands next).
 * Sandbox: only allowed outside production, or with matching BILLING_SANDBOX_SECRET.
 */
export async function POST(request: Request) {
  const sandboxHeader = request.headers.get("x-vibetech-billing-sandbox") === "1";
  const sandboxSecret = String(process.env.BILLING_SANDBOX_SECRET ?? "").trim();
  const providedSandboxSecret = String(request.headers.get("x-vibetech-billing-sandbox-secret") ?? "").trim();
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  const production = isProductionRuntime();

  let sandbox = false;
  if (sandboxHeader) {
    if (production) {
      if (!sandboxSecret || providedSandboxSecret !== sandboxSecret) {
        return NextResponse.json(
          { ok: false, error: "billing_sandbox_forbidden_in_production" },
          { status: 403 },
        );
      }
      sandbox = true;
    } else {
      sandbox = true;
    }
  }

  if (!sandbox) {
    if (!isStripeBillingConfigured() && !secret) {
      return NextResponse.json({
        ok: false,
        error: "stripe_not_configured",
        note: "Invoices/packages are assigned by admin. In-app Stripe Checkout is not enabled.",
      }, { status: 503 });
    }
    // Signature verification lands with Stripe SDK; refuse unsigned live traffic.
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ ok: false, error: "stripe_signature_required" }, { status: 400 });
    }
    if (!secret) {
      return NextResponse.json({
        ok: false,
        error: "stripe_webhook_secret_required",
        note: "Refusing to mutate entitlements without STRIPE_WEBHOOK_SECRET.",
      }, { status: 503 });
    }
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
    id: installation.id ?? `install_${businessId}`,
    businessId,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash ?? "billing-update",
    planId: installation.planId ?? `plan_${businessId}`,
    status: installation.status ?? "ACTIVE",
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
