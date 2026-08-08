/**
 * When admin/AI/Support successfully connects credentials, flip owner UI to Connected.
 * - Marks white-glove ops_ready (clears Pending)
 * - Caller must already have set ConnectionRuntime to CONNECTED
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  isWhiteGloveConnection,
  normalizeConnectionId,
} from "../whiteglove/WhiteGloveConnectionRegistry.js";
import { markWhiteGloveReadyFromCredentials } from "../whiteglove/requestWhiteGloveSetup.js";
import { isConnectionLiveStatus } from "../whiteglove/whiteGloveOpsState.js";

/**
 * Map provider / credential id → canonical connection id.
 */
export function connectionIdFromProvider({
  providerType = null,
  credentialId = null,
  connectionType = null,
} = {}) {
  const fromType = normalizeConnectionId(connectionType);
  if (fromType) return fromType;

  const provider = String(providerType ?? "").toLowerCase();
  const id = String(credentialId ?? "").toLowerCase();

  if (provider.includes("twilio_voice") || (provider.includes("voice") && !provider.includes("sms"))) {
    return "voice_channel";
  }
  if (provider.includes("twilio_sms") || (provider.includes("sms") && !provider.includes("voice"))) {
    return "sms_channel";
  }
  if (provider.includes("meta_lead") || provider === "meta_lead_ads" || id.includes("cred_meta_")) {
    return "meta_lead_ads";
  }
  if (provider.includes("hubspot") || id.includes("hubspot")) return "hubspot";
  if (provider.includes("highlevel") || id.includes("highlevel") || id.includes("gohighlevel")) {
    return "highlevel";
  }
  if (provider.includes("gmail") || id.includes("gmail")) return "business_email";
  if (provider.includes("calendar") || id.includes("gcal")) return "calendar";
  return normalizeConnectionId(provider) ?? null;
}

/**
 * After a successful connect (runtime status CONNECTED): sync white-glove owner state.
 * Safe to call for self-serve channels (no-op when not white-glove).
 *
 * @returns {Promise<{ ok: boolean, connectionId: string|null, synced: boolean, reason?: string }>}
 */
export async function syncOwnerVisibleConnection({
  platformStore,
  businessId,
  connectionId = null,
  connectionStatus = null,
  providerType = null,
  credentialId = null,
  actorId = "credentials_connected",
} = {}) {
  const id = connectionIdFromProvider({
    connectionType: connectionId,
    providerType,
    credentialId,
  }) ?? (connectionId ? String(connectionId) : null);

  if (!id) {
    return deepFreeze({ ok: false, connectionId: null, synced: false, reason: "unknown_connection" });
  }

  if (!isConnectionLiveStatus(connectionStatus)) {
    return deepFreeze({
      ok: false,
      connectionId: id,
      synced: false,
      reason: "not_connected",
      connectionStatus: connectionStatus ?? null,
    });
  }

  if (!isWhiteGloveConnection(id)) {
    return deepFreeze({ ok: true, connectionId: id, synced: false, reason: "self_serve" });
  }

  if (!platformStore || !businessId) {
    return deepFreeze({ ok: false, connectionId: id, synced: false, reason: "missing_store" });
  }

  const result = await markWhiteGloveReadyFromCredentials({
    platformStore,
    businessId,
    connectionId: id,
    actorId,
  }).catch((err) => ({
    ok: false,
    reason: err instanceof Error ? err.message : String(err),
  }));

  return deepFreeze({
    ok: result?.ok !== false,
    connectionId: id,
    synced: result?.ok !== false,
    reason: result?.reason ?? null,
    opsRequest: result?.opsRequest ?? null,
  });
}
