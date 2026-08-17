import { NextResponse } from "next/server";
import { platformStore, hashPassword, verifyPassword } from "@/lib/server/compose";
import { provisionFeRetentionAccount } from "../../../../../backend/core/fe-retention/provisionFeRetentionAccount.js";
import { createFeRetentionCheckoutSession, readFeRetentionBilling, writeFeRetentionBilling } from "../../../../../backend/core/fe-retention/FeRetentionBilling.js";
import { resolveFeRetentionContinuePath } from "../../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { putDurableCredential } from "../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const provisioned = await provisionFeRetentionAccount({
      platformStore,
      hashPassword,
      verifyPassword,
      name: body.name,
      email: body.email,
      password: body.password,
      agencyName: body.agencyName,
      promoCode: body.promoCode,
      putDurableCredential,
      vault: getSharedCredentialVault(),
    });
    if (!provisioned.ok) {
      const status = provisioned.reason === "email_taken" ? 409 : 400;
      return NextResponse.json(
        { ok: false, error: provisioned.message, reason: provisioned.reason ?? null },
        { status },
      );
    }

    const business = await platformStore.getBusinessById(provisioned.businessId).catch(() => null);
    const packageConfiguration = business?.packageConfiguration
      ?? writeFeRetentionBilling({}, {
        status: provisioned.complimentary || provisioned.allowsDashboard ? "complimentary" : "incomplete",
      });
    const nextPath = resolveFeRetentionContinuePath({
      businessId: provisioned.businessId,
      packageConfiguration,
    });
    const base = {
      ok: true as const,
      businessId: provisioned.businessId,
      email: provisioned.email,
      complimentary: Boolean(provisioned.complimentary),
      resumed: Boolean(provisioned.resumed),
      nextPath,
    };

    if (provisioned.complimentary || provisioned.allowsDashboard) {
      return NextResponse.json({ ...base, checkoutUrl: null });
    }

    const checkout = await createFeRetentionCheckoutSession({
      businessId: provisioned.businessId,
      email: provisioned.email,
      stripeCustomerId: readFeRetentionBilling(packageConfiguration).stripeCustomerId,
      requestUrl: request.url,
    });
    if (!checkout.ok) {
      return NextResponse.json({
        ...base,
        checkoutUrl: null,
        billingError: checkout.message || checkout.reason,
      });
    }

    return NextResponse.json({ ...base, checkoutUrl: checkout.url });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sign up failed." },
      { status: 500 },
    );
  }
}
