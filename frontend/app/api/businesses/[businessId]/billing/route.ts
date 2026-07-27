import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/platform/requireBusinessAccess";
import {
  buildCheckoutIntent,
  entitlementsFromSubscription,
  presentBillingStatus,
} from "../../../../../../backend/core/platform/billing/StripeBillingScaffold.js";
import {
  listUsageMeters,
  peekUsage,
  recordUsage,
} from "../../../../../../backend/core/platform/billing/UsageMetering.js";
import { readPurchasedPackagesFromConfig } from "../../../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { platformStore } from "@/lib/server/compose";

/**
 * Billing + usage scaffolding for a business (Phase 5).
 * Entitlements still come from packageConfiguration until Stripe webhook wires them.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const access = await requireBusinessAccess(businessId, { permission: "settings.manage" }).catch(() => null);
  if (!access?.ok) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const purchasedPackages = readPurchasedPackagesFromConfig(installation?.configuration ?? {});
  const billing = presentBillingStatus({ businessId, purchasedPackages });
  const meters = listUsageMeters().map((meter) => ({
    ...meter,
    usage: peekUsage({ businessId, meterId: meter.id }),
  }));

  const { buildChannelGoLiveChecklist } = await import(
    "../../../../../../backend/core/integrations/ChannelGoLiveChecklist.js"
  );
  const channelChecklist = buildChannelGoLiveChecklist({
    connections: [],
    proofRecords: installation?.configuration?.capabilityProofs ?? {},
    smsSetup: installation?.configuration?.smsSetup ?? null,
    appOrigin: process.env.APP_ORIGIN || process.env.NEXTAUTH_URL || "",
  });

  return NextResponse.json({
    ok: true,
    billing,
    meters,
    channelChecklist,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const access = await requireBusinessAccess(businessId, { permission: "settings.manage" }).catch(() => null);
  if (!access?.ok) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();

  if (action === "record_usage") {
    const result = recordUsage({
      businessId,
      meterId: String(body?.meterId ?? ""),
      quantity: Number(body?.quantity ?? 1),
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, ...result }, { status: 400 });
    }
    return NextResponse.json({ ok: true, usage: result });
  }

  if (action === "checkout_intent") {
    const intent = buildCheckoutIntent({
      businessId,
      packageIds: Array.isArray(body?.packageIds) ? body.packageIds : [],
      mode: body?.mode === "payment" ? "payment" : "subscription",
    });
    return NextResponse.json({ ok: intent.ok, intent }, { status: intent.ok ? 200 : 400 });
  }

  if (action === "preview_entitlements") {
    const entitlements = entitlementsFromSubscription({
      status: body?.status ?? "active",
      priceIds: Array.isArray(body?.priceIds) ? body.priceIds : [],
      packageIds: Array.isArray(body?.packageIds) ? body.packageIds : [],
    });
    return NextResponse.json({ ok: entitlements.ok !== false, entitlements });
  }

  return NextResponse.json(
    { ok: false, error: "Unknown action. Use record_usage | checkout_intent | preview_entitlements." },
    { status: 400 },
  );
}
