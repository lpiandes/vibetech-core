import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import { getFeDeliveryProvider } from "@/lib/insurance/feRetentionApi";
import { verifyTwilioRequestSignature } from "../../../../../../backend/core/integrations/twilio/verifyTwilioRequestSignature.js";
import { readPlatformTwilioSmsEnv } from "../../../../../../backend/core/fe-retention/FeRetentionSms.js";
import {
  applyFeInboundByPhone,
  classifyFeInboundSms,
  resolveFeRetentionInboundSmsWebhookUrl,
} from "../../../../../../backend/core/fe-retention/FeRetentionInbound.js";

function emptyTwiml() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "text/xml; charset=utf-8" } },
  );
}

function forbidden() {
  return new NextResponse(null, { status: 403 });
}

/**
 * Shared platform Twilio number inbound for FE Retention.
 * STOP → pause; START → resume; YES (lapse) → Needs attention + agent text/email.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return forbidden();

  const skipValidation = process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "1"
    && process.env.NODE_ENV !== "production";
  if (!skipValidation) {
    const signature = request.headers.get("x-twilio-signature");
    const { authToken } = readPlatformTwilioSmsEnv();
    const webhookUrl = resolveFeRetentionInboundSmsWebhookUrl();
    const twilioParams: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      twilioParams[key] = typeof value === "string" ? value : "";
    }
    const valid = Boolean(webhookUrl)
      && verifyTwilioRequestSignature({
        url: webhookUrl,
        params: twilioParams,
        authToken,
        signature,
      });
    if (!valid) return forbidden();
  }

  const from = String(form.get("From") ?? "").trim();
  const inboundText = String(form.get("Body") ?? "").trim();
  const optOutType = String(form.get("OptOutType") ?? "").trim().toUpperCase();
  const intent = classifyFeInboundSms({ body: inboundText, optOutType });

  if (!from || intent === "ignored") {
    return emptyTwiml();
  }

  try {
    await applyFeInboundByPhone({
      platformStore,
      fromPhone: from,
      inboundText: inboundText || optOutType,
      optOutType,
      deliveryProvider: getFeDeliveryProvider(),
      actorId: "fe_sms_inbound",
    });
  } catch (err) {
    console.error("[fe-sms-inbound] failed", err);
  }

  return emptyTwiml();
}
