import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function firstName(displayName) {
  return String(displayName ?? "there").trim().split(/\s+/)[0] || "there";
}

function subjectLine(template, subject) {
  if (subject?.displayName && String(template.id) === "property_announcement") {
    return `${subject.displayName}: property update`;
  }
  return String(template.defaultSubject ?? template.name ?? "Business update");
}

function bodyForTemplate({ template, recipient, subject }) {
  const name = firstName(recipient.displayName);
  const cta = String(template.cta ?? "Reply if you would like to talk through next steps.");
  const id = String(template.id ?? "");
  if (id === "cma_home_value") {
    return `Hi ${name},\n\nThe McBride team can prepare an informational CMA conversation if that would be useful. This is not a guaranteed appraisal or valuation; it is a starting point for a real conversation using approved context.\n\n${cta}`;
  }
  if (id === "referral_outreach") {
    return `Hi ${name},\n\nWe are checking in with past clients and referral relationships where there is real relationship history in the business record.\n\n${cta}`;
  }
  if (id === "property_announcement" && subject?.displayName) {
    return `Hi ${name},\n\nYou are receiving this draft because there is canonical interest linked to ${subject.displayName}.\n\n${cta}`;
  }
  return `Hi ${name},\n\nHere is a draft update prepared from canonical relationship and business evidence.\n\n${cta}`;
}

export function composeCampaignDraft({ template, audiencePreview, operation = null, nowISO } = {}) {
  const subject = audiencePreview?.subject ?? null;
  const recipients = (audiencePreview?.included ?? []).map((recipient) => ({
    partyId: String(recipient.partyId),
    displayName: String(recipient.displayName),
    email: String(recipient.email),
    subject: subjectLine(template, subject),
    body: bodyForTemplate({ template, recipient, subject }),
    personalizationEvidence: recipient.evidence,
    personalizationSummary: recipient.reasons,
  }));

  return deepFreeze({
    campaignTemplateId: String(template?.id ?? ""),
    campaignName: String(template?.name ?? "Campaign"),
    purpose: String(template?.purpose ?? ""),
    operationId: operation?.id ? String(operation.id) : null,
    operationName: operation?.name ? String(operation.name) : null,
    subject,
    channel: String(template?.channel ?? "email"),
    approvalRequired: template?.approvalRequired !== false,
    status: "draft",
    communicationStatus: "draft",
    generatedAt: String(nowISO ?? new Date().toISOString()),
    cta: String(template?.cta ?? ""),
    knowledgeSummary: "No approved knowledge documents were retrieved by this campaign draft composer. Draft content uses canonical relationship, property, consent, and audience evidence only.",
    evidenceSummary: subject
      ? `Audience is based on canonical interest in ${String(subject.displayName)}.`
      : "Audience is based on canonical relationship, property interest, and communication preference evidence.",
    recipientPreparations: deepFreeze(recipients),
    recipientCount: recipients.length,
    excludedCount: Number(audiencePreview?.excludedCount ?? 0),
    exclusions: deepFreeze(audiencePreview?.excluded ?? []),
    guardrails: deepFreeze(Array.isArray(template?.guardrails) ? template.guardrails.map(String) : []),
  });
}
