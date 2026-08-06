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

export function connectionStatusesFromCredentials(rows = []) {
  const statuses = {};
  for (const row of rows) {
    const provider = String(row?.providerType ?? "").toLowerCase();
    const id = String(row?.credentialId ?? "").toLowerCase();
    if (provider.includes("gmail") || id.includes("gmail") || id.startsWith("cred_gmail_")) {
      statuses.business_email = "CONNECTED";
    }
    if (
      provider.includes("calendar")
      || provider.includes("google_calendar")
      || id.includes("gcal")
      || id.includes("calendar")
      || id.startsWith("cred_gcal_")
    ) {
      statuses.calendar = "CONNECTED";
    }
    if (provider.includes("twilio_sms") || id.includes("twilio_sms") || (provider.includes("sms") && !provider.includes("voice"))) {
      statuses.sms_channel = "CONNECTED";
    }
    if (provider.includes("twilio_voice") || id.includes("voice") || provider.includes("voice")) {
      statuses.voice_channel = "CONNECTED";
    }
    if (provider.includes("meta") || id.includes("meta")) {
      statuses.meta_lead_ads = "CONNECTED";
    }
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

export { isLiveConnectedStatus };
