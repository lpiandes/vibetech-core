/**
 * Ingest a Meta/Facebook leadgen webhook into CRM + specialty automations.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  readCrmState,
  writeCrmState,
  upsertContact,
  upsertPipelineCard,
} from "../../crm/CrmStore.js";
import { MetaLeadAdsIntegrationAdapter } from "../adapters/MetaLeadAdsIntegrationAdapter.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

export function verifyMetaWebhookSignature({ rawBody, signatureHeader, appSecret } = {}) {
  const secret = safeString(appSecret || process.env.META_APP_SECRET);
  const header = safeString(signatureHeader);
  if (!secret || !header || !rawBody) return { ok: false, reason: "signature_missing" };
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "signature_mismatch" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "signature_error" };
  }
}

export function mapMetaLeadFields(lead = {}) {
  const fields = Array.isArray(lead.field_data) ? lead.field_data : [];
  const byName = {};
  for (const row of fields) {
    const key = safeString(row?.name).toLowerCase();
    const values = Array.isArray(row?.values) ? row.values.map(safeString).filter(Boolean) : [];
    if (key) byName[key] = values[0] || "";
  }
  const fullName = byName.full_name
    || [byName.first_name, byName.last_name].filter(Boolean).join(" ").trim()
    || byName.name
    || "";
  const email = byName.email || byName.work_email || byName.email_address || "";
  const phone = byName.phone_number || byName.phone || byName.mobile_number || "";
  return {
    name: fullName || email || phone || "Facebook lead",
    email,
    phone,
    fields: byName,
  };
}

/**
 * Subscribe the Page to leadgen webhooks via Graph API.
 */
export async function subscribeMetaPageToLeadgen({
  pageId,
  pageAccessToken,
  fetchImpl = globalThis.fetch,
} = {}) {
  const id = safeString(pageId);
  const token = safeString(pageAccessToken);
  if (!id || !token) {
    return deepFreeze({ ok: false, reason: "page_credentials_required" });
  }
  const res = await fetchImpl(
    `https://graph.facebook.com/v19.0/${encodeURIComponent(id)}/subscribed_apps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        subscribed_fields: "leadgen",
        access_token: token,
      }).toString(),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    return deepFreeze({
      ok: false,
      reason: "subscribe_failed",
      message: safeString(data?.error?.message) || `Meta subscribe failed (HTTP ${res.status})`,
      detail: data,
    });
  }
  return deepFreeze({ ok: true, pageId: id, detail: data });
}

/**
 * @param {object} params
 */
export async function ingestMetaLead({
  businessId,
  webhookBody = null,
  leadgenId = null,
  formId = null,
  pageId = null,
  platformStore,
  workspaceService = null,
  installation = null,
  adapter = null,
  connection = null,
  credentialResolver = null,
  actorId = "meta_webhook",
  prove = false,
  syntheticLead = null,
  nowISO = () => new Date().toISOString(),
} = {}) {
  if (!platformStore || !businessId) {
    return deepFreeze({ ok: false, reason: "business_and_store_required" });
  }

  const install = installation
    ?? await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  if (!install) {
    return deepFreeze({ ok: false, reason: "installation_required" });
  }

  const metaAdapter = adapter ?? new MetaLeadAdsIntegrationAdapter({
    nowISO: typeof nowISO === "function" ? nowISO() : nowISO,
  });

  let normalized = null;
  if (webhookBody) {
    normalized = metaAdapter.normalizeWebhook({ body: webhookBody });
  } else if (leadgenId || syntheticLead) {
    normalized = {
      kind: "meta_leadgen",
      leadgenId: safeString(leadgenId || syntheticLead?.leadgenId),
      formId: safeString(formId || syntheticLead?.formId),
      pageId: safeString(pageId || syntheticLead?.pageId),
      createdTime: safeString(syntheticLead?.createdTime),
      raw: syntheticLead ?? {},
    };
  } else {
    return deepFreeze({ ok: false, reason: "lead_payload_required" });
  }

  const id = safeString(normalized.leadgenId);
  if (!id) {
    return deepFreeze({ ok: false, reason: "leadgen_id_missing", normalized });
  }

  let leadDetails = syntheticLead ?? null;
  const platform = workspaceService?.connected?.integrationPlatform;
  const conn = connection
    ?? platform?.connectionRuntime?.getConnectionByType?.("meta_lead_ads")
    ?? null;
  const resolver = credentialResolver ?? platform?.credentialResolver ?? null;

  if (!leadDetails && conn && resolver && metaAdapter.executeAction) {
    const fetched = await metaAdapter.executeAction({
      actionRequest: {
        id: `meta_fetch_${id}`,
        capability: INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD,
        parameters: { leadgenId: id },
      },
      connection: conn,
      credentialResolver: resolver,
    });
    if (fetched?.status === "completed" && fetched?.metadata?.lead) {
      leadDetails = fetched.metadata.lead;
    } else if (!prove) {
      // Still create a stub contact from webhook ids if Graph fetch fails.
      leadDetails = {
        id,
        field_data: [],
        form_id: normalized.formId,
        page_id: normalized.pageId,
        fetchError: fetched?.error ?? "lead_fetch_failed",
      };
    } else {
      return deepFreeze({
        ok: false,
        reason: "lead_fetch_failed",
        message: fetched?.error ?? "Could not fetch lead from Meta.",
        normalized,
      });
    }
  }

  if (!leadDetails && prove && syntheticLead) {
    leadDetails = syntheticLead;
  }

  const mapped = mapMetaLeadFields(leadDetails || {});
  const contactId = `contact_meta_${id}`.slice(0, 64);

  let crm = readCrmState(install);
  const already = (crm.contacts ?? []).find((c) => String(c.id) === contactId || String(c.partyId) === contactId);
  if (already && !prove) {
    return deepFreeze({
      ok: true,
      deduped: true,
      contactId,
      cardId: (crm.pipelines ?? [])
        .flatMap((p) => p.cards ?? [])
        .find((card) => String(card.contactId) === contactId)?.id ?? null,
      leadgenId: id,
      formId: normalized.formId,
      pageId: normalized.pageId,
      contact: {
        name: already.name ?? mapped.name,
        email: already.email ?? mapped.email,
        phone: already.phone ?? mapped.phone,
      },
      automation: { ok: true, firedCount: 0, skipped: ["deduped"] },
      prove: false,
    });
  }

  crm = upsertContact(crm, {
    id: contactId,
    partyId: contactId,
    name: mapped.name,
    email: mapped.email,
    phone: mapped.phone,
    kind: "lead",
    tags: ["facebook", "meta_lead"],
    notes: [
      "Source: Facebook Lead Ads",
      normalized.formId ? `Form: ${normalized.formId}` : null,
      `Leadgen: ${id}`,
      mapped.email ? `Email: ${mapped.email}` : null,
      mapped.phone ? `Phone: ${mapped.phone}` : null,
    ].filter(Boolean).join("\n"),
  });

  // Drop into first pipeline as new intake card when available.
  const pipe = (crm.pipelines ?? [])[0] ?? null;
  let cardId = null;
  if (pipe?.stages?.[0]?.id) {
    const upserted = upsertPipelineCard(crm, {
      pipelineId: pipe.id,
      card: {
        id: `card_meta_${id}`.slice(0, 64),
        title: mapped.name,
        stageId: pipe.stages[0].id,
        contactId,
        value: 0,
      },
    });
    crm = upserted.crm;
    cardId = upserted.cardId;
  }

  await writeCrmState({
    platformStore,
    installation: install,
    crm,
    actorId,
  });

  let automation = null;
  if (workspaceService?.emitSpecialtyBusinessEvent) {
    try {
      automation = await workspaceService.emitSpecialtyBusinessEvent({
        eventType: "META_LEAD",
        brief: [
          "New Facebook lead received.",
          `Name: ${mapped.name}`,
          mapped.email ? `Email: ${mapped.email}` : null,
          mapped.phone ? `Phone: ${mapped.phone}` : null,
          "Run the intake automation path (add to pipeline / draft follow-up). Outbound stays approval-gated.",
        ].filter(Boolean).join("\n"),
        forceManual: false,
        actorId,
        eventPayload: {
          contactId,
          cardId,
          leadgenId: id,
          formId: normalized.formId,
          pageId: normalized.pageId,
          email: mapped.email,
          phone: mapped.phone,
          name: mapped.name,
          source: "meta_lead_ads",
          fields: mapped.fields ?? {},
          prove: prove === true,
        },
      });
    } catch (err) {
      automation = {
        ok: false,
        reason: err instanceof Error ? err.message : "automation_emit_failed",
      };
    }
  }

  return deepFreeze({
    ok: true,
    contactId,
    cardId,
    leadgenId: id,
    formId: normalized.formId,
    pageId: normalized.pageId,
    contact: {
      name: mapped.name,
      email: mapped.email,
      phone: mapped.phone,
    },
    automation,
    prove: prove === true,
  });
}
