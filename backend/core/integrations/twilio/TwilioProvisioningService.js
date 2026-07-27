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
 * }} input
 */
export async function provisionTwilioSmsForBusiness({
  businessId,
  brand = {},
  fetchImpl = globalThis.fetch,
  nowISO = new Date().toISOString(),
  simulate = process.env.TWILIO_PROVISION_SIMULATE === "1",
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

async function purchaseUsLocalNumber({ fetchImpl, accountSid, authToken, areaCode, friendlyName }) {
  const pool = safeString(process.env.TWILIO_PROVISION_POOL)
    .split(/[\s,]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  if (pool.length) {
    const fromNumber = pool[0];
    return {
      ok: true,
      fromNumber,
      phoneSid: null,
      fromPool: true,
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
  const buyRes = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        PhoneNumber: phoneNumber,
        FriendlyName: friendlyName || "VIBETech SMS",
      }).toString(),
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
  };
}

function basicAuth(sid, token) {
  const raw = `${sid}:${token}`;
  if (typeof Buffer !== "undefined") {
    return `Basic ${Buffer.from(raw).toString("base64")}`;
  }
  return `Basic ${btoa(raw)}`;
}
