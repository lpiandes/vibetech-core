/**
 * Per-agency Twilio Trust Hub Customer Profile + A2P Trust Product creation.
 * Uses VibeKeep A2P profile fields collected at signup.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { normalizeFeA2pProfile } from "../../fe-retention/FeRetentionOnboardingCatalog.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function basicAuth(sid, token) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

function trustHubBase() {
  return "https://trusthub.twilio.com/v1";
}

function readTrustHubPolicySids() {
  return {
    customerProfilePolicySid: safeString(process.env.TWILIO_TRUST_HUB_CUSTOMER_PROFILE_POLICY_SID),
    a2pMessagingPolicySid: safeString(
      process.env.TWILIO_TRUST_HUB_A2P_MESSAGING_POLICY_SID
      || process.env.TWILIO_A2P_PROFILE_BUNDLE_SID,
    ),
  };
}

async function twilioFormPost({ url, accountSid, authToken, fields, fetchImpl }) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, String(value));
    }
  }
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function createSupportingDocument({ accountSid, authToken, type, attributes, friendlyName, fetchImpl }) {
  const { ok, data } = await twilioFormPost({
    url: `${trustHubBase()}/SupportingDocuments`,
    accountSid,
    authToken,
    fetchImpl,
    fields: {
      Type: type,
      FriendlyName: friendlyName,
      Attributes: JSON.stringify(attributes),
    },
  });
  if (!ok) {
    return { ok: false, error: safeString(data.message) || "SupportingDocument create failed" };
  }
  return { ok: true, sid: safeString(data.sid) };
}

async function createTwilioAddress({
  accountSid,
  authToken,
  customerName,
  address,
  fetchImpl,
}) {
  const { ok, data, status } = await twilioFormPost({
    url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Addresses.json`,
    accountSid,
    authToken,
    fetchImpl,
    fields: {
      CustomerName: customerName,
      Street: address.street,
      City: address.city,
      Region: address.region,
      PostalCode: address.postal_code,
      IsoCountry: address.iso_country,
    },
  });
  if (!ok) {
    return { ok: false, error: safeString(data.message) || `Address create failed (HTTP ${status})` };
  }
  return { ok: true, sid: safeString(data.sid) };
}

async function createEndUser({ accountSid, authToken, type, attributes, friendlyName, fetchImpl }) {
  const { ok, data } = await twilioFormPost({
    url: `${trustHubBase()}/EndUsers`,
    accountSid,
    authToken,
    fetchImpl,
    fields: {
      Type: type,
      FriendlyName: friendlyName,
      Attributes: JSON.stringify(attributes),
    },
  });
  if (!ok) {
    return { ok: false, error: safeString(data.message) || "EndUser create failed" };
  }
  return { ok: true, sid: safeString(data.sid) };
}

async function assignEntity({ accountSid, authToken, parentSid, objectSid, fetchImpl, resource = "CustomerProfiles" }) {
  const { ok, data } = await twilioFormPost({
    url: `${trustHubBase()}/${resource}/${encodeURIComponent(parentSid)}/EntityAssignments`,
    accountSid,
    authToken,
    fetchImpl,
    fields: { ObjectSid: objectSid },
  });
  if (!ok) {
    return { ok: false, error: safeString(data.message) || "Entity assignment failed" };
  }
  return { ok: true, sid: safeString(data.sid) };
}

function mapBusinessType(raw) {
  const value = safeString(raw);
  const allowed = new Set([
    "Limited Liability Corporation",
    "Corporation",
    "Sole Proprietorship",
    "Partnership",
    "Co-operative",
    "Non-profit Corporation",
  ]);
  return allowed.has(value) ? value : "Limited Liability Corporation";
}

function buildTrustHubEntities(profile = {}) {
  const p = normalizeFeA2pProfile(profile);
  const legalName = safeString(p.legalBusinessName);
  const business = {
    business_name: legalName,
    business_registration_number: safeString(p.ein),
    business_type: mapBusinessType(p.businessType),
    business_industry: safeString(p.businessIndustry || "INSURANCE"),
    business_registration_identifier: safeString(p.businessRegistrationIdType || "EIN"),
    business_regions_of_operation: "USA_AND_CANADA",
    business_identity: "direct_customer",
    website_url: safeString(p.websiteUrl),
    social_media_profile_urls: "",
  };
  const address = {
    street: safeString(p.street),
    city: safeString(p.city),
    region: safeString(p.region),
    postal_code: safeString(p.postalCode),
    iso_country: safeString(p.country || "US") || "US",
  };
  const rep = {
    first_name: safeString(p.contactFirstName),
    last_name: safeString(p.contactLastName),
    email: safeString(p.contactEmail),
    phone_number: safeString(p.contactPhone).startsWith("+")
      ? safeString(p.contactPhone)
      : `+1${safeString(p.contactPhone).replace(/\D/g, "").slice(-10)}`,
    job_position: safeString(p.jobPosition || "CEO"),
    business_title: safeString(p.businessTitle || "Owner"),
  };
  return { p, business, address, rep, legalName };
}

/**
 * Create a per-agency Trust Hub Customer Profile + A2P Trust Product.
 * Returns bundle SIDs for Brand Registration.
 */
export async function createAgencyCustomerProfile({
  accountSid,
  authToken,
  profile = {},
  existing = {},
  fetchImpl = globalThis.fetch,
  simulate = process.env.TWILIO_A2P_SIMULATE === "1",
  nowISO = new Date().toISOString(),
} = {}) {
  const sid = safeString(accountSid);
  const token = safeString(authToken);
  if (!sid || !token) {
    return deepFreeze({
      ok: false,
      reason: "credentials_required",
      message: "Twilio credentials required for Trust Hub profile creation.",
    });
  }

  const existingCustomerProfileSid = safeString(existing.customerProfileSid);
  const existingA2pBundleSid = safeString(existing.a2pProfileBundleSid);
  if (existingCustomerProfileSid && existingA2pBundleSid) {
    return deepFreeze({
      ok: true,
      already: true,
      customerProfileSid: existingCustomerProfileSid,
      a2pProfileBundleSid: existingA2pBundleSid,
      trustProductSid: safeString(existing.trustProductSid) || existingA2pBundleSid,
      at: nowISO,
      message: "Trust Hub profile already exists for this book.",
    });
  }

  if (simulate || process.env.TWILIO_PROVISION_SIMULATE === "1") {
    const suffix = Date.now().toString(36);
    return deepFreeze({
      ok: true,
      simulated: true,
      customerProfileSid: existingCustomerProfileSid || `BU_sim_cp_${suffix}`,
      a2pProfileBundleSid: existingA2pBundleSid || `BU_sim_a2p_${suffix}`,
      trustProductSid: `BU_sim_tp_${suffix}`,
      at: nowISO,
      message: "Trust Hub profile created (simulated).",
    });
  }

  const policies = readTrustHubPolicySids();
  if (!policies.customerProfilePolicySid || !policies.a2pMessagingPolicySid) {
    return deepFreeze({
      ok: false,
      reason: "trust_hub_policies_missing",
      message: "Set TWILIO_TRUST_HUB_CUSTOMER_PROFILE_POLICY_SID and TWILIO_TRUST_HUB_A2P_MESSAGING_POLICY_SID on the server.",
    });
  }

  const { p, business, address, rep, legalName } = buildTrustHubEntities(profile);
  if (!legalName || !safeString(p.ein)) {
    return deepFreeze({
      ok: false,
      reason: "profile_incomplete",
      message: "Legal business name and EIN are required for Trust Hub registration.",
    });
  }

  let customerProfileSid = existingCustomerProfileSid;
  let trustProductSid = safeString(existing.trustProductSid);
  let error = null;

  try {
    if (!customerProfileSid) {
      const cp = await twilioFormPost({
        url: `${trustHubBase()}/CustomerProfiles`,
        accountSid: sid,
        authToken: token,
        fetchImpl,
        fields: {
          PolicySid: policies.customerProfilePolicySid,
          FriendlyName: legalName.slice(0, 64),
          Email: safeString(p.notifyEmail || p.contactEmail),
        },
      });
      if (!cp.ok) {
        return deepFreeze({
          ok: false,
          reason: "customer_profile_failed",
          error: safeString(cp.data.message) || `HTTP ${cp.status}`,
          message: safeString(cp.data.message) || "Could not create Trust Hub Customer Profile.",
        });
      }
      customerProfileSid = safeString(cp.data.sid);
    }

    const businessUser = await createEndUser({
      accountSid: sid,
      authToken: token,
      fetchImpl,
      type: "customer_profile_business_information",
      friendlyName: `${legalName} — business info`,
      attributes: business,
    });
    if (!businessUser.ok) {
      return deepFreeze({ ok: false, reason: "business_end_user_failed", error: businessUser.error });
    }

    const twilioAddress = await createTwilioAddress({
      accountSid: sid,
      authToken: token,
      fetchImpl,
      customerName: legalName,
      address,
    });
    if (!twilioAddress.ok) {
      return deepFreeze({ ok: false, reason: "address_create_failed", error: twilioAddress.error });
    }

    const addressDoc = await createSupportingDocument({
      accountSid: sid,
      authToken: token,
      fetchImpl,
      type: "customer_profile_address",
      friendlyName: `${legalName} — address`,
      attributes: { address_sids: twilioAddress.sid },
    });
    if (!addressDoc.ok) {
      return deepFreeze({ ok: false, reason: "address_end_user_failed", error: addressDoc.error });
    }

    const repUser = await createEndUser({
      accountSid: sid,
      authToken: token,
      fetchImpl,
      type: "authorized_representative_1",
      friendlyName: `${rep.first_name} ${rep.last_name}`.trim(),
      attributes: rep,
    });
    if (!repUser.ok) {
      return deepFreeze({ ok: false, reason: "rep_end_user_failed", error: repUser.error });
    }

    for (const objectSid of [businessUser.sid, addressDoc.sid, repUser.sid]) {
      const assigned = await assignEntity({
        accountSid: sid,
        authToken: token,
        fetchImpl,
        parentSid: customerProfileSid,
        objectSid,
        resource: "CustomerProfiles",
      });
      if (!assigned.ok) {
        return deepFreeze({ ok: false, reason: "profile_assignment_failed", error: assigned.error });
      }
    }

    if (!trustProductSid) {
      const tp = await twilioFormPost({
        url: `${trustHubBase()}/TrustProducts`,
        accountSid: sid,
        authToken: token,
        fetchImpl,
        fields: {
          PolicySid: policies.a2pMessagingPolicySid,
          FriendlyName: `${legalName} A2P`.slice(0, 64),
          Email: safeString(p.notifyEmail || p.contactEmail),
        },
      });
      if (!tp.ok) {
        return deepFreeze({
          ok: false,
          reason: "trust_product_failed",
          error: safeString(tp.data.message) || `HTTP ${tp.status}`,
        });
      }
      trustProductSid = safeString(tp.data.sid);
    }

    const a2pInfo = await createEndUser({
      accountSid: sid,
      authToken: token,
      fetchImpl,
      type: "us_a2p_messaging_profile_information",
      friendlyName: `${legalName} — A2P info`,
      attributes: {
        company_type: "private",
        brand_contact_email: safeString(p.contactEmail),
        stock_exchange: "",
        stock_ticker: "",
      },
    });
    if (!a2pInfo.ok) {
      return deepFreeze({ ok: false, reason: "a2p_info_failed", error: a2pInfo.error });
    }

    const tpAssigned = await assignEntity({
      accountSid: sid,
      authToken: token,
      fetchImpl,
      parentSid: trustProductSid,
      objectSid: a2pInfo.sid,
      resource: "TrustProducts",
    });
    if (!tpAssigned.ok) {
      return deepFreeze({ ok: false, reason: "trust_product_assignment_failed", error: tpAssigned.error });
    }

    const linkTp = await assignEntity({
      accountSid: sid,
      authToken: token,
      fetchImpl,
      parentSid: customerProfileSid,
      objectSid: trustProductSid,
      resource: "CustomerProfiles",
    });
    if (!linkTp.ok) {
      return deepFreeze({ ok: false, reason: "profile_trust_product_link_failed", error: linkTp.error });
    }

    const submit = await twilioFormPost({
      url: `${trustHubBase()}/CustomerProfiles/${encodeURIComponent(customerProfileSid)}`,
      accountSid: sid,
      authToken: token,
      fetchImpl,
      fields: { Status: "pending-review" },
    });
    if (!submit.ok) {
      error = safeString(submit.data.message) || "Profile submit for review failed";
    }
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "trust_hub_exception",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return deepFreeze({
    ok: true,
    customerProfileSid,
    a2pProfileBundleSid: trustProductSid,
    trustProductSid,
    error,
    at: nowISO,
    message: error
      ? `Trust Hub profile created but submit warning: ${error}`
      : "Trust Hub Customer Profile submitted for review.",
  });
}

export { buildTrustHubEntities, readTrustHubPolicySids };
