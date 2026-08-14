import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import { hashPassword } from "../../../../../backend/core/platform/services/AuthCredentialService.js";
import { provisionFeRetentionAccount } from "../../../../../backend/core/fe-retention/provisionFeRetentionAccount.js";
import { createFeRetentionCheckoutSession } from "../../../../../backend/core/fe-retention/FeRetentionBilling.js";
import { putDurableCredential } from "../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const provisioned = await provisionFeRetentionAccount({
      platformStore,
      hashPassword,
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
      return NextResponse.json({ ok: false, error: provisioned.message }, { status });
    }

    if (provisioned.complimentary) {
      return NextResponse.json({
        ok: true,
        businessId: provisioned.businessId,
        email: provisioned.email,
        complimentary: true,
        checkoutUrl: null,
      });
    }

    const checkout = await createFeRetentionCheckoutSession({
      businessId: provisioned.businessId,
      email: provisioned.email,
      requestUrl: request.url,
    });
    if (!checkout.ok) {
      return NextResponse.json({
        ok: true,
        businessId: provisioned.businessId,
        email: provisioned.email,
        checkoutUrl: null,
        billingError: checkout.message || checkout.reason,
      });
    }

    return NextResponse.json({
      ok: true,
      businessId: provisioned.businessId,
      email: provisioned.email,
      checkoutUrl: checkout.url,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sign up failed." },
      { status: 500 },
    );
  }
}
