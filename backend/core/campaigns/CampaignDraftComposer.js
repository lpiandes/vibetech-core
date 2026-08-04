import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  computeAudienceFingerprint,
  createCampaignDocument,
  createCampaignSection,
} from "./CampaignDocument.js";
import { buildRecipientPreparations } from "./CampaignDocumentRenderer.js";
import {
  attachKnowledgeToCampaignDocument,
  campaignKnowledgeCategoryIdsForTemplate,
  selectCampaignKnowledgeDocuments,
} from "./CampaignKnowledgeAssembler.js";
import {
  buildPackageCampaignSectionRecipe,
  defaultSubjectLineForTemplate,
} from "../../../industries/property-management/config/campaignSectionCatalog.js";

export function composeCampaignDraft({
  template,
  audiencePreview,
  operation = null,
  businessTemplate = null,
  nowISO,
  documentId = null,
  contentVersion = 1,
  knowledgeDocuments = [],
  businessId = null,
  knowledgeExpectations = null,
} = {}) {
  const subject = audiencePreview?.subject ?? null;
  const sections = Array.isArray(businessTemplate?.sections) && businessTemplate.sections.length
    ? businessTemplate.sections
    : buildPackageCampaignSectionRecipe(template, { subject });
  const subjectLine = businessTemplate?.subjectLine
    ? String(businessTemplate.subjectLine)
    : defaultSubjectLineForTemplate(template, subject);
  const previewText = businessTemplate?.previewText != null
    ? String(businessTemplate.previewText)
    : null;
  const channel = String(businessTemplate?.channel ?? template?.channel ?? "email");
  const audienceFingerprint = computeAudienceFingerprint({
    includedPartyIds: (audiencePreview?.included ?? []).map((entry) => entry.partyId),
    excludedPartyIds: (audiencePreview?.excluded ?? []).map((entry) => entry.partyId),
    subjectId: subject?.id ?? null,
    audienceType: template?.audience?.type ?? businessTemplate?.audience?.type ?? null,
  });

  const categoryIds = campaignKnowledgeCategoryIdsForTemplate(
    template?.id ?? businessTemplate?.sourceTemplateId,
    knowledgeExpectations,
  );
  const knowledgeSources = selectCampaignKnowledgeDocuments({
    documents: knowledgeDocuments,
    businessId: businessId ?? knowledgeDocuments[0]?.businessId,
    allowedCategoryIds: categoryIds,
    subjectId: subject?.id ?? null,
    limit: 3,
  });

  let document = createCampaignDocument({
    documentId: documentId || `doc_${String(template?.id ?? businessTemplate?.id ?? "campaign")}_${String(nowISO ?? Date.now()).slice(0, 10)}`,
    contentVersion,
    subjectLine,
    previewText,
    channel,
    sections,
    campaignTemplateId: template?.id ? String(template.id) : (businessTemplate?.sourceTemplateId ?? null),
    businessTemplateId: businessTemplate?.id ? String(businessTemplate.id) : null,
    status: "draft",
    audienceFingerprint,
    generatedAt: String(nowISO ?? new Date().toISOString()),
    updatedAt: String(nowISO ?? new Date().toISOString()),
  });

  const attached = attachKnowledgeToCampaignDocument({
    document,
    knowledgeSources,
    knowledgeExpectations,
    campaignTemplateId: document.campaignTemplateId,
  });
  document = createCampaignDocument({
    ...document,
    sections: attached.sections.map((section) => createCampaignSection(section)),
  });

  const recipients = buildRecipientPreparations({ document, audiencePreview });
  const ctaSection = document.sections.find((section) => section.type === "call_to_action" || section.fields?.ctaText);
  const cta = ctaSection?.fields?.ctaText
    ? String(ctaSection.fields.ctaText)
    : String(template?.cta ?? businessTemplate?.cta ?? "");

  return deepFreeze({
    campaignTemplateId: String(template?.id ?? businessTemplate?.sourceTemplateId ?? ""),
    businessTemplateId: businessTemplate?.id ? String(businessTemplate.id) : null,
    campaignName: String(businessTemplate?.name ?? template?.name ?? "Campaign"),
    purpose: String(template?.purpose ?? businessTemplate?.purpose ?? ""),
    operationId: operation?.id ? String(operation.id) : null,
    operationName: operation?.name ? String(operation.name) : null,
    subject,
    channel: document.channel,
    approvalRequired: template?.approvalRequired !== false,
    status: "draft",
    communicationStatus: "draft",
    generatedAt: document.generatedAt,
    updatedAt: document.updatedAt,
    cta,
    previewText: document.previewText,
    subjectLine: document.subjectLine,
    document,
    contentVersion: document.contentVersion,
    contentHash: document.contentHash,
    audienceFingerprint: document.audienceFingerprint,
    knowledgeSummary: attached.knowledgeSummary,
    knowledgeSources: deepFreeze(attached.knowledgeSources),
    evidenceSummary: subject
      ? `Audience is based on canonical interest in ${String(subject.displayName)}.`
      : "People with email in your contacts.",
    recipientPreparations: recipients,
    recipientCount: recipients.length,
    excludedCount: Number(audiencePreview?.excludedCount ?? 0),
    exclusions: deepFreeze(audiencePreview?.excluded ?? []),
    guardrails: deepFreeze(Array.isArray(template?.guardrails) ? template.guardrails.map(String) : (Array.isArray(businessTemplate?.guardrails) ? businessTemplate.guardrails.map(String) : [])),
    approvalBinding: null,
    versionHistory: deepFreeze([]),
  });
}
