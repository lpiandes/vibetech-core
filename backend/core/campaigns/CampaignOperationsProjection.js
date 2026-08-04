import { buildCampaignAudiencePreview } from "./CampaignAudienceProjection.js";
import { recurringOperationStatus } from "./RecurringOperationService.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function humanStatus(value) {
  const key = String(value ?? "").replace(/_/g, " ");
  return key ? key[0].toUpperCase() + key.slice(1) : "Unknown";
}

function findMessage(communicationRuntime, messageId) {
  return communicationRuntime?.getMessage?.(String(messageId ?? "")) ?? null;
}

function subjectOptions(stack, businessId) {
  return safeArray(stack?.businessSubjectRuntime?.getSubjects?.())
    .filter((subject) => String(subject?.status ?? "active") === "active")
    .map((subject) => ({
      id: String(subject.id),
      displayName: String(subject.displayName ?? subject.id),
      subjectType: String(subject.subjectType ?? "subject"),
      href: `/b/${businessId}/properties/${encodeURIComponent(String(subject.id))}`,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function campaignWorkRows({ workRuntime, communicationRuntime, businessId }) {
  return safeArray(workRuntime?.getWorkItems?.())
    .filter((work) => work?.metadata?.campaignPreparation)
    .map((work) => {
      const campaign = work.metadata.campaignPreparation;
      const message = findMessage(communicationRuntime, campaign.messageId);
      const communicationStatus = String(message?.status ?? campaign.communicationStatus ?? "draft");
      return {
        workId: String(work.id),
        title: String(work.title),
        campaignTemplateId: String(campaign.campaignTemplateId ?? ""),
        campaignName: String(campaign.campaignName ?? work.title),
        purpose: String(campaign.purpose ?? work.description),
        operationId: campaign.operationId ?? null,
        operationName: campaign.operationName ?? null,
        occurrenceKey: campaign.occurrenceKey ?? null,
        subject: campaign.subject ?? null,
        audienceCount: Number(campaign.recipientCount ?? 0),
        excludedCount: Number(campaign.excludedCount ?? 0),
        approvalStatus: String(work.status) === "approved" ? "approved" : String(campaign.approvalStatus ?? "pending_review"),
        approvalStatusLabel: String(work.status) === "approved" ? "Approved" : humanStatus(campaign.approvalStatus ?? "pending_review"),
        communicationStatus,
        communicationStatusLabel:
          communicationStatus === "queued"
            ? "Queued, not sent"
            : communicationStatus === "sent"
              ? "Sent"
              : communicationStatus === "failed"
                ? "Failed"
                : "Draft",
        deliveryTruth:
          campaign.deliverySummary?.campaignDeliveryStatus === "sent"
            ? `Sent to ${campaign.deliverySummary.counts.sent} recipient(s) with provider evidence.`
            : campaign.deliverySummary?.campaignDeliveryStatus === "partially_sent"
              || campaign.deliverySummary?.campaignDeliveryStatus === "completed_with_failures"
              ? `Partial send: ${campaign.deliverySummary.counts.sent} sent, ${campaign.deliverySummary.counts.failed} failed, ${campaign.deliverySummary.counts.excluded} excluded.`
            : communicationStatus === "sent"
              ? "Provider/runtime evidence recorded a send."
              : communicationStatus === "queued"
                ? "Approved and queued, but not sent until an explicit send runs."
                : "Draft only. Nothing has been sent.",
        deliverySummary: campaign.deliverySummary ?? null,
        deliveryRecords: safeArray(campaign.deliveryRecords),
        contentVersion: campaign.contentVersion ?? campaign.document?.contentVersion ?? 1,
        knowledgeSummary: campaign.knowledgeSummary ?? null,
        knowledgeSources: safeArray(campaign.knowledgeSources),
        recipients: safeArray(campaign.recipientPreparations).map((recipient) => ({
          partyId: String(recipient.partyId),
          displayName: String(recipient.displayName),
          reasons: safeArray(recipient.personalizationSummary),
          evidence: recipient.personalizationEvidence ?? {},
        })),
        exclusions: safeArray(campaign.exclusions),
        guardrails: safeArray(campaign.guardrails),
        href: `/b/${businessId}/work?workId=${encodeURIComponent(String(work.id))}`,
      };
    })
    .sort((a, b) => String(b.occurrenceKey ?? "").localeCompare(String(a.occurrenceKey ?? "")));
}

export function buildCampaignOperationsView({
  businessId,
  stack,
  operationDefinitions,
  campaignTemplates,
  crmContacts = [],
  nowISO,
} = {}) {
  const operations = recurringOperationStatus({
    operationDefinitions,
    workRuntime: stack?.workRuntime,
    nowISO,
  }).map((operation) => ({
    ...operation,
    workHref: operation.workId ? `/b/${businessId}/work?workId=${encodeURIComponent(String(operation.workId))}` : null,
    primaryActionLabel: operation.workId ? "Review current preparation" : "Prepare current occurrence",
  }));

  const subjects = subjectOptions(stack, businessId);
  const templatePreviews = safeArray(campaignTemplates).map((template) => {
    const requiresSubject = String(template?.audience?.type ?? "") === "subject_interest";
    const audience = requiresSubject
      ? { includedCount: null, excludedCount: null, included: [], excluded: [] }
      : buildCampaignAudiencePreview({
          stack,
          audience: template.audience,
          channel: template.channel ?? "email",
          crmContacts,
        });
    const subjectAudiencePreviews = requiresSubject
      ? subjects.map((subject) => {
          const preview = buildCampaignAudiencePreview({
            stack,
            audience: template.audience,
            subjectId: subject.id,
            channel: template.channel ?? "email",
            crmContacts,
          });
          return {
            subject,
            audienceCount: preview.includedCount,
            excludedCount: preview.excludedCount,
            includedPreview: preview.included.slice(0, 5),
            exclusionsPreview: preview.excluded.slice(0, 5),
          };
        })
      : [];
    return {
      id: String(template.id),
      name: String(template.name),
      purpose: String(template.purpose ?? ""),
      channel: String(template.channel ?? "email"),
      approvalRequired: template.approvalRequired !== false,
      requiresSubject,
      audienceCount: audience.includedCount,
      excludedCount: audience.excludedCount,
      includedPreview: audience.included.slice(0, 5),
      exclusionsPreview: audience.excluded.slice(0, 5),
      subjectOptions: subjects,
      subjectAudiencePreviews,
      emptyAudienceExplanation: requiresSubject
        ? "Select a property to evaluate the audience."
        : "No eligible recipients currently match the template's relationship and communication rules.",
      guardrails: safeArray(template.guardrails),
    };
  });

  return {
    generatedAt: String(nowISO ?? new Date().toISOString()),
    operations,
    campaigns: campaignWorkRows({
      workRuntime: stack?.workRuntime,
      communicationRuntime: stack?.communicationRuntime,
      businessId,
    }),
    templates: templatePreviews,
  };
}
