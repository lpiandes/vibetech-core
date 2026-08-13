/**
 * Platform-managed Twilio SMS for FE Retention CRM.
 * Agents never enter Twilio credentials — VibeTech env number sends retention texts.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { INTEGRATION_CAPABILITIES } from "../integrations/capabilities/IntegrationCapability.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function readPlatformTwilioSmsEnv() {
  return {
    accountSid: safeString(process.env.TWILIO_ACCOUNT_SID),
    authToken: safeString(process.env.TWILIO_AUTH_TOKEN),
    fromNumber: safeString(process.env.TWILIO_MESSAGING_FROM || process.env.TWILIO_PHONE_NUMBER),
  };
}

export function listMissingPlatformTwilioEnvKeys() {
  const env = readPlatformTwilioSmsEnv();
  const missing = [];
  if (!env.accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!env.authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!env.fromNumber) missing.push("TWILIO_MESSAGING_FROM");
  return missing;
}

export function isPlatformTwilioSmsReady() {
  return listMissingPlatformTwilioEnvKeys().length === 0;
}

function resolveSmsConnection(integrationPlatform) {
  const runtime = integrationPlatform?.connectionRuntime;
  if (!runtime) return null;
  return runtime.getConnectionByType?.("sms_channel")
    ?? runtime.getConnectionByType?.("twilio_sms")
    ?? null;
}

/**
 * Persist platform Twilio secrets onto the business so reconcile + Settings can see them.
 * Idempotent — skips if a Twilio SMS credential already exists.
 */
export async function ensureFeRetentionPlatformSms({
  platformStore,
  businessId,
  vault = null,
  putDurableCredential,
  actorId = "fe_retention_sms",
} = {}) {
  const id = safeString(businessId);
  if (!id || typeof putDurableCredential !== "function" || !platformStore) {
    return deepFreeze({ ok: false, reason: "missing_args" });
  }

  const env = readPlatformTwilioSmsEnv();
  if (!env.accountSid || !env.authToken || !env.fromNumber) {
    return deepFreeze({
      ok: false,
      reason: "platform_twilio_not_configured",
      message: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_FROM on the server.",
    });
  }

  const credentialId = `cred_twilio_sms_${id}`;
  try {
    const existing = await platformStore.getIntegrationCredential?.(credentialId).catch(() => null);
    if (existing?.secrets?.accountSid && existing?.secrets?.fromNumber) {
      return deepFreeze({
        ok: true,
        already: true,
        credentialId,
        fromNumber: safeString(existing.secrets.fromNumber || existing.metadata?.fromNumber),
      });
    }
  } catch {
    /* continue to write */
  }

  await putDurableCredential({
    platformStore,
    vault,
    workspaceId: id,
    credentialId,
    providerType: "twilio_sms",
    secrets: {
      accountSid: env.accountSid,
      authToken: env.authToken,
      fromNumber: env.fromNumber,
    },
    metadata: {
      fromNumber: env.fromNumber,
      provisionedBy: "fe_retention_platform",
      a2pRegistrationStatus: "platform_shared",
      actorId,
    },
  });

  return deepFreeze({
    ok: true,
    already: false,
    credentialId,
    fromNumber: env.fromNumber,
  });
}

/**
 * Send SMS via workspace Twilio connection, else direct platform Twilio env (FE default).
 */
export async function sendFeRetentionSmsMessage({
  integrationPlatform = null,
  to,
  body,
  fetchImpl = globalThis.fetch,
  nowISO = null,
} = {}) {
  const phone = safeString(to);
  const text = safeString(body);
  if (!phone || !text) {
    return deepFreeze({ ok: false, reason: "to_and_body_required" });
  }

  const connection = resolveSmsConnection(integrationPlatform);
  const provider = integrationPlatform?.providerRegistry?.getProvider?.("twilio_sms")
    ?? (connection
      ? integrationPlatform?.providerRegistry?.getProvider?.(connection.providerId)
      : null);

  if (connection && provider?.executeAction) {
    if (typeof provider._nowISO !== "undefined" && nowISO) {
      provider._nowISO = String(nowISO);
    }
    const result = await provider.executeAction({
      actionRequest: {
        capability: INTEGRATION_CAPABILITIES.SEND_SMS,
        parameters: { to: phone, body: text },
      },
      connection,
      credentialResolver: integrationPlatform.credentialResolver,
    });
    if (result?.status === "completed") {
      return deepFreeze({
        ok: true,
        via: "connection",
        externalReference: result.externalReference ?? null,
        fromNumber: result.metadata?.from ?? null,
      });
    }
    // Fall through to platform env if connection send failed (e.g. missing vault hydrate)
  }

  const env = readPlatformTwilioSmsEnv();
  if (!env.accountSid || !env.authToken || !env.fromNumber) {
    return deepFreeze({
      ok: false,
      reason: "sms_not_ready",
      message: connection
        ? "SMS connection failed and platform Twilio env is not configured."
        : "Texting is not ready. Platform Twilio env is not configured.",
    });
  }

  const auth = Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64");
  const form = new URLSearchParams({ To: phone, From: env.fromNumber, Body: text });
  try {
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${env.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return deepFreeze({
        ok: false,
        reason: "twilio_http_error",
        message: safeString(data?.message || `Twilio HTTP ${res.status}`),
        errorCode: data?.code ?? null,
      });
    }
    return deepFreeze({
      ok: true,
      via: "platform_env",
      externalReference: safeString(data.sid) || null,
      fromNumber: env.fromNumber,
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      reason: "twilio_network_error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
