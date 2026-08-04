import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { sortCampaignSections } from "./CampaignDocument.js";

function firstName(displayName) {
  return String(displayName ?? "there").trim().split(/\s+/)[0] || "there";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function renderSectionHtml(section, { recipient = null, subject = null } = {}) {
  const fields = section?.fields ?? {};
  const heading = fields.heading ? String(fields.heading).trim() : "";
  const body = fields.body ? String(fields.body).trim() : "";
  const ctaText = fields.ctaText ? String(fields.ctaText).trim() : "";
  const ctaUrl = fields.ctaUrl ? String(fields.ctaUrl).trim() : "";
  const type = String(section?.type ?? "");
  const parts = [];

  if (heading) {
    parts.push(`<h2 style="margin:0 0 8px;font-size:18px;line-height:1.3;color:#0f172a;">${escapeHtml(heading)}</h2>`);
  }

  if (type === "intro" && recipient?.displayName) {
    parts.push(`<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">Hi ${escapeHtml(firstName(recipient.displayName))},</p>`);
  }

  if (type === "property_feature" && !body && subject?.displayName) {
    parts.push(`<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">Property focus: ${escapeHtml(subject.displayName)}.</p>`);
  } else if (body) {
    const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const paragraph of paragraphs) {
      parts.push(`<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;white-space:pre-wrap;">${escapeHtml(paragraph)}</p>`);
    }
  }

  if (ctaText) {
    if (ctaUrl) {
      parts.push(
        `<p style="margin:16px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(ctaText)}</a></p>`,
      );
    } else {
      parts.push(`<p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#0f766e;font-weight:700;">${escapeHtml(ctaText)}</p>`);
    }
  }

  if (!parts.length) return "";
  return `<div style="margin:0 0 22px;">${parts.join("")}</div>`;
}

export function renderCampaignDocumentBody(document, { recipient = null, subject = null } = {}) {
  const sections = sortCampaignSections(document?.sections ?? []);
  const blocks = sections
    .map((section) => renderSection(section, { recipient, subject }))
    .filter(Boolean);
  return blocks.join("\n\n").trim();
}

/**
 * Branded HTML email from business appearance (name / logo / accent) — industry-agnostic.
 */
export function renderCampaignDocumentHtml(document, {
  recipient = null,
  subject = null,
  brand = null,
} = {}) {
  const businessName = String(brand?.businessName ?? brand?.name ?? "Your team").trim() || "Your team";
  const logoUrl = String(brand?.logoUrl ?? "").trim();
  const accent = String(brand?.accentColor ?? brand?.accent ?? "#0f766e").trim() || "#0f766e";
  const sections = sortCampaignSections(document?.sections ?? []);
  const sectionHtml = sections
    .map((section) => renderSectionHtml(section, { recipient, subject }))
    .filter(Boolean)
    .join("");
  const preview = String(document?.previewText ?? "").trim();

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(businessName)}" width="140" style="display:block;max-width:140px;height:auto;margin:0 0 16px;" />`
    : `<div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${escapeHtml(accent)};margin:0 0 16px;">${escapeHtml(businessName)}</div>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
      ${logoBlock}
      ${preview ? `<p style="margin:0 0 18px;font-size:13px;color:#64748b;">${escapeHtml(preview)}</p>` : ""}
      ${sectionHtml || `<p style="margin:0;font-size:15px;color:#334155;">${escapeHtml(renderCampaignDocumentBody(document, { recipient, subject }))}</p>`}
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
        Sent by ${escapeHtml(businessName)} · You can reply to this email.
      </div>
    </div>
  </div>
</body>
</html>`.trim();
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
  brand = null,
} = {}) {
  const subject = audiencePreview?.subject ?? document?.subject ?? null;
  const sharedSubject = renderCampaignSubjectLine(document, { subject });
  const recipients = (audiencePreview?.included ?? []).map((recipient) => {
    const body = renderCampaignDocumentBody(document, { recipient, subject });
    const htmlBody = renderCampaignDocumentHtml(document, { recipient, subject, brand });
    return {
      partyId: String(recipient.partyId),
      displayName: String(recipient.displayName ?? recipient.partyId),
      email: String(recipient.email ?? ""),
      subject: sharedSubject,
      body,
      htmlBody,
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
  brand = null,
} = {}) {
  const preparations = buildRecipientPreparations({ document, audiencePreview, brand });
  const match = preparations.find((entry) => String(entry.partyId) === String(partyId)) ?? null;
  const subject = audiencePreview?.subject ?? null;
  return deepFreeze({
    partyId: partyId ? String(partyId) : null,
    found: Boolean(match),
    subjectLine: match?.subject ?? renderCampaignSubjectLine(document, { subject }),
    previewText: document?.previewText ?? null,
    body: match?.body ?? renderCampaignDocumentBody(document, { subject }),
    htmlBody: match?.htmlBody ?? renderCampaignDocumentHtml(document, { subject, brand }),
    personalizationEvidence: match?.personalizationEvidence ?? null,
    personalizationSummary: match?.personalizationSummary ?? [],
  });
}
