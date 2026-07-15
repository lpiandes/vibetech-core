import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export function isMetaLeadAdsConfigured() {
  return Boolean(
    safeString(process.env.META_APP_ID)
    && safeString(process.env.META_APP_SECRET)
    && safeString(process.env.META_LEAD_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN),
  );
}

/**
 * Meta Lead Ads adapter — ingest Facebook lead form submissions via webhook.
 */
export class MetaLeadAdsIntegrationAdapter extends IntegrationProvider {
  constructor({ fetchImpl = globalThis.fetch, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._fetch = fetchImpl;
    this._nowISO = String(nowISO);
  }

  get id() {
    return "meta_lead_ads";
  }

  get displayName() {
    return "Facebook Lead Ads";
  }

  get supportedConnectionTypes() {
    return ["meta_lead_ads"];
  }

  get supportedCapabilities() {
    return [
      INTEGRATION_CAPABILITIES.RECEIVE_WEBHOOK,
      INTEGRATION_CAPABILITIES.INGEST_FORM_SUBMISSION,
      INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD,
    ];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Facebook Lead Ads",
      summary: "Ingest Facebook lead form submissions into your intake queue.",
      estimatedTime: "20 minutes",
      prerequisites: ["Meta app", "Facebook Page", "Lead Ads form"],
      steps: ["Authorize Meta app", "Select Page", "Configure lead webhook", "Verify test lead"],
      permissionsRequested: ["leads_retrieval", "pages_manage_metadata"],
      verificationMethod: "Page access token resolve + webhook verify token.",
      commonProblems: ["Webhook verify token mismatch", "Missing Page access token"],
      reconnectInstructions: "Reconnect Meta and re-subscribe the Page webhook.",
      documentationReference: "https://developers.facebook.com/docs/marketing-api/guides/lead-ads",
    });
  }

  async healthCheck() {
    return { status: isMetaLeadAdsConfigured() ? "healthy" : "not_configured", providerId: this.id };
  }

  async verifyConnection({ connection, credentialResolver } = {}) {
    if (!connection?.credentialReference || !credentialResolver) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "missing_credentials",
        message: "Meta Lead Ads credentials are required.",
      });
    }
    try {
      const resolved = credentialResolver.resolve(connection.credentialReference);
      const pageAccessToken = safeString(resolved.pageAccessToken || resolved.accessToken);
      const pageId = safeString(resolved.pageId);
      if (!pageAccessToken || !pageId) {
        return deepFreeze({
          status: "failed",
          verifiedAt: this._nowISO,
          capabilitiesVerified: [],
          code: "not_configured",
          message: "Page ID and Page access token are required.",
        });
      }
      const res = await this._fetch(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`,
      );
      if (!res.ok) {
        return deepFreeze({
          status: "failed",
          verifiedAt: this._nowISO,
          capabilitiesVerified: [],
          code: "verification_failed",
          message: `Meta Page probe failed (${res.status}).`,
        });
      }
      return deepFreeze({
        status: "success",
        verifiedAt: this._nowISO,
        capabilitiesVerified: this.supportedCapabilities,
        code: "verified",
        message: "Facebook Lead Ads connection verified.",
      });
    } catch (err) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "verification_failed",
        message: String(err?.message ?? err),
      });
    }
  }

  /**
   * Normalize Meta leadgen webhook payloads into form submission records.
   */
  normalizeWebhook({ headers = {}, body = {}, credentialResolver = null, connection = null } = {}) {
    void headers;
    void credentialResolver;
    void connection;
    const entry = Array.isArray(body?.entry) ? body.entry[0] : null;
    const change = Array.isArray(entry?.changes) ? entry.changes[0] : null;
    const value = change?.value ?? {};
    return deepFreeze({
      kind: "meta_leadgen",
      leadgenId: safeString(value.leadgen_id),
      formId: safeString(value.form_id),
      pageId: safeString(value.page_id),
      createdTime: safeString(value.created_time),
      raw: deepFreeze(value),
    });
  }

  async executeAction({ actionRequest, connection, credentialResolver } = {}) {
    const capability = String(actionRequest?.capability ?? "");
    if (capability === INTEGRATION_CAPABILITIES.RECEIVE_WEBHOOK || capability === INTEGRATION_CAPABILITIES.INGEST_FORM_SUBMISSION) {
      const normalized = this.normalizeWebhook({
        body: actionRequest?.parameters?.webhookBody ?? actionRequest?.parameters ?? {},
        connection,
        credentialResolver,
      });
      return deepFreeze({
        externalReference: normalized.leadgenId || `meta_lead_${this._nowISO}`,
        status: "completed",
        completedAt: this._nowISO,
        metadata: normalized,
      });
    }

    if (capability === INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD) {
      // Fetch lead details from Graph API when leadgen_id is provided.
      try {
        const resolved = credentialResolver.resolve(connection.credentialReference);
        const token = safeString(resolved.pageAccessToken || resolved.accessToken);
        const leadgenId = safeString(actionRequest?.parameters?.leadgenId);
        if (!token || !leadgenId) {
          return deepFreeze({ status: "failed", error: "leadgenId_and_token_required", completedAt: this._nowISO });
        }
        const res = await this._fetch(
          `https://graph.facebook.com/v19.0/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return deepFreeze({
            status: "failed",
            error: safeString(data?.error?.message || `meta_http_${res.status}`),
            completedAt: this._nowISO,
          });
        }
        return deepFreeze({
          externalReference: leadgenId,
          status: "completed",
          completedAt: this._nowISO,
          metadata: deepFreeze({ lead: data }),
        });
      } catch (err) {
        return deepFreeze({
          status: "failed",
          error: String(err?.message ?? err),
          completedAt: this._nowISO,
        });
      }
    }

    return deepFreeze({ status: "failed", error: "unsupported_capability", completedAt: this._nowISO });
  }
}
