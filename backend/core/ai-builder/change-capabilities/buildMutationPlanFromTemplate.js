import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Extract required fields from NL using declarative schema extract rules.
 */
export function extractInformationFromText({ text, schema, priorValues = {} } = {}) {
  const raw = String(text ?? "");
  const values = { ...priorValues };
  const missing = [];

  for (const field of schema?.fields ?? []) {
    if (values[field.id] != null && String(values[field.id]).trim() !== "") continue;
    let extracted = null;
    const rule = field.extractFromText;
    if (rule?.regex) {
      try {
        const match = raw.match(new RegExp(rule.regex, "i"));
        if (match?.[rule.group ?? 1]) extracted = String(match[rule.group ?? 1]).trim();
      } catch {
        extracted = null;
      }
    }
    if (!extracted && rule?.fallback != null) {
      extracted = typeof rule.fallback === "string" ? rule.fallback : null;
    }
    if (!extracted && Array.isArray(rule?.fromKeywords)) {
      // no-op placeholder for keyword-derived enums
    }
    if (extracted) values[field.id] = extracted.replace(/[.,]$/, "");
    else if (field.required) {
      missing.push({
        id: field.id,
        label: field.label,
        prompt: field.prompt,
      });
    }
  }

  return deepFreeze({ values, missing });
}

/**
 * Expand a declarative mutationPlanTemplate with extracted field values.
 */
export function buildMutationPlanFromTemplate({
  capability,
  values,
  text,
  businessId = null,
  createMutationPlan,
  createMutationOperation,
}) {
  if (typeof capability.buildMutationPlan === "function") {
    return capability.buildMutationPlan({
      capability,
      values,
      text,
      businessId,
      createMutationPlan,
      createMutationOperation,
    });
  }

  const operations = (capability.mutationPlanTemplate?.operations ?? []).map((templateOp) => {
    const payload = expandPayload(templateOp.payload ?? {}, values, text);
    return createMutationOperation({
      ...templateOp,
      payload,
      reason: expandString(templateOp.reason ?? capability.title, values, text),
      evidence: [
        ...(templateOp.evidence ?? []),
        `capability:${capability.capabilityId}`,
        `text:${String(text).slice(0, 120)}`,
      ],
      targetId: expandString(templateOp.targetId, values, text) || templateOp.targetId || null,
    });
  });

  const summary = expandString(
    capability.mutationPlanTemplate?.summaryTemplate ?? capability.title,
    values,
    text,
  );

  return createMutationPlan({
    capabilityId: capability.capabilityId,
    businessId,
    operations,
    summary,
  });
}

function expandPayload(payload, values, text) {
  const out = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (typeof value === "string") out[key] = expandString(value, values, text);
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = expandPayload(value, values, text);
    } else out[key] = value;
  }
  return out;
}

function expandString(template, values, text) {
  if (template == null) return template;
  return String(template)
    .replace(/\{\{text\}\}/g, String(text ?? ""))
    .replace(/\{\{(\w+)\}\}/g, (_, key) => (
      values[key] != null ? String(values[key]) : ""
    ));
}
