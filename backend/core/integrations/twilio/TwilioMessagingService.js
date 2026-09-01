/**
 * Twilio Messaging Service lifecycle — per-agency sender pools for A2P.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function basicAuth(sid, token) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

function apiBase(accountSid) {
  return `https://messaging.twilio.com/v1`;
}

export async function createMessagingService({
  accountSid,
  authToken,
  friendlyName,
  fetchImpl = globalThis.fetch,
  simulate = process.env.TWILIO_A2P_SIMULATE === "1",
} = {}) {
  const sid = safeString(accountSid);
  const token = safeString(authToken);
  const name = safeString(friendlyName) || "VibeKeep Messaging";
  if (!sid || !token) {
    return deepFreeze({ ok: false, reason: "credentials_required" });
  }
  if (simulate || process.env.TWILIO_PROVISION_SIMULATE === "1") {
    return deepFreeze({
      ok: true,
      simulated: true,
      messagingServiceSid: `MG_sim_${Date.now().toString(36)}`,
    });
  }
  try {
    const body = new URLSearchParams({
      FriendlyName: name.slice(0, 64),
    });
    const res = await fetchImpl(`${apiBase(sid)}/Services`, {
      method: "POST",
      headers: {
        Authorization: basicAuth(sid, token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return deepFreeze({
        ok: false,
        reason: "messaging_service_failed",
        message: safeString(data.message) || `HTTP ${res.status}`,
      });
    }
    return deepFreeze({
      ok: true,
      messagingServiceSid: safeString(data.sid),
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "messaging_service_exception",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function lookupPhoneNumberSid({
  accountSid,
  authToken,
  phoneNumber,
  fetchImpl = globalThis.fetch,
} = {}) {
  const sid = safeString(accountSid);
  const token = safeString(authToken);
  const phone = safeString(phoneNumber);
  if (!sid || !token || !phone) {
    return deepFreeze({ ok: false, reason: "args_required" });
  }
  try {
    const encoded = encodeURIComponent(phone);
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/IncomingPhoneNumbers.json?PhoneNumber=${encoded}&PageSize=1`,
      { headers: { Authorization: basicAuth(sid, token) } },
    );
    const data = await res.json().catch(() => ({}));
    const row = Array.isArray(data.incoming_phone_numbers) ? data.incoming_phone_numbers[0] : null;
    const phoneSid = safeString(row?.sid);
    if (!phoneSid) {
      return deepFreeze({ ok: false, reason: "phone_not_found", message: `No Twilio number found for ${phone}` });
    }
    return deepFreeze({ ok: true, phoneNumberSid: phoneSid });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "phone_lookup_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function addNumberToSenderPool({
  accountSid,
  authToken,
  messagingServiceSid,
  phoneNumberSid,
  fetchImpl = globalThis.fetch,
  simulate = process.env.TWILIO_A2P_SIMULATE === "1",
} = {}) {
  const sid = safeString(accountSid);
  const token = safeString(authToken);
  const msSid = safeString(messagingServiceSid);
  const pnSid = safeString(phoneNumberSid);
  if (!sid || !token || !msSid || !pnSid) {
    return deepFreeze({ ok: false, reason: "args_required" });
  }
  if (simulate || process.env.TWILIO_PROVISION_SIMULATE === "1") {
    return deepFreeze({ ok: true, simulated: true, already: false });
  }
  try {
    const body = new URLSearchParams({ PhoneNumberSid: pnSid });
    const res = await fetchImpl(
      `${apiBase(sid)}/Services/${encodeURIComponent(msSid)}/PhoneNumbers`,
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
    if (!res.ok) {
      const msg = safeString(data.message) || `HTTP ${res.status}`;
      if (/already/i.test(msg)) {
        return deepFreeze({ ok: true, already: true, message: msg });
      }
      return deepFreeze({ ok: false, reason: "sender_pool_failed", message: msg });
    }
    return deepFreeze({ ok: true, sid: safeString(data.sid) });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "sender_pool_exception",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
