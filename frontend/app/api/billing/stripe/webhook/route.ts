import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import {
  applySubscriptionEntitlementsToConfig,
  isStripeBillingConfigured,
} from "../../../../../../backend/core/platform/billing/StripeBillingScaffold.js";
import { verifyStripeWebhookSignature } from "../../../../../../backend/core/platform/billing/StripeHttp.js";
import { applyFeRetentionStripeEvent } from "../../../../../../backend/core/fe-retention/FeRetentionBilling.js";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production"
    || String(process.env.VERCEL_ENV ?? "").toLowerCase() === "production";
}

/**
 * Stripe webhook: FE Retention subscriptions + optional OS package entitlements.
 * Live traffic requires Stripe-Signature + STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const sandboxHeader = request.headers.get("x-vibetech-billing-sandbox") === "1";
  const sandboxSecret = String(process.env.BILLING_SANDBOX_SECRET ?? "").trim();
  const providedSandboxSecret = String(request.headers.get("x-vibetech-billing-sandbox-secret") ?? "").trim();
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  const production = isProductionRuntime();
  const rawBody = await request.text();

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
      }, { status: 503 });
    }
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ ok: false, error: "stripe_signature_required" }, { status: 400 });
    }
    if (!secret) {
      return NextResponse.json({
        ok: false,
        error: "stripe_webhook_secret_required",
      }, { status: 503 });
    }
    const verified = verifyStripeWebhookSignature(rawBody, sig, secret);
    if (!verified.ok) {
      return NextResponse.json({ ok: false, error: verified.reason }, { status: 400 });
    }
  }

  const body = JSON.parse(rawBody || "{}");
  const event = body?.type && body?.data ? body : { type: body?.type, data: { object: body } };

  const fe = await applyFeRetentionStripeEvent({ platformStore, event: body?.type ? body : event });
  if (fe.ok && !fe.ignored) {
    return NextResponse.json({ ok: true, product: "fe_retention_crm", ...fe, sandbox });
  }

  const businessId = String(body?.businessId ?? body?.data?.object?.metadata?.businessId ?? "").trim();
  if (!businessId) {
    return NextResponse.json({
      ok: fe.ok !== false,
      ignored: true,
      fe,
      sandbox,
    });
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
      ? body.data.object.items.data.map((item: { price?: { id?: string } }) => item?.price?.id).filter(Boolean)
      : []);

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!installation) {
    return NextResponse.json({ ok: false, error: "business_not_found", fe }, { status: 404 });
  }

  const applied = applySubscriptionEntitlementsToConfig({
    packageConfiguration: installation.configuration ?? {},
    status,
    packageIds,
    priceIds,
  });
  if (!applied.ok) {
    return NextResponse.json({ ok: false, ...applied, fe }, { status: 400 });
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
