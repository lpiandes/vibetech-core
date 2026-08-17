/**
 * Per-book Twilio inbound for FE Retention (STOP → pause SMS on that book only).
 */
import { businessGrantsFeRetentionAccess, isFeRetentionBusinessArchived } from "./feRetentionEntitlement.js";
import { readPurchasedPackagesFromConfig } from "../platform/packages/SalesPackageCatalog.js";
import {
  appendFeMessageLog,
  findFeClientByPhone,
  isFeClientSmsPaused,
  readFeRetentionState,
  setFeClientReinstatement,
  setFeClientSmsOptOut,
  writeFeRetentionState,
} from "./FeRetentionStore.js";
import {
  feSmsPhonesMatch,
  readPlatformTwilioSmsEnv,
  resolveFeRetentionFromNumber,
  resolveFeRetentionInboundSmsWebhookUrl,
  sendFeRetentionSmsMessage,
} from "./FeRetentionSms.js";
import { sendFeAgentNotifyEmail } from "./FeRetentionEmail.js";

export { resolveFeRetentionInboundSmsWebhookUrl };

const OPT_OUT_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

const OPT_IN_KEYWORDS = new Set(["START", "UNSTOP", "YESSTART"]);
const YES_KEYWORDS = new Set(["YES", "Y", "YEAH", "YEP"]);

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function normalizeFeInboundKeyword(text) {
  return safeString(text).toUpperCase().replace(/[.!?]+$/g, "");
}

export function isFeSmsOptOutKeyword(text) {
  return OPT_OUT_KEYWORDS.has(normalizeFeInboundKeyword(text));
}

export function isFeSmsOptInKeyword(text) {
  return OPT_IN_KEYWORDS.has(normalizeFeInboundKeyword(text));
}

export function isFeSmsYesKeyword(text) {
  return YES_KEYWORDS.has(normalizeFeInboundKeyword(text));
}

/**
 * @returns {"stop"|"start"|"yes"|"ignored"}
 */
export function classifyFeInboundSms({ body = "", optOutType = "" } = {}) {
  const opt = normalizeFeInboundKeyword(optOutType);
  if (isFeSmsOptOutKeyword(body) || opt === "STOP" || isFeSmsOptOutKeyword(opt)) return "stop";
  if (isFeSmsOptInKeyword(body) || opt === "START" || isFeSmsOptInKeyword(opt)) return "start";
  if (isFeSmsYesKeyword(body)) return "yes";
  return "ignored";
}

function clientEligibleForYes(state, client) {
  const status = client?.policy?.status || "active";
  if (status === "missed" || status === "lapsed") return true;
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return (state.messageLog ?? []).some((row) => (
    String(row.clientId) === String(client.id)
    && row.kind === "lapseRecovery"
    && row.ok
    && Date.parse(row.at || "") >= cutoff
  ));
}

async function notifyAgentOfInbound({
  state,
  client,
  businessName,
  deliveryProvider,
  integrationPlatform,
  platformStore,
  businessId,
  fromNumber,
  reason,
}) {
  const notifyEmail = safeString(state.settings?.agentNotifyEmail);
  const notifyPhone = safeString(state.settings?.agentNotifyPhone);
  let next = state;
  if (notifyPhone) {
    const body = `VibeTech: ${client.name} replied YES — they want help reinstating. Open Needs attention.`;
    const sms = await sendFeRetentionSmsMessage({
      integrationPlatform,
      platformStore,
      businessId,
      fromNumber,
      to: notifyPhone,
      body,
    });
    const logged = appendFeMessageLog(next, {
      kind: "agent_inbound_sms",
      channel: "sms",
      clientId: client.id,
      clientName: client.name,
      to: notifyPhone,
      body,
      ok: Boolean(sms?.ok),
      error: sms?.ok ? null : (sms?.message || sms?.reason),
    });
    next = logged.state;
  }
  if (notifyEmail && deliveryProvider) {
    const email = await sendFeAgentNotifyEmail({
      deliveryProvider,
      to: notifyEmail,
      client,
      businessName,
    });
    const logged = appendFeMessageLog(next, {
      kind: "agent_inbound_email",
      channel: "email",
      clientId: client.id,
      clientName: client.name,
      to: notifyEmail,
      body: `Inbound ${reason} from ${client.name}`,
      ok: Boolean(email?.ok),
      error: email?.ok ? null : (email?.message || email?.reason),
    });
    next = logged.state;
  }
  return next;
}

const lastFeInboundWebhookConfigureAtByNumber = new Map();
const FE_INBOUND_WEBHOOK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Point a VibeKeep From-number at /api/insurance/sms/inbound.
 * Cooldown is per number so a new purchase is not skipped after the shared number is configured.
 */
export async function configureFeRetentionInboundSmsWebhook({
  fetchImpl = globalThis.fetch,
  force = false,
  fromNumber = null,
} = {}) {
  const env = readPlatformTwilioSmsEnv();
  const targetNumber = safeString(fromNumber) || env.fromNumber;
  const now = Date.now();
  const lastAt = lastFeInboundWebhookConfigureAtByNumber.get(targetNumber) || 0;
  if (!force && lastAt && (now - lastAt) < FE_INBOUND_WEBHOOK_COOLDOWN_MS) {
    return {
      ok: true,
      skipped: true,
      reason: "cooldown",
      webhookUrl: resolveFeRetentionInboundSmsWebhookUrl(),
      fromNumber: targetNumber,
    };
  }

  const webhookUrl = resolveFeRetentionInboundSmsWebhookUrl();
  if (!webhookUrl) {
    return {
      ok: false,
      reason: "webhook_url_unresolved",
      message: "Set APP_URL or NEXTAUTH_URL so the STOP webhook can be configured.",
    };
  }
  if (!env.accountSid || !env.authToken || !targetNumber) {
    return { ok: false, reason: "platform_twilio_not_configured" };
  }

  const auth = Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64");
  try {
    const lookupRes = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.accountSid)}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(targetNumber)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    const lookup = await lookupRes.json().catch(() => ({}));
    const row = Array.isArray(lookup?.incoming_phone_numbers) ? lookup.incoming_phone_numbers[0] : null;
    const phoneSid = safeString(row?.sid);
    if (!phoneSid) {
      return { ok: false, reason: "phone_sid_unresolved", message: "Could not find the Twilio number to configure." };
    }
    if (!force && safeString(row?.sms_url) === webhookUrl) {
      lastFeInboundWebhookConfigureAtByNumber.set(targetNumber, now);
      return { ok: true, skipped: true, reason: "already_configured", webhookUrl, phoneSid, fromNumber: targetNumber };
    }
    const updateRes = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.accountSid)}/IncomingPhoneNumbers/${encodeURIComponent(phoneSid)}.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
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
        message: safeString(updated?.message) || `HTTP ${updateRes.status}`,
      };
    }
    lastFeInboundWebhookConfigureAtByNumber.set(targetNumber, now);
    return {
      ok: true,
      webhookUrl,
      phoneSid,
      fromNumber: targetNumber,
      configured: safeString(updated?.sms_url) === webhookUrl,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "webhook_network_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function listFeBusinessInstallations(platformStore, { toNumber = "" } = {}) {
  let businesses = [];
  try {
    businesses = await platformStore.listBusinesses({ limit: 200 });
  } catch {
    businesses = await platformStore.listAllBusinesses?.() ?? [];
  }
  const inboundTo = safeString(toNumber);
  const out = [];
  for (const business of Array.isArray(businesses) ? businesses : []) {
    if (isFeRetentionBusinessArchived(business)) continue;
    const packages = readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {});
    if (!businessGrantsFeRetentionAccess(packages)) continue;
    const businessId = String(business.id);
    const fromNumber = await resolveFeRetentionFromNumber({
      platformStore,
      businessId,
      packageConfiguration: business.packageConfiguration,
    });
    if (inboundTo) {
      if (!fromNumber || !feSmsPhonesMatch(inboundTo, fromNumber)) continue;
    }
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) continue;
    out.push({ businessId, business, installation, fromNumber });
  }
  return out;
}

/**
 * Pause SMS for matching FE clients on the book that owns Twilio To.
 */
export async function applyFeSmsOptOutByInboundPhone({
  platformStore,
  fromPhone,
  toNumber = "",
  inboundText = "",
  actorId = "fe_sms_inbound",
} = {}) {
  const matches = [];
  if (!platformStore || !safeString(fromPhone)) {
    return { ok: false, reason: "missing_args", matches };
  }

  const installations = await listFeBusinessInstallations(platformStore, { toNumber });
  for (const { businessId, installation } of installations) {
    let state = readFeRetentionState(installation);
    const client = findFeClientByPhone(state, fromPhone);
    if (!client) continue;

    const already = isFeClientSmsPaused(client);
    if (!already) {
      const updated = setFeClientSmsOptOut(state, {
        clientId: client.id,
        optedOut: true,
        source: "sms_stop",
      });
      state = updated.state;
    }

    const logged = appendFeMessageLog(state, {
      kind: "sms_opt_out",
      channel: "sms",
      clientId: client.id,
      clientName: client.name,
      to: client.phone,
      body: safeString(inboundText) || "STOP",
      ok: true,
      error: null,
    });
    state = logged.state;

    await writeFeRetentionState({
      platformStore,
      installation,
      state,
      actorId,
      historyAction: "fe_sms_opt_out",
    });

    matches.push({
      businessId,
      clientId: client.id,
      clientName: client.name,
      alreadyOptedOut: already,
    });
  }

  return { ok: true, matches, count: matches.length };
}

/**
 * Route inbound SMS for matching FE clients: STOP / START / YES.
 */
export async function applyFeInboundByPhone({
  platformStore,
  fromPhone,
  toNumber = "",
  inboundText = "",
  optOutType = "",
  deliveryProvider = null,
  integrationPlatform = null,
  actorId = "fe_sms_inbound",
} = {}) {
  const intent = classifyFeInboundSms({ body: inboundText, optOutType });
  if (intent === "stop") {
    return { intent, ...(await applyFeSmsOptOutByInboundPhone({
      platformStore,
      fromPhone,
      toNumber,
      inboundText,
      actorId,
    })) };
  }
  const matches = [];
  if (!platformStore || !safeString(fromPhone) || intent === "ignored") {
    return { ok: true, intent, matches, count: 0 };
  }

  const installations = await listFeBusinessInstallations(platformStore, { toNumber });
  for (const { businessId, business, installation, fromNumber } of installations) {
    let state = readFeRetentionState(installation);
    const client = findFeClientByPhone(state, fromPhone);
    if (!client) continue;
    const bookName = business?.name || "FE Retention";

    if (intent === "start") {
      const updated = setFeClientSmsOptOut(state, {
        clientId: client.id,
        optedOut: false,
        source: "sms_start",
      });
      state = updated.state;
      const logged = appendFeMessageLog(state, {
        kind: "sms_opt_in",
        channel: "sms",
        clientId: client.id,
        clientName: client.name,
        to: client.phone,
        body: safeString(inboundText) || "START",
        ok: true,
      });
      state = logged.state;
    } else if (intent === "yes") {
      if (!clientEligibleForYes(state, client)) continue;
      const updated = setFeClientReinstatement(state, { clientId: client.id, status: "open" });
      state = updated.state;
      const logged = appendFeMessageLog(state, {
        kind: "inbound_yes",
        channel: "sms",
        clientId: client.id,
        clientName: client.name,
        to: client.phone,
        body: safeString(inboundText) || "YES",
        ok: true,
      });
      state = logged.state;
      state = await notifyAgentOfInbound({
        state,
        client: updated.client,
        businessName: bookName,
        deliveryProvider,
        integrationPlatform,
        platformStore,
        businessId,
        fromNumber,
        reason: "yes",
      });
    }

    await writeFeRetentionState({
      platformStore,
      installation,
      state,
      actorId,
      historyAction: `fe_sms_${intent}`,
      settingsMode: "preserve_settings",
    });
    matches.push({ businessId, clientId: client.id, clientName: client.name, intent });
  }

  return { ok: true, intent, matches, count: matches.length };
}
