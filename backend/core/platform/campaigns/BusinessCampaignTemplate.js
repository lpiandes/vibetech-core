import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createCampaignSection, sortCampaignSections } from "../../campaigns/CampaignDocument.js";

function asString(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export function mapBusinessCampaignTemplateRow(row) {
  if (!row) return null;
  const sectionsRaw = parseJson(row.sections, []);
  const sections = sortCampaignSections(
    (Array.isArray(sectionsRaw) ? sectionsRaw : []).map((section, index) => createCampaignSection({
      id: section?.id ?? `sec_${index + 1}`,
      type: section?.type ?? "custom_text",
      order: section?.order ?? index,
      fields: section?.fields ?? {},
    })),
  );
  const audience = parseJson(row.audience, {});
  const guardrails = parseJson(row.guardrails, []);
  return deepFreeze({
    id: asString(row.id),
    businessId: asString(row.business_id),
    name: asString(row.name),
    purpose: row.purpose == null ? null : asString(row.purpose),
    channel: asString(row.channel, "email"),
    audience: deepFreeze(audience && typeof audience === "object" ? audience : {}),
    subjectLine: asString(row.subject_line),
    previewText: row.preview_text == null ? null : asString(row.preview_text),
    cta: row.cta == null ? null : asString(row.cta),
    guardrails: deepFreeze(Array.isArray(guardrails) ? guardrails.map(String) : []),
    sections: deepFreeze(sections),
    sourceTemplateId: row.source_template_id == null ? null : asString(row.source_template_id),
    approvalRequired: row.approval_required !== false,
    status: asString(row.status, "active"),
    createdByUserId: row.created_by_user_id == null ? null : asString(row.created_by_user_id),
    updatedByUserId: row.updated_by_user_id == null ? null : asString(row.updated_by_user_id),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  });
}

export function toPublicBusinessCampaignTemplate(template) {
  if (!template) return null;
  return deepFreeze({
    id: template.id,
    businessId: template.businessId,
    name: template.name,
    purpose: template.purpose,
    channel: template.channel,
    audience: template.audience,
    subjectLine: template.subjectLine,
    previewText: template.previewText,
    cta: template.cta,
    guardrails: template.guardrails,
    sections: template.sections,
    sourceTemplateId: template.sourceTemplateId,
    approvalRequired: template.approvalRequired,
    origin: "business",
    updatedAt: template.updatedAt,
    createdAt: template.createdAt,
  });
}
