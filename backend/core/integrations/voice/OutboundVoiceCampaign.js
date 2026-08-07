/**
 * Outbound voice campaigns — dial list only after outbound GRANT.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function readOutboundCampaigns(installation = null) {
  const rows = installation?.configuration?.outboundVoiceCampaigns;
  return Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
}

export function createOutboundCampaign({
  installation = null,
  name = "Outbound campaign",
  contacts = [],
  nowISO = new Date().toISOString(),
} = {}) {
  const list = (Array.isArray(contacts) ? contacts : [])
    .map((c) => ({
      contactId: c.contactId ?? c.id ?? null,
      name: String(c.name ?? "Lead"),
      phone: String(c.phone ?? "").trim(),
      status: "pending",
      callSid: null,
    }))
    .filter((c) => c.phone);
  if (!list.length) {
    return deepFreeze({ ok: false, reason: "no_phones", message: "Campaign needs contacts with phone numbers." });
  }
  const campaign = {
    id: `ovc_${Date.now().toString(36)}`,
    name: String(name || "Outbound campaign"),
    status: "draft",
    contacts: list,
    createdAt: nowISO,
    updatedAt: nowISO,
    dialed: 0,
    failed: 0,
  };
  const campaigns = [...readOutboundCampaigns(installation), campaign];
  return deepFreeze({
    ok: true,
    campaign,
    installation: {
      ...(installation ?? {}),
      configuration: {
        ...(installation?.configuration ?? {}),
        outboundVoiceCampaigns: plain(campaigns).slice(-50),
      },
    },
  });
}

/**
 * Dial next pending contact. Requires outboundApproved === true.
 * @param {{
 *   installation: any,
 *   campaignId: string,
 *   outboundApproved?: boolean,
 *   placeCall: (args: { to: string, contactId?: string|null, campaignId?: string }) =>
 *     Promise<{ ok?: boolean, externalReference?: string|null, message?: string|null, reason?: string|null }>,
 *   nowISO?: string,
 * }} input
 */
export async function dialNextOutboundCampaignContact({
  installation,
  campaignId,
  outboundApproved = false,
  placeCall,
  nowISO = new Date().toISOString(),
} = {}) {
  if (!outboundApproved) {
    return deepFreeze({
      ok: false,
      reason: "outbound_not_approved",
      message: "Outbound customer calls require owner GRANT before dial.",
    });
  }
  if (typeof placeCall !== "function") {
    return deepFreeze({ ok: false, reason: "place_call_missing" });
  }
  const campaigns = readOutboundCampaigns(installation);
  const idx = campaigns.findIndex((c) => c.id === campaignId);
  if (idx < 0) return deepFreeze({ ok: false, reason: "campaign_not_found" });
  const campaign = { ...campaigns[idx], contacts: campaigns[idx].contacts.map((c) => ({ ...c })) };
  const next = campaign.contacts.find((c) => c.status === "pending");
  if (!next) {
    campaign.status = "completed";
    campaign.updatedAt = nowISO;
    campaigns[idx] = campaign;
    return deepFreeze({
      ok: true,
      done: true,
      campaign,
      installation: patchCampaigns(installation, campaigns),
      message: "Campaign complete — no pending contacts.",
    });
  }
  const result = await placeCall({ to: next.phone, contactId: next.contactId, campaignId });
  if (result?.ok && result?.externalReference) {
    next.status = "dialed";
    next.callSid = result.externalReference;
    campaign.dialed = (campaign.dialed ?? 0) + 1;
    campaign.status = "running";
  } else {
    next.status = "failed";
    next.error = result?.message ?? result?.reason ?? "dial_failed";
    campaign.failed = (campaign.failed ?? 0) + 1;
  }
  campaign.updatedAt = nowISO;
  campaigns[idx] = campaign;
  return deepFreeze({
    ok: Boolean(result?.ok),
    campaign,
    contact: next,
    dialResult: result ?? null,
    installation: patchCampaigns(installation, campaigns),
  });
}

function patchCampaigns(installation, campaigns) {
  return {
    ...(installation ?? {}),
    configuration: {
      ...(installation?.configuration ?? {}),
      outboundVoiceCampaigns: plain(campaigns).slice(-50),
    },
  };
}
