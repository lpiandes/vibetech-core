import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
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
import {
  createInstallationUsageStore,
  recordUsageOnInstallation,
} from "../../../../../../backend/core/platform/billing/InstallationUsageLedger.js";
import { readPurchasedPackagesFromConfig } from "../../../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { platformStore } from "@/lib/server/compose";

/**
 * Billing + usage scaffolding for a business.
 * Entitlements come from packageConfiguration; invoices can be outside the app.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.SETTINGS_MANAGE);

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const purchasedPackages = readPurchasedPackagesFromConfig(installation?.configuration ?? {});
    const billing = presentBillingStatus({ businessId, purchasedPackages });
    const usageStore = installation ? createInstallationUsageStore(installation) : null;
    const meters = listUsageMeters().map((meter) => ({
      ...meter,
      usage: peekUsage({ businessId, meterId: meter.id, platformStore: usageStore }),
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
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.SETTINGS_MANAGE);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();

    if (action === "record_usage") {
      const meterId = String(body?.meterId ?? "");
      const quantity = Number(body?.quantity ?? 1);
      const durable = await recordUsageOnInstallation({
        platformStore,
        businessId,
        meterId,
        quantity,
        actorId: "billing_api",
      });
      const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
      const usageStore = installation ? createInstallationUsageStore(installation) : null;
      const result = recordUsage({
        businessId,
        meterId,
        quantity: durable?.ok ? 0 : quantity,
        platformStore: usageStore,
      });
      // Re-peek so response reflects durable used count when available.
      const usage = peekUsage({ businessId, meterId, platformStore: usageStore });
      if (!usage.ok && !result.ok) {
        return NextResponse.json({ ok: false, ...result }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        usage,
        durable: Boolean(durable?.ok),
      });
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
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
