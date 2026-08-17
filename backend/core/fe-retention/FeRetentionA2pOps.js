/**
 * Ops SMS after a VibeKeep agency signs — from TWILIO_MESSAGING_FROM to Leo.
 * Email is optional extra. Twilio number purchase is separate from this text.
 */
import { notifyPlatformOperators, DEFAULT_PLATFORM_OPERATOR_EMAIL } from "../admin/notifyPlatformOperators.js";
import { sendFeRetentionOpsSms } from "./FeRetentionSms.js";
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
  const number = safeString(fromNumber) || "(number purchase failed — buy in Twilio Console)";
  const book = safeString(businessName) || safeString(businessId) || "VibeKeep book";
  const profileBlock = profile ? formatFeA2pProfileForOps(profile) : "(profile missing)";
  return {
    id: `fe_a2p_register_${safeString(businessId)}_${number}`,
    title: `VibeKeep: register 10DLC for ${book}`,
    summary: `${book} signed. Their texting number is ${number}. Register THIS agency as its own Brand + Campaign, then add that number.`,
    steps: [
      "Twilio Console → Messaging → Regulatory Compliance → Onboarding",
      "Create a Customer Profile / Brand for THIS agency using the fields below (legal name, EIN, address, authorized rep)",
      "Do not attach this number to another agency’s campaign",
      "After Brand is Approved, create a Customer Care campaign (welcome, premium reminder, lapse). Privacy: https://vtechdevelopment.com/privacy.html Terms: https://vtechdevelopment.com/terms.html",
      `When Campaign is Verified: Messaging → Services → Sender Pool → add ${number}`,
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

export function buildFeRetentionA2pOpsSmsBodies({
  businessId,
  businessName = "",
  fromNumber,
  profile = null,
  signedName = "",
} = {}) {
  const action = buildFeRetentionA2pAttachOpsAction({
    businessId,
    businessName,
    fromNumber,
    profile,
    signedName,
  });
  const body = [
    action.title,
    action.summary,
    "",
    "STEPS IN TWILIO:",
    ...action.steps.slice(0, 5).map((step, i) => `${i + 1}. ${step}`),
    `Signed by: ${safeString(signedName) || "(unknown)"}`,
    "",
    "THEIR A2P FIELDS:",
    profile ? formatFeA2pProfileForOps(profile) : "(profile missing)",
  ].join("\n");
  return splitSmsBodies(body);
}

function splitSmsBodies(text, max = 1500) {
  const raw = String(text || "");
  if (raw.length <= max) return [raw];
  const parts = [];
  let rest = raw;
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    const breakAt = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"));
    const at = breakAt > 400 ? breakAt : max;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) parts.push(rest);
  return parts;
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
  notifyOperators = notifyPlatformOperators,
  sendOpsSms = sendFeRetentionOpsSms,
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
  const smsBodies = buildFeRetentionA2pOpsSmsBodies({
    businessId,
    businessName,
    fromNumber,
    profile,
    signedName,
  });

  let sms = { ok: false };
  try {
    const results = [];
    for (const body of smsBodies) {
      results.push(await sendOpsSms({
        to: VIBEKEEP_OPS_PHONE_E164,
        body,
      }));
    }
    sms = {
      ok: results.every((row) => row?.ok),
      parts: results.length,
      fromNumber: results[0]?.fromNumber || null,
      last: results[results.length - 1] || null,
    };
  } catch (err) {
    sms = { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

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
      /* SMS is the operator path; email is extra */
    }
  }

  return { ok: true, email, sms };
}
