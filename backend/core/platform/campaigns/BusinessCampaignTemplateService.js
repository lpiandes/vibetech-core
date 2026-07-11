import crypto from "node:crypto";

import { platformStore } from "../persistence/platformStore.js";
import { toPublicBusinessCampaignTemplate } from "./BusinessCampaignTemplate.js";
import { createCampaignDocument, sortCampaignSections, createCampaignSection } from "../../campaigns/CampaignDocument.js";
import { isSupportedCampaignSectionType } from "../../../../industries/property-management/config/campaignSectionCatalog.js";

function normalizeSections(sections) {
  return sortCampaignSections((Array.isArray(sections) ? sections : []).map((section, index) => {
    const type = String(section?.type ?? "custom_text");
    if (!isSupportedCampaignSectionType(type)) {
      throw new Error(`Unsupported campaign section type: ${type}`);
    }
    return createCampaignSection({
      id: String(section?.id ?? `sec_${index + 1}`),
      type,
      order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index,
      fields: section?.fields ?? {},
    });
  }));
}

export class BusinessCampaignTemplateService {
  constructor({ store = platformStore } = {}) {
    this.store = store;
  }

  async listTemplates(businessId) {
    const rows = await this.store.listCampaignTemplatesForBusiness(businessId);
    return rows.map(toPublicBusinessCampaignTemplate);
  }

  async getTemplate(templateId, businessId) {
    const row = await this.store.getCampaignTemplateById(templateId, businessId);
    return toPublicBusinessCampaignTemplate(row);
  }

  async saveTemplate({
    businessId,
    templateId = null,
    name,
    purpose = null,
    channel = "email",
    audience = { type: "all_marketable_contacts" },
    subjectLine = "",
    previewText = null,
    cta = null,
    guardrails = [],
    sections = [],
    sourceTemplateId = null,
    approvalRequired = true,
    actorUserId = null,
  } = {}) {
    const normalizedSections = normalizeSections(sections);
    // Validate document shape via createCampaignDocument
    createCampaignDocument({
      documentId: `tmpl_${templateId || "new"}`,
      subjectLine,
      previewText,
      channel,
      sections: normalizedSections,
    });

    const id = templateId ? String(templateId) : `bct_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const saved = await this.store.upsertCampaignTemplate({
      id,
      businessId: String(businessId),
      name: String(name || "Saved campaign template").trim() || "Saved campaign template",
      purpose: purpose == null ? null : String(purpose),
      channel: String(channel || "email"),
      audience: audience && typeof audience === "object" ? audience : { type: "all_marketable_contacts" },
      subjectLine: String(subjectLine ?? ""),
      previewText: previewText == null ? null : String(previewText),
      cta: cta == null ? null : String(cta),
      guardrails: Array.isArray(guardrails) ? guardrails.map(String) : [],
      sections: normalizedSections,
      sourceTemplateId: sourceTemplateId == null ? null : String(sourceTemplateId),
      approvalRequired: approvalRequired !== false,
      createdByUserId: actorUserId ? String(actorUserId) : null,
      updatedByUserId: actorUserId ? String(actorUserId) : null,
    });

    if (actorUserId) {
      await this.store.recordAuditEvent({
        actorUserId: String(actorUserId),
        businessId: String(businessId),
        action: "campaign_template.saved",
        targetType: "business_campaign_template",
        targetId: id,
        metadata: { name: saved?.name ?? name },
      });
    }

    return toPublicBusinessCampaignTemplate(saved);
  }

  async deleteTemplate({ templateId, businessId, actorUserId = null } = {}) {
    const deleted = await this.store.softDeleteCampaignTemplate({
      templateId,
      businessId,
      deletedByUserId: actorUserId,
    });
    if (deleted && actorUserId) {
      await this.store.recordAuditEvent({
        actorUserId: String(actorUserId),
        businessId: String(businessId),
        action: "campaign_template.deleted",
        targetType: "business_campaign_template",
        targetId: String(templateId),
        metadata: {},
      });
    }
    return toPublicBusinessCampaignTemplate(deleted);
  }
}

export const businessCampaignTemplateService = new BusinessCampaignTemplateService();
