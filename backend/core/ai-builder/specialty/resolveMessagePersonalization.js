/**
 * Owner-friendly message personalization.
 * Stored as [Name], [Phone], [Email] — never {{contact.name}}.
 */

export const MESSAGE_PERSONALIZATION_CHIPS = Object.freeze([
  { id: "name", label: "Name", token: "[Name]" },
  { id: "phone", label: "Phone", token: "[Phone]" },
  { id: "email", label: "Email", token: "[Email]" },
  {
    id: "lead_details",
    label: "Lead details",
    token: "[Lead details]",
    insert: [
      "A new lead has been received.",
      "Lead details",
      "Name: [Name]",
      "Phone: [Phone]",
      "Email: [Email]",
    ].join("\n"),
  },
]);

const TOKEN_ALIASES = Object.freeze({
  name: ["[Name]", "{{name}}", "{{contact.name}}", "{Name}", "%name%"],
  phone: ["[Phone]", "{{phone}}", "{{contact.phone}}", "{Phone}", "%phone%"],
  email: ["[Email]", "{{email}}", "{{contact.email}}", "{Email}", "%email%"],
  lead_details: ["[Lead details]", "[Lead Details]", "{{lead_details}}"],
});

function safe(value) {
  if (value == null) return "";
  return String(value).trim();
}

function humanizeFieldKey(key) {
  return String(key ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build a values map from a Meta/form event payload, contact, or work metadata.
 */
export function buildPersonalizationValues(source = {}) {
  const payload = source?.eventPayload ?? source?.personalization ?? source ?? {};
  const contact = payload.contact ?? source.contact ?? {};
  const fields = {
    ...(typeof payload.fields === "object" && payload.fields ? payload.fields : {}),
    ...(typeof source.fields === "object" && source.fields ? source.fields : {}),
  };
  const name = safe(payload.name ?? contact.name ?? source.name);
  const phone = safe(payload.phone ?? contact.phone ?? source.phone);
  const email = safe(payload.email ?? contact.email ?? source.email);

  const leadDetails = [
    "A new lead has been received.",
    "Lead details",
    name ? `Name: ${name}` : null,
    phone ? `Phone: ${phone}` : null,
    email ? `Email: ${email}` : null,
    ...Object.entries(fields)
      .filter(([key, value]) => {
        const k = String(key).toLowerCase();
        if (["full_name", "first_name", "last_name", "name", "email", "phone", "phone_number", "email_address"].includes(k)) {
          return false;
        }
        return safe(value);
      })
      .map(([key, value]) => `${humanizeFieldKey(key)}: ${safe(value)}`),
  ].filter(Boolean).join("\n");

  return {
    name: name || "—",
    phone: phone || "—",
    email: email || "—",
    lead_details: leadDetails,
    fields,
  };
}

/**
 * Replace personalization tokens in subject/body text.
 */
export function resolveMessagePersonalization(text, source = {}) {
  let out = String(text ?? "");
  if (!out) return "";
  const values = buildPersonalizationValues(source);

  for (const [key, aliases] of Object.entries(TOKEN_ALIASES)) {
    const value = values[key] ?? "";
    for (const token of aliases) {
      if (!token) continue;
      out = out.split(token).join(value);
    }
  }

  // Optional custom FB form fields: [Care For] from fields.care_for
  for (const [key, raw] of Object.entries(values.fields ?? {})) {
    const value = safe(raw);
    if (!value) continue;
    const label = humanizeFieldKey(key);
    out = out.split(`[${label}]`).join(value);
    out = out.split(`[${key}]`).join(value);
  }

  return out;
}

export function previewMessagePersonalization(text, sample = null) {
  return resolveMessagePersonalization(text, sample ?? {
    name: "John Doe",
    phone: "(555) 123-4567",
    email: "john@example.com",
    fields: { care_for: "Myself", care_needed_immediately: "Yes" },
  });
}
