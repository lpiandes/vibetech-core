/**
 * Ops email + SMS after a VibeKeep agency completes A2P + agreement (number bought).
 */
import { notifyPlatformOperators, DEFAULT_PLATFORM_OPERATOR_EMAIL } from "../admin/notifyPlatformOperators.js";
import { sendFeRetentionSmsMessage } from "./FeRetentionSms.js";
import {
  formatFeA2pProfileForOps,
  VIBEKEEP_OPS_EMAIL,
  VIBEKEEP_OPS_PHONE_E164,
} from "./FeRetentionOnboarding.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function buildFeRetentionA2pAttachOpsAction({
  businessId,
  businessName = "",
  fromNumber,
  profile = null,
  signedName = "",
} = {}) {
  const number = safeString(fromNumber) || "(number not assigned yet)";
  const book = safeString(businessName) || safeString(businessId) || "VibeKeep book";
  const profileBlock = profile ? formatFeA2pProfileForOps(profile) : "(profile missing)";
  return {
    id: `fe_a2p_register_${safeString(businessId)}_${number}`,
    title: `VibeKeep: register 10DLC for ${book}`,
    summary: `${book} signed the engagement agreement. Register THIS agency as its own Brand + Campaign (not dad’s). Then add ${number} to that campaign.`,
    steps: [
      "Twilio Console → Messaging → Regulatory Compliance → Onboarding",
      "Create a Customer Profile / Brand for THIS agency using the payload (legal name, EIN, address, authorized rep)",
      "Do not attach this number to another agency’s campaign",
      "After Brand is Approved, create a Customer Care campaign (welcome, premium reminder, lapse). Privacy: https://vtechdevelopment.com/privacy.html Terms: https://vtechdevelopment.com/terms.html",
      `When Campaign is Verified: Messaging Service → Sender Pool → add ${number}`,
      `Signed by: ${safeString(signedName) || "(unknown)"}`,
      profileBlock,
    ],
    payload: {
      product: "vibekeep",
      businessId: safeString(businessId),
      businessName: book,
      fromNumber: number,
      signedName: safeString(signedName),
      profile: profile || null,
    },
    href: "/admin/insurance",
  };
}

export async function notifyFeRetentionNumberPurchased(input = {}) {
  return notifyFeRetentionOnboardingComplete(input);
}

export async function notifyFeRetentionOnboardingComplete({
  businessId,
  businessName = "",
  fromNumber,
  profile = null,
  signedName = "",
  agreementHtml = "",
  agreementText = "",
  deliveryProvider = null,
  simulated = false,
  notifyOperators = notifyPlatformOperators,
} = {}) {
  if (!safeString(businessId)) {
    return { ok: true, skipped: true };
  }
  const action = buildFeRetentionA2pAttachOpsAction({
    businessId,
    businessName,
    fromNumber,
    profile,
    signedName,
  });
  let email = { ok: false };
  try {
    email = await notifyOperators({
      actions: [action],
      force: true,
      fallbackDefaultEmail: true,
      toEmails: [DEFAULT_PLATFORM_OPERATOR_EMAIL, VIBEKEEP_OPS_EMAIL],
    });
  } catch (err) {
    email = { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  if (deliveryProvider?.send && (agreementHtml || agreementText)) {
    try {
      await deliveryProvider.send({
        to: VIBEKEEP_OPS_EMAIL,
        subject: `VibeKeep signed agreement — ${safeString(businessName) || businessId}`,
        text: agreementText || action.summary,
        html: agreementHtml || `<pre>${action.summary}</pre>`,
      });
    } catch {
      /* packet email still attempted above */
    }
  }

  const smsBody = [
    `VibeKeep A2P: ${safeString(businessName) || businessId}`,
    `Number: ${safeString(fromNumber) || "pending"}`,
    `EIN: ${safeString(profile?.ein) || "n/a"}`,
    `Signed: ${safeString(signedName) || "n/a"}`,
    "Full packet emailed.",
  ].join("\n");
  let sms = { ok: false };
  try {
    sms = simulated
      ? { ok: true, skipped: true, reason: "simulated" }
      : await sendFeRetentionSmsMessage({
        to: VIBEKEEP_OPS_PHONE_E164,
        body: smsBody,
      });
  } catch (err) {
    sms = { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  return { ok: true, email, sms };
}
