import { platformStore } from "@/lib/server/compose";
import { applyFeRetentionPaidCheckoutSession } from "../../../backend/core/fe-retention/FeRetentionBilling.js";

/** Apply Stripe Checkout return when the webhook has not landed yet. */
export async function claimFeRetentionPaidReturn({
  businessId,
  sessionId,
}: {
  businessId: string;
  sessionId?: string | null;
}) {
  const id = String(sessionId ?? "").trim();
  if (!id) return { ok: false, skipped: true as const };
  return applyFeRetentionPaidCheckoutSession({
    platformStore,
    sessionId: id,
    expectedBusinessId: businessId,
  });
}
