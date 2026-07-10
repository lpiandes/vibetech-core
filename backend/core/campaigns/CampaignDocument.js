import crypto from "node:crypto";

import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const CAMPAIGN_DOCUMENT_STATUSES = Object.freeze([
  "draft",
  "pending_review",
  "approved",
  "superseded",
]);

function asString(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function stableStringify(value) {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function hashCampaignPayload(payload) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function createCampaignSection({
  id,
  type,
  order,
  fields = {},
} = {}) {
  const safeFields = fields && typeof fields === "object" && !Array.isArray(fields) ? fields : {};
  return deepFreeze({
    id: asString(id),
    type: asString(type),
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    fields: deepFreeze({
      heading: safeFields.heading == null ? null : asString(safeFields.heading),
      body: safeFields.body == null ? null : asString(safeFields.body),
      ctaText: safeFields.ctaText == null ? null : asString(safeFields.ctaText),
      ctaUrl: safeFields.ctaUrl == null ? null : asString(safeFields.ctaUrl),
      subjectId: safeFields.subjectId == null ? null : asString(safeFields.subjectId),
      knowledgeRefIds: Array.isArray(safeFields.knowledgeRefIds)
        ? deepFreeze(safeFields.knowledgeRefIds.map(String))
        : deepFreeze([]),
    }),
  });
}

export function sortCampaignSections(sections = []) {
  return [...(Array.isArray(sections) ? sections : [])]
    .map((section, index) => createCampaignSection({
      ...section,
      order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index,
    }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function computeContentHash({
  subjectLine,
  previewText = null,
  channel = "email",
  sections = [],
} = {}) {
  const ordered = sortCampaignSections(sections).map((section) => ({
    id: section.id,
    type: section.type,
    order: section.order,
    fields: section.fields,
  }));
  return hashCampaignPayload({
    subjectLine: asString(subjectLine),
    previewText: previewText == null ? null : asString(previewText),
    channel: asString(channel, "email"),
    sections: ordered,
  });
}

export function computeAudienceFingerprint({
  includedPartyIds = [],
  excludedPartyIds = [],
  subjectId = null,
  audienceType = null,
} = {}) {
  return hashCampaignPayload({
    includedPartyIds: [...includedPartyIds].map(String).sort(),
    excludedPartyIds: [...excludedPartyIds].map(String).sort(),
    subjectId: subjectId == null ? null : asString(subjectId),
    audienceType: audienceType == null ? null : asString(audienceType),
  });
}

export function createCampaignDocument({
  documentId,
  contentVersion = 1,
  contentHash = null,
  subjectLine = "",
  previewText = null,
  channel = "email",
  sections = [],
  campaignTemplateId = null,
  businessTemplateId = null,
  status = "draft",
  audienceFingerprint = null,
  generatedAt = null,
  updatedAt = null,
} = {}) {
  const ordered = sortCampaignSections(sections);
  const hash = contentHash || computeContentHash({
    subjectLine,
    previewText,
    channel,
    sections: ordered,
  });
  const safeStatus = CAMPAIGN_DOCUMENT_STATUSES.includes(String(status)) ? String(status) : "draft";
  return deepFreeze({
    documentId: asString(documentId),
    contentVersion: Math.max(1, Number(contentVersion) || 1),
    contentHash: asString(hash),
    subjectLine: asString(subjectLine),
    previewText: previewText == null ? null : asString(previewText),
    channel: asString(channel, "email"),
    sections: deepFreeze(ordered),
    campaignTemplateId: campaignTemplateId == null ? null : asString(campaignTemplateId),
    businessTemplateId: businessTemplateId == null ? null : asString(businessTemplateId),
    status: safeStatus,
    audienceFingerprint: audienceFingerprint == null ? null : asString(audienceFingerprint),
    generatedAt: generatedAt == null ? null : asString(generatedAt),
    updatedAt: updatedAt == null ? null : asString(updatedAt),
  });
}

export function createApprovalBinding({
  workId,
  messageId,
  contentVersion,
  contentHash,
  audienceFingerprint,
  approvedAt = null,
  approvedBy = null,
} = {}) {
  return deepFreeze({
    workId: asString(workId),
    messageId: asString(messageId),
    contentVersion: Math.max(1, Number(contentVersion) || 1),
    contentHash: asString(contentHash),
    audienceFingerprint: asString(audienceFingerprint),
    approvedAt: approvedAt == null ? null : asString(approvedAt),
    approvedBy: approvedBy == null ? null : asString(approvedBy),
  });
}

export function approvalBindingsMatch(expected, provided) {
  if (!expected || !provided) return false;
  return (
    asString(expected.workId) === asString(provided.workId) &&
    asString(expected.messageId) === asString(provided.messageId) &&
    Number(expected.contentVersion) === Number(provided.contentVersion) &&
    asString(expected.contentHash) === asString(provided.contentHash) &&
    asString(expected.audienceFingerprint) === asString(provided.audienceFingerprint)
  );
}

/**
 * Backward-compatible normalize: flat S1-prep metadata becomes a synthetic document.
 */
export function normalizeCampaignDocumentFromPreparation(campaign = {}, { nowISO = null } = {}) {
  if (campaign?.document?.documentId) {
    return createCampaignDocument(campaign.document);
  }

  const recipients = Array.isArray(campaign.recipientPreparations) ? campaign.recipientPreparations : [];
  const first = recipients[0] ?? {};
  const subjectLine = asString(first.subject || campaign.subjectLine || campaign.campaignName || "Campaign update");
  const body = asString(first.body || "");
  const cta = asString(campaign.cta || "");
  const sections = [
    createCampaignSection({
      id: "sec_legacy_intro",
      type: "intro",
      order: 0,
      fields: { heading: null, body: body || "Legacy campaign draft.", ctaText: null, ctaUrl: null },
    }),
  ];
  if (cta) {
    sections.push(createCampaignSection({
      id: "sec_legacy_cta",
      type: "call_to_action",
      order: 1,
      fields: { heading: null, body: null, ctaText: cta, ctaUrl: null },
    }));
  }

  return createCampaignDocument({
    documentId: asString(campaign.documentId || `doc_${campaign.workId || campaign.campaignTemplateId || "legacy"}`),
    contentVersion: Number(campaign.contentVersion) || 1,
    subjectLine,
    previewText: campaign.previewText ?? null,
    channel: campaign.channel || "email",
    sections,
    campaignTemplateId: campaign.campaignTemplateId ?? null,
    businessTemplateId: campaign.businessTemplateId ?? null,
    status: campaign.approvalStatus === "approved" ? "approved" : "draft",
    audienceFingerprint: campaign.audienceFingerprint ?? null,
    generatedAt: campaign.generatedAt ?? nowISO,
    updatedAt: campaign.updatedAt ?? campaign.generatedAt ?? nowISO,
  });
}

export function messageIdForContentVersion(baseMessageId, contentVersion) {
  const base = asString(baseMessageId);
  const version = Math.max(1, Number(contentVersion) || 1);
  if (version <= 1) return base;
  return `${base}_v${version}`;
}

export function baseMessageIdFromVersioned(messageId) {
  const id = asString(messageId);
  const match = id.match(/^(.*)_v\d+$/);
  return match ? match[1] : id;
}
