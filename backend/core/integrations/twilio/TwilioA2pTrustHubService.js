/**
 * Twilio Trust Hub / A2P Brand + Campaign registration.
 * Submits brand fields captured at SMS provision; polls carrier status.
 * Falls back to simulated pending when TWILIO_A2P_SIMULATE=1 or Trust Hub not fully configured.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function basicAuth(sid, token) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

function mapBrandStatus(raw) {
  const s = String(raw ?? "").toUpperCase();
  if (s === "APPROVED" || s === "REGISTERED") return "approved";
  if (s === "FAILED" || s === "REJECTED") return "failed";
  if (s === "IN_REVIEW" || s === "PENDING_REVIEW" || s === "PENDING") return "pending";
  if (s === "DRAFT") return "draft";
  return "pending";
}

/**
 * Submit or refresh A2P registration for a workspace Twilio account.
 */
export async function submitTwilioA2pRegistration({
  accountSid,
  authToken,
  brand = {},
  messagingServiceSid = null,
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
      a2pRegistrationStatus: "pending",
      message: "Twilio account credentials required for A2P registration.",
    });
  }

  if (simulate || process.env.TWILIO_PROVISION_SIMULATE === "1") {
    return deepFreeze({
      ok: true,
      simulated: true,
      a2pRegistrationStatus: "pending",
      brandRegistrationSid: existing.brandRegistrationSid || `BN_sim_${Date.now().toString(36)}`,
      campaignSid: existing.campaignSid || `QE_sim_${Date.now().toString(36)}`,
      messagingServiceSid: messagingServiceSid || existing.messagingServiceSid || null,
      at: nowISO,
      message: "A2P registration submitted (simulated). Carrier approval can take days.",
    });
  }

  const customerProfileSid = safeString(
    existing.customerProfileSid || process.env.TWILIO_A2P_CUSTOMER_PROFILE_SID,
  );
  const a2pProfileBundleSid = safeString(
    existing.a2pProfileBundleSid || process.env.TWILIO_A2P_PROFILE_BUNDLE_SID,
  );

  // Prefer refreshing an existing brand registration.
  if (existing.brandRegistrationSid) {
    const refreshed = await refreshTwilioA2pStatus({
      accountSid: sid,
      authToken: token,
      brandRegistrationSid: existing.brandRegistrationSid,
      campaignSid: existing.campaignSid,
      fetchImpl,
      nowISO,
    });
    if (refreshed.ok && refreshed.a2pRegistrationStatus === "approved") {
      return refreshed;
    }
  }

  let brandRegistrationSid = safeString(existing.brandRegistrationSid);
  let brandStatus = "pending";
  let brandError = null;

  if (!brandRegistrationSid && customerProfileSid && a2pProfileBundleSid) {
    try {
      const body = new URLSearchParams({
        CustomerProfileBundleSid: customerProfileSid,
        A2PProfileBundleSid: a2pProfileBundleSid,
        BrandType: safeString(process.env.TWILIO_A2P_BRAND_TYPE || "STANDARD"),
        SkipAutomaticSecVet: process.env.TWILIO_A2P_SKIP_SEC_VET === "1" ? "true" : "false",
      });
      // Starter brands can include business identity hints when provided.
      if (safeString(brand.legalBusinessName)) {
        body.set("FriendlyName", safeString(brand.dba || brand.legalBusinessName).slice(0, 64));
      }
      const res = await fetchImpl("https://messaging.twilio.com/v1/a2p/BrandRegistrations", {
        method: "POST",
        headers: {
          Authorization: basicAuth(sid, token),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        brandRegistrationSid = safeString(data.sid);
        brandStatus = mapBrandStatus(data.status);
      } else {
        brandError = safeString(data.message) || `Brand registration failed (HTTP ${res.status})`;
      }
    } catch (err) {
      brandError = err instanceof Error ? err.message : String(err);
    }
  } else if (!brandRegistrationSid) {
    brandError = customerProfileSid && a2pProfileBundleSid
      ? null
      : "Set TWILIO_A2P_CUSTOMER_PROFILE_SID and TWILIO_A2P_PROFILE_BUNDLE_SID (Trust Hub bundles) to auto-submit Brand Registration.";
  }

  let campaignSid = safeString(existing.campaignSid);
  let campaignStatus = null;
  const msSid = safeString(messagingServiceSid || existing.messagingServiceSid || process.env.TWILIO_MESSAGING_SERVICE_SID);

  if (brandRegistrationSid && msSid && !campaignSid) {
    try {
      const samples = Array.isArray(brand.messageSamples) ? brand.messageSamples : [];
      const body = new URLSearchParams({
        BrandRegistrationSid: brandRegistrationSid,
        Description: safeString(brand.campaignDescription || brand.useCase).slice(0, 4096)
          || "Customer care appointment and intake messages.",
        MessageFlow: safeString(brand.messageFlow).slice(0, 2048)
          || "Customers opt in on our website or intake forms and can reply STOP.",
        UsAppToPersonUsecase: safeString(brand.campaignUseCase || "CUSTOMER_CARE"),
        HasEmbeddedLinks: brand.hasEmbeddedLinks ? "true" : "false",
        HasEmbeddedPhone: brand.hasEmbeddedPhone ? "true" : "false",
        OptInMessage: "You are opted in to receive messages. Reply STOP to opt out, HELP for help.",
        OptOutMessage: "You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.",
        HelpMessage: "Reply STOP to unsubscribe. Msg&Data rates may apply.",
      });
      if (samples[0]) body.append("MessageSamples", String(samples[0]).slice(0, 1024));
      if (samples[1]) body.append("MessageSamples", String(samples[1]).slice(0, 1024));
      const res = await fetchImpl(
        `https://messaging.twilio.com/v1/Services/${encodeURIComponent(msSid)}/Compliance/Usa2p`,
        {
          method: "POST",
          headers: {
            Authorization: basicAuth(sid, token),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        campaignSid = safeString(data.sid);
        campaignStatus = safeString(data.campaign_status || data.status);
      } else if (!brandError) {
        brandError = safeString(data.message) || `Campaign create failed (HTTP ${res.status})`;
      }
    } catch (err) {
      if (!brandError) brandError = err instanceof Error ? err.message : String(err);
    }
  }

  const status = brandStatus === "approved" && (!campaignSid || /approved|verified/i.test(String(campaignStatus)))
    ? "approved"
    : brandStatus === "failed"
      ? "failed"
      : "pending";

  return deepFreeze({
    ok: Boolean(brandRegistrationSid) || Boolean(existing.brandRegistrationSid),
    simulated: false,
    a2pRegistrationStatus: status,
    brandRegistrationSid: brandRegistrationSid || null,
    campaignSid: campaignSid || null,
    messagingServiceSid: msSid || null,
    customerProfileSid: customerProfileSid || null,
    a2pProfileBundleSid: a2pProfileBundleSid || null,
    brandSnapshot: {
      legalBusinessName: brand.legalBusinessName,
      ein: brand.ein,
      website: brand.website,
    },
    error: brandError,
    at: nowISO,
    message: brandRegistrationSid
      ? "A2P brand submitted to Twilio. Carrier approval can take several days — status updates automatically."
      : (brandError || "A2P registration pending Trust Hub configuration."),
  });
}

export async function refreshTwilioA2pStatus({
  accountSid,
  authToken,
  brandRegistrationSid,
  campaignSid = null,
  messagingServiceSid = null,
  fetchImpl = globalThis.fetch,
  nowISO = new Date().toISOString(),
} = {}) {
  const sid = safeString(accountSid);
  const token = safeString(authToken);
  const brandSid = safeString(brandRegistrationSid);
  if (!sid || !token || !brandSid) {
    return deepFreeze({
      ok: false,
      reason: "missing_ids",
      a2pRegistrationStatus: "pending",
      at: nowISO,
    });
  }

  try {
    const res = await fetchImpl(
      `https://messaging.twilio.com/v1/a2p/BrandRegistrations/${encodeURIComponent(brandSid)}`,
      { headers: { Authorization: basicAuth(sid, token) } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return deepFreeze({
        ok: false,
        reason: "brand_fetch_failed",
        a2pRegistrationStatus: "pending",
        brandRegistrationSid: brandSid,
        campaignSid: campaignSid || null,
        error: safeString(data.message) || `HTTP ${res.status}`,
        at: nowISO,
      });
    }
    let status = mapBrandStatus(data.status);
    let campaignStatus = null;
    const msSid = safeString(messagingServiceSid);
    const campSid = safeString(campaignSid);
    if (msSid && campSid) {
      try {
        const cRes = await fetchImpl(
          `https://messaging.twilio.com/v1/Services/${encodeURIComponent(msSid)}/Compliance/Usa2p/${encodeURIComponent(campSid)}`,
          { headers: { Authorization: basicAuth(sid, token) } },
        );
        const cData = await cRes.json().catch(() => ({}));
        if (cRes.ok) {
          campaignStatus = safeString(cData.campaign_status || cData.status);
          if (/failed|rejected/i.test(campaignStatus)) status = "failed";
          else if (status === "approved" && !/approved|verified/i.test(campaignStatus)) status = "pending";
        }
      } catch {
        /* brand status still useful */
      }
    }
    return deepFreeze({
      ok: true,
      a2pRegistrationStatus: status,
      brandRegistrationSid: brandSid,
      campaignSid: campSid || null,
      messagingServiceSid: msSid || null,
      twilioBrandStatus: safeString(data.status),
      campaignStatus,
      at: nowISO,
      message: status === "approved"
        ? "A2P brand/campaign approved by carriers."
        : status === "failed"
          ? "A2P registration failed — check Twilio Console Trust Hub for details."
          : "A2P still pending carrier review.",
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "refresh_failed",
      a2pRegistrationStatus: "pending",
      brandRegistrationSid: brandSid,
      error: err instanceof Error ? err.message : String(err),
      at: nowISO,
    });
  }
}
