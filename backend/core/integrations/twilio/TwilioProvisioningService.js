/**
 * Platform Twilio SMS provisioning — VIBETech buys/assigns a number for a business
 * and stores per-workspace credentials. A2P Brand/Campaign stays pending until carriers approve
 * (owner brand fields are saved for that registration).
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { evaluateSmsBrandCompleteness, isSmsBrandComplete } from "./smsBrandCompleteness.js";

export { isSmsBrandComplete };

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function isTwilioPlatformConfigured() {
  return Boolean(safeString(process.env.TWILIO_ACCOUNT_SID) && safeString(process.env.TWILIO_AUTH_TOKEN));
}

/**
 * Hosted inbound SMS webhook for a business — appointment setter and any other
 * SMS automation read from this single route. Never send owners to Twilio Console
 * to paste a webhook URL when we can set it for them.
 */
export function resolveInboundSmsWebhookUrl(businessId) {
  const origin = safeString(process.env.NEXTAUTH_URL || process.env.APP_ORIGIN || "").replace(/\/$/, "");
  const id = safeString(businessId);
  if (!origin || !id) return "";
  return `${origin}/api/businesses/${encodeURIComponent(id)}/integrations/sms/inbound`;
}

export function normalizeBrandInput(input = {}) {
  const legalBusinessName = safeString(input.legalBusinessName || input.businessName);
  const dba = safeString(input.dba || input.displayName);
  const website = safeString(input.website || input.websiteUrl);
  const ein = safeString(input.ein || input.taxId || input.businessRegistrationNumber);
  const businessType = safeString(input.businessType || "LLC");
  const businessIndustry = safeString(input.businessIndustry || input.vertical || "HEALTHCARE");
  const companyType = safeString(input.companyType || "private");
  const addressLine1 = safeString(input.addressLine1 || input.street);
  const addressLine2 = safeString(input.addressLine2 || input.streetSecondary);
  const city = safeString(input.city);
  const region = safeString(input.region || input.state);
  const postalCode = safeString(input.postalCode || input.zip);
  const country = safeString(input.country || "US") || "US";
  const areaCode = safeString(input.areaCode).replace(/\D/g, "").slice(0, 3);

  const contactFirstName = safeString(input.contactFirstName || input.firstName);
  const contactLastName = safeString(input.contactLastName || input.lastName);
  const contactEmail = safeString(input.contactEmail || input.email || input.brandContactEmail);
  const contactPhone = safeString(input.contactPhone || input.phoneNumber);
  const contactTitle = safeString(input.contactTitle || input.businessTitle || "Owner");

  const campaignUseCase = safeString(input.campaignUseCase || input.usAppToPersonUsecase || "CUSTOMER_CARE");
  const campaignDescription = safeString(input.campaignDescription || input.description)
    || `${dba || legalBusinessName} sends appointment reminders, intake follow-ups, and service updates to customers who opted in.`;
  const messageFlow = safeString(input.messageFlow || input.optInDescription)
    || "Customers opt in by providing their mobile number on our website, intake forms, or in person and agreeing to receive texts about appointments and care. They can reply STOP to opt out or HELP for help.";
  const sample1 = safeString(input.messageSample1 || (Array.isArray(input.messageSamples) ? input.messageSamples[0] : ""));
  const sample2 = safeString(input.messageSample2 || (Array.isArray(input.messageSamples) ? input.messageSamples[1] : ""));
  const messageSamples = [sample1, sample2].filter(Boolean);
  const privacyPolicyUrl = safeString(input.privacyPolicyUrl);
  const termsUrl = safeString(input.termsUrl || input.termsAndConditionsUrl);
  const hasEmbeddedLinks = input.hasEmbeddedLinks === true || input.hasEmbeddedLinks === "true";
  const hasEmbeddedPhone = input.hasEmbeddedPhone === true || input.hasEmbeddedPhone === "true";
  const useCase = safeString(input.useCase) || campaignDescription;

  const { missing, ok } = evaluateSmsBrandCompleteness({
    legalBusinessName,
    website,
    ein,
    businessType,
    businessIndustry,
    addressLine1,
    city,
    region,
    postalCode,
    contactFirstName,
    contactLastName,
    contactEmail,
    contactPhone,
    messageSamples,
    messageSample1: sample1,
    messageSample2: sample2,
    messageFlow,
  });

  return deepFreeze({
    legalBusinessName,
    dba: dba || legalBusinessName,
    website,
    ein,
    businessType,
    businessIndustry,
    companyType,
    addressLine1,
    addressLine2,
    city,
    region,
    postalCode,
    country,
    areaCode,
    contactFirstName,
    contactLastName,
    contactEmail,
    contactPhone,
    contactTitle,
    campaignUseCase,
    campaignDescription,
    messageFlow,
    messageSamples,
    messageSample1: messageSamples[0] || "",
    messageSample2: messageSamples[1] || "",
    privacyPolicyUrl,
    termsUrl,
    hasEmbeddedLinks,
    hasEmbeddedPhone,
    useCase,
    missing,
    ok,
  });
}

/**
 * @param {{
 *   businessId: string,
 *   brand?: object,
 *   fetchImpl?: typeof fetch,
 *   nowISO?: string,
 *   simulate?: boolean,
 *   allowSendOnlyWithoutWebhook?: boolean,
 * }} input
 */
export async function provisionTwilioSmsForBusiness({
  businessId,
  brand = {},
  fetchImpl = globalThis.fetch,
  nowISO = new Date().toISOString(),
  simulate = process.env.TWILIO_PROVISION_SIMULATE === "1",
  allowSendOnlyWithoutWebhook = false,
} = {}) {
  const workspaceId = safeString(businessId);
  if (!workspaceId) {
    return deepFreeze({ ok: false, reason: "business_required", message: "Business id is required." });
  }

  const normalized = normalizeBrandInput(brand);
  if (!normalized.ok) {
    return deepFreeze({
      ok: false,
      reason: "brand_incomplete",
      message: `Enter business details first: ${normalized.missing.join(", ")}.`,
      missing: normalized.missing,
    });
  }

  if (simulate || process.env.TWILIO_PROVISION_SIMULATE === "1") {
    const fakeFrom = `+1555${String(Date.now()).slice(-7)}`;
    return deepFreeze({
      ok: true,
      simulated: true,
      accountSid: safeString(process.env.TWILIO_ACCOUNT_SID) || "ACsimulated",
      authToken: safeString(process.env.TWILIO_AUTH_TOKEN) || "simulated_token",
      fromNumber: fakeFrom,
      phoneSid: `PNsim_${workspaceId.slice(0, 8)}`,
      provisionedBy: "platform",
      a2pRegistrationStatus: "pending",
      brand: normalized,
      at: nowISO,
      message: "Simulated number provisioned. Carrier A2P registration still pending.",
    });
  }

  if (!isTwilioPlatformConfigured()) {
    return deepFreeze({
      ok: false,
      reason: "platform_twilio_not_configured",
      message: "VIBETech Twilio is not configured yet. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, or paste your own Twilio credentials.",
    });
  }

  const parentSid = safeString(process.env.TWILIO_ACCOUNT_SID);
  const parentToken = safeString(process.env.TWILIO_AUTH_TOKEN);
  const useSubaccounts = process.env.TWILIO_PROVISION_SUBACCOUNTS === "1";

  // The inbound SMS webhook is how appointment-setter automation ever sees a
  // reply — fail loudly instead of silently handing out a number nothing can
  // text back to, unless the caller explicitly opts into send-only mode.
  const inboundWebhookUrl = resolveInboundSmsWebhookUrl(workspaceId);
  if (!inboundWebhookUrl && !allowSendOnlyWithoutWebhook) {
    return deepFreeze({
      ok: false,
      reason: "public_origin_required",
      message: "Set NEXTAUTH_URL or APP_ORIGIN so we can configure the inbound SMS webhook before assigning a number.",
    });
  }

  let accountSid = parentSid;
  let authToken = parentToken;

  try {
    if (useSubaccounts) {
      const sub = await createTwilioSubaccount({
        fetchImpl,
        parentSid,
        parentToken,
        friendlyName: `VIBETech ${normalized.dba}`.slice(0, 64),
      });
      if (!sub.ok) return deepFreeze(sub);
      accountSid = sub.accountSid;
      authToken = sub.authToken;
    }

    const purchased = await purchaseUsLocalNumber({
      fetchImpl,
      accountSid,
      authToken,
      areaCode: normalized.areaCode || safeString(process.env.TWILIO_PROVISION_AREA_CODE),
      friendlyName: `VIBETech ${normalized.dba}`.slice(0, 64),
      smsUrl: inboundWebhookUrl,
      businessId: workspaceId,
      allowSendOnlyWithoutWebhook,
    });
    if (!purchased.ok) return deepFreeze(purchased);

    return deepFreeze({
      ok: true,
      simulated: false,
      accountSid,
      authToken,
      fromNumber: purchased.fromNumber,
      phoneSid: purchased.phoneSid,
      provisionedBy: "platform",
      a2pRegistrationStatus: "pending",
      brand: normalized,
      inboundWebhookUrl: inboundWebhookUrl || null,
      inboundWebhookConfigured: purchased.smsUrlConfigured === true,
      at: nowISO,
      message: "Number ready. Carrier brand/campaign registration is pending — texts to US customers may wait until A2P is approved.",
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "provision_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function createTwilioSubaccount({ fetchImpl, parentSid, parentToken, friendlyName }) {
  const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts.json`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(parentSid, parentToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ FriendlyName: friendlyName }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      reason: "subaccount_failed",
      message: safeString(data?.message) || `Could not create Twilio subaccount (HTTP ${res.status}).`,
    };
  }
  return {
    ok: true,
    accountSid: safeString(data.sid),
    authToken: safeString(data.auth_token),
  };
}

async function purchaseUsLocalNumber({
  fetchImpl,
  accountSid,
  authToken,
  areaCode,
  friendlyName,
  smsUrl = "",
  businessId = "",
  allowSendOnlyWithoutWebhook = false,
}) {
  const pool = safeString(process.env.TWILIO_PROVISION_POOL)
    .split(/[\s,]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  if (pool.length) {
    const fromNumber = pool[0];
    // A pool number is pre-existing in the Twilio account — its SmsUrl has to
    // be set explicitly (there's no purchase call to attach it to).
    const webhook = smsUrl
      ? await configureInboundSmsWebhook({ businessId, accountSid, authToken, fromNumber, fetchImpl })
      : { ok: false, reason: "webhook_url_unresolved", message: "Inbound SMS webhook URL could not be resolved." };
    if (!webhook.ok && !allowSendOnlyWithoutWebhook) {
      return {
        ok: false,
        reason: webhook.reason || "webhook_configure_failed",
        message: webhook.message || "Could not configure the inbound SMS webhook for the pool number.",
      };
    }
    return {
      ok: true,
      fromNumber,
      phoneSid: webhook.ok ? (webhook.phoneSid ?? null) : null,
      fromPool: true,
      smsUrlConfigured: webhook.ok && webhook.configured === true,
    };
  }

  const query = new URLSearchParams({
    SmsEnabled: "true",
    VoiceEnabled: "true",
    Limit: "5",
  });
  if (areaCode && /^\d{3}$/.test(areaCode)) query.set("AreaCode", areaCode);

  const availRes = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/AvailablePhoneNumbers/US/Local.json?${query}`,
    { headers: { Authorization: basicAuth(accountSid, authToken) } },
  );
  const avail = await availRes.json().catch(() => ({}));
  if (!availRes.ok) {
    return {
      ok: false,
      reason: "number_search_failed",
      message: safeString(avail?.message) || `Could not search Twilio numbers (HTTP ${availRes.status}).`,
    };
  }
  const candidates = Array.isArray(avail?.available_phone_numbers) ? avail.available_phone_numbers : [];
  const pick = candidates.find((row) => safeString(row?.phone_number)) || null;
  if (!pick) {
    return {
      ok: false,
      reason: "no_numbers",
      message: areaCode
        ? `No SMS-capable numbers available in area code ${areaCode}. Try a different area code.`
        : "No SMS-capable US local numbers available right now. Try again or set an area code.",
    };
  }

  const phoneNumber = safeString(pick.phone_number);
  const purchaseForm = {
    PhoneNumber: phoneNumber,
    FriendlyName: friendlyName || "VIBETech SMS",
  };
  if (smsUrl) {
    // Auto-configure the inbound webhook at purchase time — owners never touch Twilio Console.
    purchaseForm.SmsUrl = smsUrl;
    purchaseForm.SmsMethod = "POST";
  }
  const buyRes = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(purchaseForm).toString(),
    },
  );
  const bought = await buyRes.json().catch(() => ({}));
  if (!buyRes.ok) {
    return {
      ok: false,
      reason: "number_purchase_failed",
      message: safeString(bought?.message) || `Could not buy Twilio number (HTTP ${buyRes.status}).`,
    };
  }

  return {
    ok: true,
    fromNumber: safeString(bought.phone_number || phoneNumber),
    phoneSid: safeString(bought.sid),
    fromPool: false,
    smsUrlConfigured: Boolean(smsUrl) && safeString(bought.sms_url) === smsUrl,
  };
}

/**
 * Point an already-owned Twilio number's inbound SMS webhook at the platform
 * route. Used when a business already had a number connected before this
 * webhook auto-configuration shipped, or when re-saving brand details.
 * @param {{
 *   businessId: string,
 *   accountSid: string,
 *   authToken: string,
 *   phoneSid?: string|null,
 *   fromNumber?: string|null,
 *   fetchImpl?: typeof fetch,
 * }} input
 */
export async function configureInboundSmsWebhook({
  businessId,
  accountSid,
  authToken,
  phoneSid = null,
  fromNumber = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  const webhookUrl = resolveInboundSmsWebhookUrl(businessId);
  if (!webhookUrl) {
    return { ok: false, reason: "webhook_url_unresolved", message: "Set NEXTAUTH_URL or APP_ORIGIN to auto-configure the inbound SMS webhook." };
  }
  const sid = safeString(accountSid);
  const token = safeString(authToken);
  if (!sid || !token) {
    return { ok: false, reason: "credentials_required", message: "Twilio Account SID and Auth Token are required." };
  }
  try {
    let resolvedPhoneSid = safeString(phoneSid);
    if (!resolvedPhoneSid && fromNumber) {
      const lookupRes = await fetchImpl(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(fromNumber)}`,
        { headers: { Authorization: basicAuth(sid, token) } },
      );
      const lookup = await lookupRes.json().catch(() => ({}));
      const row = Array.isArray(lookup?.incoming_phone_numbers) ? lookup.incoming_phone_numbers[0] : null;
      resolvedPhoneSid = safeString(row?.sid);
    }
    if (!resolvedPhoneSid) {
      return { ok: false, reason: "phone_sid_unresolved", message: "Could not find the Twilio phone number to configure." };
    }
    const updateRes = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/IncomingPhoneNumbers/${encodeURIComponent(resolvedPhoneSid)}.json`,
      {
        method: "POST",
        headers: {
          Authorization: basicAuth(sid, token),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ SmsUrl: webhookUrl, SmsMethod: "POST" }).toString(),
      },
    );
    const updated = await updateRes.json().catch(() => ({}));
    if (!updateRes.ok) {
      return {
        ok: false,
        reason: "webhook_update_failed",
        message: safeString(updated?.message) || `Could not set the inbound SMS webhook (HTTP ${updateRes.status}).`,
      };
    }
    return {
      ok: true,
      webhookUrl,
      phoneSid: resolvedPhoneSid,
      configured: safeString(updated?.sms_url) === webhookUrl,
    };
  } catch (err) {
    return { ok: false, reason: "webhook_update_error", message: err instanceof Error ? err.message : String(err) };
  }
}

function basicAuth(sid, token) {
  const raw = `${sid}:${token}`;
  if (typeof Buffer !== "undefined") {
    return `Basic ${Buffer.from(raw).toString("base64")}`;
  }
  return `Basic ${btoa(raw)}`;
}
