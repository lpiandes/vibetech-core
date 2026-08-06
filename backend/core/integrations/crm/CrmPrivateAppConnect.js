/**
 * HubSpot / HighLevel private-app (API key) connect + prove helpers.
 * Connected ≠ Proven — prove must create a real CRM record id.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const CRM_PROVIDERS = Object.freeze({
  hubspot: Object.freeze({
    connectionType: "hubspot",
    providerType: "hubspot",
    evidenceKind: "hubspot_record_id",
    capabilityId: "crm_hubspot",
    label: "HubSpot",
  }),
  highlevel: Object.freeze({
    connectionType: "highlevel",
    providerType: "highlevel",
    evidenceKind: "highlevel_record_id",
    capabilityId: "crm_highlevel",
    label: "HighLevel",
  }),
});

/**
 * @param {{ provider: string, accessToken: string, locationId?: string|null }} input
 */
export async function verifyCrmPrivateApp({
  provider,
  accessToken,
  locationId = null,
  fetchImpl = fetch,
} = {}) {
  const meta = CRM_PROVIDERS[String(provider ?? "").toLowerCase()];
  if (!meta) {
    return deepFreeze({ ok: false, reason: "unknown_provider", message: "Unknown CRM provider." });
  }
  const token = String(accessToken ?? "").trim();
  if (!token) {
    return deepFreeze({ ok: false, reason: "missing_token", message: `${meta.label} access token is required.` });
  }

  if (meta.connectionType === "hubspot") {
    const res = await fetchImpl("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return deepFreeze({
        ok: false,
        reason: "verify_failed",
        message: `HubSpot rejected the token (${res.status}). Use a private app token with crm.objects.contacts read/write.`,
        detail: detail.slice(0, 400),
      });
    }
    return deepFreeze({ ok: true, provider: "hubspot", verified: true });
  }

  const loc = String(locationId ?? "").trim();
  if (!loc) {
    return deepFreeze({
      ok: false,
      reason: "missing_location",
      message: "HighLevel location ID is required with the API key.",
    });
  }
  const res = await fetchImpl(`https://services.leadconnectorhq.com/contacts/?locationId=${encodeURIComponent(loc)}&limit=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return deepFreeze({
      ok: false,
      reason: "verify_failed",
      message: `HighLevel rejected the credentials (${res.status}). Check API key and location ID.`,
      detail: detail.slice(0, 400),
    });
  }
  return deepFreeze({ ok: true, provider: "highlevel", verified: true, locationId: loc });
}

/**
 * Create a disposable prove contact and return provider record id.
 * @param {{ provider: string, accessToken: string, locationId?: string|null, email?: string|null }} input
 */
export async function createCrmProveContact({
  provider,
  accessToken,
  locationId = null,
  email = null,
  fetchImpl = fetch,
  nowISO = new Date().toISOString(),
} = {}) {
  const meta = CRM_PROVIDERS[String(provider ?? "").toLowerCase()];
  if (!meta) {
    return deepFreeze({ ok: false, reason: "unknown_provider", message: "Unknown CRM provider." });
  }
  const token = String(accessToken ?? "").trim();
  if (!token) {
    return deepFreeze({ ok: false, reason: "missing_token", message: "CRM access token missing — reconnect first." });
  }
  const proveEmail = String(email || `vibetech.prove.${Date.now()}@example.com`).trim();

  if (meta.connectionType === "hubspot") {
    const res = await fetchImpl("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          email: proveEmail,
          firstname: "VIBETech",
          lastname: "Prove",
          hs_lead_status: "NEW",
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    const id = body?.id ? String(body.id) : null;
    if (!res.ok || !id) {
      return deepFreeze({
        ok: false,
        reason: "prove_create_failed",
        message: "HubSpot prove contact was not created. Check contacts write scope.",
        detail: body,
      });
    }
    return deepFreeze({
      ok: true,
      simulated: false,
      provider: "hubspot",
      evidenceKind: meta.evidenceKind,
      externalReference: id,
      providerId: id,
      at: nowISO,
      message: "HubSpot prove contact created.",
    });
  }

  const loc = String(locationId ?? "").trim();
  if (!loc) {
    return deepFreeze({ ok: false, reason: "missing_location", message: "HighLevel location ID missing — reconnect." });
  }
  const res = await fetchImpl("https://services.leadconnectorhq.com/contacts/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locationId: loc,
      firstName: "VIBETech",
      lastName: "Prove",
      email: proveEmail,
      tags: ["vibetech-prove"],
    }),
  });
  const body = await res.json().catch(() => ({}));
  const id = body?.contact?.id ? String(body.contact.id) : (body?.id ? String(body.id) : null);
  if (!res.ok || !id) {
    return deepFreeze({
      ok: false,
      reason: "prove_create_failed",
      message: "HighLevel prove contact was not created. Check API permissions.",
      detail: body,
    });
  }
  return deepFreeze({
    ok: true,
    simulated: false,
    provider: "highlevel",
    evidenceKind: meta.evidenceKind,
    externalReference: id,
    providerId: id,
    at: nowISO,
    message: "HighLevel prove contact created.",
  });
}
