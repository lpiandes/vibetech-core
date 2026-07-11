import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Universal field types — one registry for every business.
 * Industry packages specialize labels/options; they do not invent parallel type systems.
 */
export const UNIVERSAL_FIELD_TYPES = deepFreeze({
  text: { fieldType: "text", label: "Text", valueType: "string", searchable: true },
  long_text: { fieldType: "long_text", label: "Long Text", valueType: "string", searchable: true },
  rich_text: { fieldType: "rich_text", label: "Rich Text", valueType: "string", searchable: true },
  number: { fieldType: "number", label: "Number", valueType: "number", searchable: true },
  currency: { fieldType: "currency", label: "Currency", valueType: "number", searchable: true },
  percent: { fieldType: "percent", label: "Percent", valueType: "number", searchable: true },
  boolean: { fieldType: "boolean", label: "Boolean", valueType: "boolean", searchable: true },
  email: { fieldType: "email", label: "Email", valueType: "string", searchable: true },
  phone: { fieldType: "phone", label: "Phone", valueType: "string", searchable: true },
  url: { fieldType: "url", label: "URL", valueType: "string", searchable: true },
  date: { fieldType: "date", label: "Date", valueType: "string", searchable: true },
  time: { fieldType: "time", label: "Time", valueType: "string", searchable: false },
  datetime: { fieldType: "datetime", label: "DateTime", valueType: "string", searchable: true },
  address: { fieldType: "address", label: "Address", valueType: "string", searchable: true },
  location: { fieldType: "location", label: "Location", valueType: "json", searchable: true },
  single_select: { fieldType: "single_select", label: "Single Select", valueType: "enum", searchable: true },
  multi_select: { fieldType: "multi_select", label: "Multi Select", valueType: "array", searchable: true },
  relationship: { fieldType: "relationship", label: "Relationship", valueType: "subjectRef", searchable: true },
  person: { fieldType: "person", label: "Person", valueType: "partyRef", searchable: true },
  organization: { fieldType: "organization", label: "Organization", valueType: "partyRef", searchable: true },
  ai_generated: { fieldType: "ai_generated", label: "AI Generated", valueType: "string", searchable: true },
  formula: { fieldType: "formula", label: "Formula", valueType: "computed", searchable: false },
  computed: { fieldType: "computed", label: "Computed", valueType: "computed", searchable: false },
  attachment: { fieldType: "attachment", label: "Attachment", valueType: "file", searchable: false },
  image: { fieldType: "image", label: "Image", valueType: "file", searchable: false },
  signature: { fieldType: "signature", label: "Signature", valueType: "file", searchable: false },
  color: { fieldType: "color", label: "Color", valueType: "string", searchable: false },
  tags: { fieldType: "tags", label: "Tags", valueType: "array", searchable: true },
  json: { fieldType: "json", label: "JSON", valueType: "json", searchable: false },
  custom_metadata: { fieldType: "custom_metadata", label: "Custom Metadata", valueType: "json", searchable: false },
});

export const LIST_VIEW_TYPES = deepFreeze([
  "table",
  "cards",
  "board",
  "calendar",
  "timeline",
  "gallery",
  "map",
  "split",
]);

export const FORM_KINDS = deepFreeze([
  "create",
  "edit",
  "view",
  "wizard",
  "quick_create",
  "approval",
  "review",
  "bulk_edit",
  "mobile",
]);

export const RELATIONSHIP_CARDINALITIES = deepFreeze([
  "one_to_one",
  "one_to_many",
  "many_to_many",
]);

export const RELATIONSHIP_KINDS = deepFreeze([
  "parent",
  "child",
  "reference",
  "derived",
  "reverse_lookup",
]);

export const DETAIL_PAGE_SECTIONS = deepFreeze([
  "summary",
  "activity",
  "relationships",
  "attachments",
  "comments",
  "history",
  "approvals",
  "knowledge",
  "ai_recommendations",
  "related_work",
]);

export function getFieldType(fieldType) {
  return UNIVERSAL_FIELD_TYPES[String(fieldType)] ?? null;
}

export function listFieldTypeIds() {
  return Object.keys(UNIVERSAL_FIELD_TYPES);
}

export function isKnownFieldType(fieldType) {
  return Boolean(UNIVERSAL_FIELD_TYPES[String(fieldType)]);
}
