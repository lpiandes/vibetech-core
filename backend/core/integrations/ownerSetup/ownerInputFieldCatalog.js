/**
 * Canonical owner-input field catalog for white-glove Request setup.
 * Connection registries list field ids; UI renders from this map — no per-id hardcoding.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * @typedef {{
 *   id: string,
 *   payloadKey: string,
 *   label: string,
 *   hint?: string | null,
 *   placeholder?: string | null,
 *   input: "text" | "tel" | "email" | "url" | "textarea",
 *   required?: boolean,
 *   howTo?: string[],
 * }} OwnerInputField
 */

/** @type {Record<string, OwnerInputField>} */
const FIELDS = {
  cell: {
    id: "cell",
    payloadKey: "cell",
    label: "Your cell (optional)",
    hint: "Only if you want missed calls to ring you first",
    placeholder: "+1…",
    input: "tel",
    required: false,
    howTo: [],
  },
  forward: {
    id: "forward",
    payloadKey: "forwardNumber",
    label: "Forward / ring-first number",
    hint: "Where we should ring you before the AI or missed-call text",
    placeholder: "+1…",
    input: "tel",
    required: false,
    howTo: [],
  },
  pageName: {
    id: "pageName",
    payloadKey: "pageName",
    label: "Facebook Page name",
    hint: "Usually your business name on Facebook",
    placeholder: "Acme Dental",
    input: "text",
    required: false,
    howTo: [
      "Open Facebook and go to your business Page.",
      "Copy the exact Page name from the top of the Page.",
      "Paste it here (skip only if you don’t have a Page yet).",
    ],
  },
  pageUrl: {
    id: "pageUrl",
    payloadKey: "pageUrl",
    label: "Facebook Page URL (optional)",
    hint: "Helps us find the right Page faster",
    placeholder: "https://facebook.com/…",
    input: "url",
    required: false,
    howTo: [
      "On your Facebook Page, tap Share → Copy link.",
      "Paste the link here.",
    ],
  },
  brand: {
    id: "brand",
    payloadKey: "brand",
    label: "Legal business name",
    hint: "Exact name on your EIN / CP-575 letter — carriers require this",
    placeholder: "Abc Dentistry LLC",
    input: "text",
    required: true,
    howTo: [
      "Open your IRS EIN confirmation letter (CP-575) or tax return.",
      "Copy the legal name exactly (including LLC / Inc).",
      "Paste it here — nicknames or DBA alone will fail carrier review.",
    ],
  },
  ein: {
    id: "ein",
    payloadKey: "ein",
    label: "EIN",
    hint: "XX-XXXXXXX",
    placeholder: "12-3456789",
    input: "text",
    required: true,
    howTo: [
      "Find the EIN on your CP-575 letter or business tax docs.",
      "Enter it as XX-XXXXXXX.",
    ],
  },
  contactEmail: {
    id: "contactEmail",
    payloadKey: "contactEmail",
    label: "Contact email for carrier paperwork",
    hint: "We’ll use this on Trust Hub / brand registration",
    placeholder: "you@business.com",
    input: "email",
    required: true,
    howTo: [],
  },
  locationId: {
    id: "locationId",
    payloadKey: "locationId",
    label: "HighLevel Location ID",
    hint: "We need this to connect the correct sub-account",
    placeholder: "e.g. ab12Cd…",
    input: "text",
    required: true,
    howTo: [
      "Open HighLevel and switch into the correct location (sub-account).",
      "Click Settings (gear) → Company / Business Profile (or Agency → Sub-Accounts).",
      "Copy Location ID and paste it here.",
    ],
  },
  accessInvite: {
    id: "accessInvite",
    payloadKey: "accessInvite",
    label: "How we get access",
    hint: "Invite us, or name who manages the login",
    placeholder: "Invited support@vtechdevelopment.com — or: Jane owns the login",
    input: "textarea",
    required: true,
    howTo: [
      "Preferred: invite support@vtechdevelopment.com as an admin on this account.",
      "Or write who owns the login so we can schedule access.",
      "Do not paste API keys or passwords here — we’ll connect those securely.",
    ],
  },
  hubspotPortal: {
    id: "hubspotPortal",
    payloadKey: "hubspotPortal",
    label: "HubSpot portal / account name",
    hint: "So we open the right HubSpot account",
    placeholder: "Company HubSpot name or portal ID",
    input: "text",
    required: true,
    howTo: [
      "Open HubSpot → Settings → Account Defaults (or look at the URL hubspot.com/…).",
      "Copy the portal name or numeric portal ID.",
      "Paste it here.",
    ],
  },
  salesforceOrg: {
    id: "salesforceOrg",
    payloadKey: "salesforceOrg",
    label: "Salesforce org details",
    hint: "Org name, sandbox vs production, who has admin",
    placeholder: "Acme prod org — admin is…",
    input: "textarea",
    required: true,
    howTo: [
      "Note whether this is production or sandbox.",
      "Name who can grant Connected App / admin access.",
      "List the objects that matter (Contacts, Leads, Opportunities, custom).",
    ],
  },
  notes: {
    id: "notes",
    payloadKey: "notes",
    label: "Anything else we should know?",
    hint: "Hours, preferred area code, who manages the tool, etc.",
    placeholder: "Optional context for setup",
    input: "textarea",
    required: false,
    howTo: [],
  },
};

export function getOwnerInputField(fieldId) {
  const row = FIELDS[String(fieldId ?? "")];
  return row
    ? deepFreeze({
      ...row,
      howTo: Array.isArray(row.howTo) ? [...row.howTo] : [],
    })
    : null;
}

export function listOwnerInputFieldIds() {
  return deepFreeze(Object.keys(FIELDS));
}

/**
 * Resolve field defs for a list of catalog ids (skips unknown).
 */
export function resolveOwnerInputFields(fieldIds = []) {
  const out = [];
  for (const id of Array.isArray(fieldIds) ? fieldIds : []) {
    const field = getOwnerInputField(id);
    if (field) out.push(field);
  }
  return deepFreeze(out);
}

/**
 * Flatten owner form values into the API ownerInputs payload using payloadKey.
 */
export function buildOwnerInputsPayload(fieldIds = [], values = {}) {
  const payload = {};
  for (const field of resolveOwnerInputFields(fieldIds)) {
    const raw = values?.[field.id] ?? values?.[field.payloadKey];
    const trimmed = raw == null ? "" : String(raw).trim();
    payload[field.payloadKey] = trimmed || null;
  }
  return deepFreeze(payload);
}

/**
 * Validate required fields for a collectFromOwner list.
 */
export function validateOwnerInputs(fieldIds = [], values = {}) {
  const fields = resolveOwnerInputFields(fieldIds);
  const missing = [];
  for (const field of fields) {
    if (!field.required) continue;
    const raw = values?.[field.id] ?? values?.[field.payloadKey];
    if (!String(raw ?? "").trim()) missing.push(field.id);
  }
  return deepFreeze({
    ok: missing.length === 0,
    missing,
    fields,
  });
}

/**
 * Owner-facing steps only when they must do something (fields with howTo).
 */
export function ownerActionStepsForFields(fieldIds = []) {
  const steps = [];
  for (const field of resolveOwnerInputFields(fieldIds)) {
    const howTo = field.howTo ?? [];
    if (!howTo.length) continue;
    steps.push({
      fieldId: field.id,
      label: field.label,
      required: field.required === true,
      howTo: [...howTo],
    });
  }
  return deepFreeze(steps);
}
