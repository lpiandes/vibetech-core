/**
 * HubSpot / HighLevel ongoing sync — push local People → CRM and pull recent contacts in.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CRM_PROVIDERS } from "./CrmPrivateAppConnect.js";

export async function syncContactsToExternal({
  provider,
  accessToken,
  locationId = null,
  contacts = [],
  fetchImpl = fetch,
  limit = 25,
} = {}) {
  const meta = CRM_PROVIDERS[String(provider ?? "").toLowerCase()];
  if (!meta) return deepFreeze({ ok: false, reason: "unknown_provider" });
  const token = String(accessToken ?? "").trim();
  if (!token) return deepFreeze({ ok: false, reason: "missing_token" });

  const rows = (Array.isArray(contacts) ? contacts : []).slice(0, Math.max(1, limit));
  const results = [];
  for (const contact of rows) {
    const email = String(contact?.email ?? "").trim();
    if (!email) {
      results.push({ contactId: contact?.id ?? null, ok: false, reason: "missing_email" });
      continue;
    }
    if (meta.connectionType === "hubspot") {
      const res = await fetchImpl("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: {
            email,
            firstname: String(contact?.name ?? "Lead").split(/\s+/)[0] || "Lead",
            lastname: String(contact?.name ?? "").split(/\s+/).slice(1).join(" ") || "Sync",
            phone: String(contact?.phone ?? ""),
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      // HubSpot may 409 on duplicate — treat conflict id as success when present.
      const id = body?.id ? String(body.id) : (body?.message?.match(/Existing ID:\s*(\d+)/i)?.[1] ?? null);
      results.push({
        contactId: contact.id ?? null,
        ok: Boolean(res.ok || id),
        externalReference: id,
        status: res.status,
      });
      continue;
    }
    const loc = String(locationId ?? "").trim();
    if (!loc) {
      results.push({ contactId: contact?.id ?? null, ok: false, reason: "missing_location" });
      continue;
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
        firstName: String(contact?.name ?? "Lead").split(/\s+/)[0] || "Lead",
        lastName: String(contact?.name ?? "").split(/\s+/).slice(1).join(" ") || "Sync",
        email,
        phone: String(contact?.phone ?? ""),
        tags: ["vibetech-sync"],
      }),
    });
    const body = await res.json().catch(() => ({}));
    const id = body?.contact?.id ? String(body.contact.id) : (body?.id ? String(body.id) : null);
    results.push({
      contactId: contact.id ?? null,
      ok: Boolean(res.ok && id),
      externalReference: id,
      status: res.status,
    });
  }
  const pushed = results.filter((r) => r.ok).length;
  return deepFreeze({
    ok: pushed > 0,
    provider: meta.connectionType,
    attempted: rows.length,
    pushed,
    results,
  });
}

export async function syncContactsFromExternal({
  provider,
  accessToken,
  locationId = null,
  fetchImpl = fetch,
  limit = 25,
} = {}) {
  const meta = CRM_PROVIDERS[String(provider ?? "").toLowerCase()];
  if (!meta) return deepFreeze({ ok: false, reason: "unknown_provider", contacts: [] });
  const token = String(accessToken ?? "").trim();
  if (!token) return deepFreeze({ ok: false, reason: "missing_token", contacts: [] });

  if (meta.connectionType === "hubspot") {
    const res = await fetchImpl(
      `https://api.hubapi.com/crm/v3/objects/contacts?limit=${Math.min(100, Math.max(1, limit))}&properties=email,firstname,lastname,phone`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return deepFreeze({ ok: false, reason: "pull_failed", message: `HubSpot pull failed (${res.status})`, contacts: [] });
    }
    const contacts = (body?.results ?? []).map((row) => ({
      id: `hubspot_${row.id}`,
      externalReference: String(row.id),
      name: [row.properties?.firstname, row.properties?.lastname].filter(Boolean).join(" ") || row.properties?.email || "HubSpot contact",
      email: row.properties?.email ?? "",
      phone: row.properties?.phone ?? "",
      source: "hubspot_sync",
    }));
    return deepFreeze({ ok: true, provider: "hubspot", contacts, pulled: contacts.length });
  }

  const loc = String(locationId ?? "").trim();
  if (!loc) return deepFreeze({ ok: false, reason: "missing_location", contacts: [] });
  const res = await fetchImpl(
    `https://services.leadconnectorhq.com/contacts/?locationId=${encodeURIComponent(loc)}&limit=${Math.min(100, Math.max(1, limit))}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
      },
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return deepFreeze({ ok: false, reason: "pull_failed", message: `HighLevel pull failed (${res.status})`, contacts: [] });
  }
  const rows = body?.contacts ?? body?.data ?? [];
  const contacts = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: `highlevel_${row.id}`,
    externalReference: String(row.id),
    name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "HighLevel contact",
    email: row.email ?? "",
    phone: row.phone ?? "",
    source: "highlevel_sync",
  }));
  return deepFreeze({ ok: true, provider: "highlevel", contacts, pulled: contacts.length });
}
