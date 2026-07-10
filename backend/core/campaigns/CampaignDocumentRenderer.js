import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { sortCampaignSections } from "./CampaignDocument.js";

function firstName(displayName) {
  return String(displayName ?? "there").trim().split(/\s+/)[0] || "there";
}

function renderSection(section, { recipient = null, subject = null } = {}) {
  const fields = section?.fields ?? {};
  const heading = fields.heading ? String(fields.heading).trim() : "";
  const body = fields.body ? String(fields.body).trim() : "";
  const ctaText = fields.ctaText ? String(fields.ctaText).trim() : "";
  const ctaUrl = fields.ctaUrl ? String(fields.ctaUrl).trim() : "";
  const type = String(section?.type ?? "");
  const lines = [];

  if (heading) lines.push(heading);

  if (type === "intro" && recipient?.displayName) {
    const greeting = `Hi ${firstName(recipient.displayName)},`;
    if (body) {
      lines.push(greeting, "", body);
    } else {
      lines.push(greeting);
    }
  } else if (type === "property_feature") {
    const propertyName = subject?.displayName ? String(subject.displayName) : null;
    if (body) lines.push(body);
    else if (propertyName) lines.push(`Property focus: ${propertyName}.`);
  } else if (body) {
    lines.push(body);
  }

  if (ctaText) {
    lines.push(lines.length ? "" : null, ctaText);
    if (ctaUrl) lines.push(ctaUrl);
  }

  return lines.filter((line) => line != null).join("\n").trim();
}

export function renderCampaignDocumentBody(document, { recipient = null, subject = null } = {}) {
  const sections = sortCampaignSections(document?.sections ?? []);
  const blocks = sections
    .map((section) => renderSection(section, { recipient, subject }))
    .filter(Boolean);
  return blocks.join("\n\n").trim();
}

export function renderCampaignSubjectLine(document, { subject = null } = {}) {
  const subjectLine = String(document?.subjectLine ?? "").trim();
  if (subjectLine) return subjectLine;
  if (subject?.displayName) return `${subject.displayName}: property update`;
  return "Business update";
}

export function buildRecipientPreparations({
  document,
  audiencePreview,
} = {}) {
  const subject = audiencePreview?.subject ?? document?.subject ?? null;
  const sharedSubject = renderCampaignSubjectLine(document, { subject });
  const recipients = (audiencePreview?.included ?? []).map((recipient) => {
    const body = renderCampaignDocumentBody(document, { recipient, subject });
    return {
      partyId: String(recipient.partyId),
      displayName: String(recipient.displayName ?? recipient.partyId),
      email: String(recipient.email ?? ""),
      subject: sharedSubject,
      body,
      personalizationEvidence: recipient.evidence ?? null,
      personalizationSummary: recipient.reasons ?? [],
    };
  });
  return deepFreeze(recipients);
}

export function previewCampaignForRecipient({
  document,
  audiencePreview,
  partyId,
} = {}) {
  const preparations = buildRecipientPreparations({ document, audiencePreview });
  const match = preparations.find((entry) => String(entry.partyId) === String(partyId)) ?? null;
  const subject = audiencePreview?.subject ?? null;
  return deepFreeze({
    partyId: partyId ? String(partyId) : null,
    found: Boolean(match),
    subjectLine: match?.subject ?? renderCampaignSubjectLine(document, { subject }),
    previewText: document?.previewText ?? null,
    body: match?.body ?? renderCampaignDocumentBody(document, { subject }),
    personalizationEvidence: match?.personalizationEvidence ?? null,
    personalizationSummary: match?.personalizationSummary ?? [],
  });
}
