/**
 * Derive connection CONNECTED flags from durable vault credential rows.
 * Snapshot/runtime often lag OAuth on cold serverless — credentials are SoT.
 */

function isLiveConnectedStatus(value) {
  const status = String(
    typeof value === "object" && value != null
      ? (value.status ?? value.state ?? "")
      : (value ?? ""),
  ).toUpperCase();
  return status === "CONNECTED" || status === "VERIFIED" || status === "PROVEN" || status === "OK";
}

function hasRealSecret(secrets = {}, keys = []) {
  const obj = secrets && typeof secrets === "object" ? secrets : {};
  return keys.some((key) => String(obj[key] ?? "").trim().length > 0);
}

/**
 * True when a vault row represents a usable connected channel (not a request-setup stub).
 */
export function credentialRowImpliesConnected(row = {}) {
  const provider = String(row?.providerType ?? "").toLowerCase();
  const id = String(row?.credentialId ?? "").toLowerCase();
  const secrets = row?.secrets && typeof row.secrets === "object" ? row.secrets : {};
  const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};

  if (provider.includes("gmail") || id.includes("gmail") || id.startsWith("cred_gmail_")) {
    return hasRealSecret(secrets, ["refreshToken", "accessToken", "refresh_token", "access_token"])
      || Boolean(meta.senderEmail);
  }
  if (
    provider.includes("calendar")
    || provider.includes("google_calendar")
    || id.includes("gcal")
    || (id.includes("calendar") && !id.includes("voice"))
    || id.startsWith("cred_gcal_")
  ) {
    return hasRealSecret(secrets, ["refreshToken", "accessToken", "refresh_token", "access_token"])
      || Boolean(meta.senderEmail);
  }
  if (provider.includes("twilio_sms") || id.includes("twilio_sms") || (provider === "sms" || provider.includes("sms") && !provider.includes("voice"))) {
    return hasRealSecret(secrets, ["accountSid", "authToken", "fromNumber"])
      || Boolean(meta.fromNumber);
  }
  if (provider.includes("twilio_voice") || id.includes("twilio_voice") || (provider.includes("voice") && !provider.includes("sms"))) {
    return hasRealSecret(secrets, ["accountSid", "authToken", "fromNumber"])
      || Boolean(meta.fromNumber);
  }
  if (provider.includes("meta_lead") || provider === "meta_lead_ads" || id.startsWith("cred_meta_")) {
    // Request-setup stubs must NOT count as Connected.
    return hasRealSecret(secrets, ["pageAccessToken", "accessToken"])
      && (hasRealSecret(secrets, ["pageId"]) || Boolean(meta.pageId));
  }
  if (provider.includes("hubspot") || id.includes("hubspot")) {
    return hasRealSecret(secrets, ["accessToken", "token", "apiKey"]);
  }
  if (provider.includes("highlevel") || id.includes("highlevel") || id.includes("gohighlevel")) {
    return hasRealSecret(secrets, ["accessToken", "apiKey", "token"])
      && (hasRealSecret(secrets, ["locationId"]) || Boolean(meta.locationId));
  }
  return false;
}

export function connectionIdFromCredentialRow(row = {}) {
  const provider = String(row?.providerType ?? "").toLowerCase();
  const id = String(row?.credentialId ?? "").toLowerCase();
  if (provider.includes("gmail") || id.includes("gmail") || id.startsWith("cred_gmail_")) return "business_email";
  if (
    provider.includes("calendar")
    || provider.includes("google_calendar")
    || id.includes("gcal")
    || id.startsWith("cred_gcal_")
  ) return "calendar";
  if (provider.includes("twilio_sms") || id.includes("twilio_sms") || (provider.includes("sms") && !provider.includes("voice"))) {
    return "sms_channel";
  }
  if (provider.includes("twilio_voice") || id.includes("twilio_voice") || (provider.includes("voice") && !provider.includes("sms"))) {
    return "voice_channel";
  }
  if (provider.includes("meta_lead") || provider === "meta_lead_ads" || id.startsWith("cred_meta_")) {
    return "meta_lead_ads";
  }
  if (provider.includes("hubspot") || id.includes("hubspot")) return "hubspot";
  if (provider.includes("highlevel") || id.includes("highlevel") || id.includes("gohighlevel")) {
    return "highlevel";
  }
  return null;
}

export function connectionStatusesFromCredentials(rows = []) {
  const statuses = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!credentialRowImpliesConnected(row)) continue;
    const connectionId = connectionIdFromCredentialRow(row);
    if (connectionId) statuses[connectionId] = "CONNECTED";
  }
  return statuses;
}

/**
 * Credentials + live CONNECTED always win — never demote a durable connect.
 */
export function mergeConnectionStatuses(baseStatuses = {}, credentialStatuses = {}) {
  const statuses = { ...baseStatuses };
  for (const [id, status] of Object.entries(credentialStatuses)) {
    if (isLiveConnectedStatus(status) || !isLiveConnectedStatus(statuses[id])) {
      statuses[id] = status;
    }
  }
  return statuses;
}

/**
 * Overlay CONNECTED from vault onto Connection Center rows (Integrations UI).
 */
export function applyCredentialStatusesToConnectionRows(connections = [], credentialStatuses = {}) {
  const list = Array.isArray(connections) ? connections : [];
  return list.map((row) => {
    const id = String(row?.id ?? row?.connectionType ?? "");
    const fromCreds = credentialStatuses[id];
    if (!isLiveConnectedStatus(fromCreds)) return row;
    const current = String(row?.status ?? "").toUpperCase();
    if (current === "CONNECTED" || current === "VERIFIED" || current === "PROVEN") return row;
    return { ...row, status: "CONNECTED" };
  });
}

export { isLiveConnectedStatus };
