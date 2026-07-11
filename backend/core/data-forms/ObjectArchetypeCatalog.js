import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Reusable object archetypes — Architect specializes these; never invent one-off objects.
 */
function field(key, label, fieldType, extras = {}) {
  return {
    key,
    label,
    fieldType,
    required: Boolean(extras.required),
    unique: Boolean(extras.unique),
    identity: Boolean(extras.identity),
    searchable: extras.searchable !== false,
    readOnly: Boolean(extras.readOnly),
    defaultValue: extras.defaultValue ?? null,
    allowedValues: extras.allowedValues ?? null,
    validation: extras.validation ?? {},
    helpText: extras.helpText ?? "",
    roleEdit: extras.roleEdit ?? ["OWNER", "MANAGER", "EMPLOYEE"],
    roleView: extras.roleView ?? ["OWNER", "MANAGER", "EMPLOYEE", "VIEWER"],
    conditionalVisibility: extras.conditionalVisibility ?? null,
    conditionalRequired: extras.conditionalRequired ?? null,
    aiRecommendable: Boolean(extras.aiRecommendable),
  };
}

const COMMON_IDENTITY = [
  field("displayName", "Display name", "text", { required: true, identity: true }),
  field("status", "Status", "single_select", {
    allowedValues: ["active", "inactive", "archived"],
    defaultValue: "active",
  }),
  field("tags", "Tags", "tags"),
  field("notes", "Notes", "long_text", { searchable: true }),
];

export const OBJECT_ARCHETYPES = deepFreeze({
  customer: {
    archetypeId: "customer",
    label: "Customer",
    category: "party_subject",
    fields: [
      ...COMMON_IDENTITY,
      field("email", "Email", "email"),
      field("phone", "Phone", "phone"),
      field("address", "Address", "address"),
    ],
    defaultViews: ["table", "cards"],
    defaultForms: ["create", "edit", "view", "quick_create"],
  },
  vendor: {
    archetypeId: "vendor",
    label: "Vendor",
    category: "party_subject",
    fields: [
      ...COMMON_IDENTITY,
      field("email", "Email", "email"),
      field("phone", "Phone", "phone"),
      field("paymentTerms", "Payment terms", "text"),
    ],
    defaultViews: ["table"],
    defaultForms: ["create", "edit", "view"],
  },
  lead: {
    archetypeId: "lead",
    label: "Lead",
    category: "pipeline",
    fields: [
      ...COMMON_IDENTITY,
      field("email", "Email", "email"),
      field("phone", "Phone", "phone"),
      field("source", "Source", "single_select", {
        allowedValues: ["website", "referral", "campaign", "walk_in", "other"],
      }),
      field("intent", "Intent", "text", { aiRecommendable: true }),
    ],
    defaultViews: ["table", "board"],
    defaultForms: ["create", "edit", "view", "quick_create"],
  },
  opportunity: {
    archetypeId: "opportunity",
    label: "Opportunity",
    category: "pipeline",
    fields: [
      ...COMMON_IDENTITY,
      field("amount", "Amount", "currency"),
      field("stage", "Stage", "single_select", {
        allowedValues: ["qualify", "proposal", "negotiation", "won", "lost"],
        defaultValue: "qualify",
      }),
      field("closeDate", "Close date", "date"),
    ],
    defaultViews: ["table", "board", "pipeline"],
    defaultForms: ["create", "edit", "view"],
  },
  invoice: {
    archetypeId: "invoice",
    label: "Invoice",
    category: "finance",
    fields: [
      field("displayName", "Invoice number", "text", { required: true, identity: true, unique: true }),
      field("amount", "Amount", "currency", { required: true }),
      field("dueDate", "Due date", "date"),
      field("status", "Status", "single_select", {
        allowedValues: ["draft", "sent", "paid", "overdue", "void"],
        defaultValue: "draft",
      }),
      field("notes", "Notes", "long_text"),
    ],
    defaultViews: ["table"],
    defaultForms: ["create", "edit", "view", "approval"],
  },
  work_order: {
    archetypeId: "work_order",
    label: "Work Order",
    category: "operations",
    fields: [
      ...COMMON_IDENTITY,
      field("priority", "Priority", "single_select", {
        allowedValues: ["low", "normal", "high", "urgent"],
        defaultValue: "normal",
      }),
      field("scheduledAt", "Scheduled at", "datetime"),
      field("location", "Location", "address"),
    ],
    defaultViews: ["table", "board", "calendar"],
    defaultForms: ["create", "edit", "view", "mobile"],
  },
  appointment: {
    archetypeId: "appointment",
    label: "Appointment",
    category: "scheduling",
    fields: [
      ...COMMON_IDENTITY,
      field("startsAt", "Starts at", "datetime", { required: true }),
      field("endsAt", "Ends at", "datetime"),
      field("location", "Location", "address"),
    ],
    defaultViews: ["calendar", "table", "timeline"],
    defaultForms: ["create", "edit", "view", "quick_create"],
  },
  asset: {
    archetypeId: "asset",
    label: "Asset",
    category: "inventory",
    fields: [
      ...COMMON_IDENTITY,
      field("address", "Address", "address"),
      field("assetType", "Asset type", "single_select", {
        allowedValues: ["property", "unit", "equipment", "vehicle", "other"],
      }),
      field("location", "Location", "location"),
    ],
    defaultViews: ["table", "cards", "map", "gallery"],
    defaultForms: ["create", "edit", "view"],
  },
  contract: {
    archetypeId: "contract",
    label: "Contract",
    category: "legal",
    fields: [
      ...COMMON_IDENTITY,
      field("startsOn", "Starts on", "date"),
      field("endsOn", "Ends on", "date"),
      field("value", "Value", "currency"),
      field("attachment", "Document", "attachment"),
    ],
    defaultViews: ["table"],
    defaultForms: ["create", "edit", "view", "approval", "review"],
  },
  employee_record: {
    archetypeId: "employee_record",
    label: "Employee",
    category: "people",
    fields: [
      ...COMMON_IDENTITY,
      field("email", "Email", "email", { required: true }),
      field("phone", "Phone", "phone"),
      field("title", "Title", "text"),
      field("startDate", "Start date", "date"),
    ],
    defaultViews: ["table", "cards"],
    defaultForms: ["create", "edit", "view"],
  },
  case: {
    archetypeId: "case",
    label: "Case",
    category: "support",
    fields: [
      ...COMMON_IDENTITY,
      field("priority", "Priority", "single_select", {
        allowedValues: ["low", "normal", "high"],
        defaultValue: "normal",
      }),
      field("openedAt", "Opened at", "datetime", { defaultValue: null }),
      field("resolution", "Resolution", "long_text"),
    ],
    defaultViews: ["table", "board"],
    defaultForms: ["create", "edit", "view", "review"],
  },
  project: {
    archetypeId: "project",
    label: "Project",
    category: "delivery",
    fields: [
      ...COMMON_IDENTITY,
      field("startsOn", "Starts on", "date"),
      field("dueOn", "Due on", "date"),
      field("percentComplete", "Percent complete", "percent"),
    ],
    defaultViews: ["table", "board", "timeline"],
    defaultForms: ["create", "edit", "view"],
  },
  equipment: {
    archetypeId: "equipment",
    label: "Equipment",
    category: "inventory",
    fields: [
      ...COMMON_IDENTITY,
      field("serialNumber", "Serial number", "text", { unique: true }),
      field("condition", "Condition", "single_select", {
        allowedValues: ["new", "good", "fair", "needs_repair"],
      }),
    ],
    defaultViews: ["table", "gallery"],
    defaultForms: ["create", "edit", "view"],
  },
  document: {
    archetypeId: "document",
    label: "Document",
    category: "knowledge",
    fields: [
      ...COMMON_IDENTITY,
      field("attachment", "File", "attachment", { required: true }),
      field("documentType", "Document type", "single_select", {
        allowedValues: ["policy", "sop", "contract", "report", "other"],
      }),
    ],
    defaultViews: ["table", "gallery"],
    defaultForms: ["create", "edit", "view"],
  },
  policy: {
    archetypeId: "policy",
    label: "Policy",
    category: "compliance",
    fields: [
      ...COMMON_IDENTITY,
      field("effectiveOn", "Effective on", "date"),
      field("owner", "Owner", "person"),
      field("body", "Policy body", "rich_text"),
    ],
    defaultViews: ["table"],
    defaultForms: ["create", "edit", "view", "approval", "review"],
  },
  knowledge_article: {
    archetypeId: "knowledge_article",
    label: "Knowledge Article",
    category: "knowledge",
    fields: [
      ...COMMON_IDENTITY,
      field("body", "Body", "rich_text", { required: true }),
      field("category", "Category", "single_select", {
        allowedValues: ["howto", "policy", "faq", "training"],
      }),
    ],
    defaultViews: ["table", "cards"],
    defaultForms: ["create", "edit", "view"],
  },
  inspection: {
    archetypeId: "inspection",
    label: "Inspection",
    category: "operations",
    fields: [
      ...COMMON_IDENTITY,
      field("inspectedAt", "Inspected at", "datetime", { required: true }),
      field("result", "Result", "single_select", {
        allowedValues: ["pass", "fail", "needs_follow_up"],
      }),
      field("photos", "Photos", "image"),
      field("signature", "Signature", "signature"),
    ],
    defaultViews: ["table", "calendar", "gallery"],
    defaultForms: ["create", "edit", "view", "mobile", "review"],
  },
});

/**
 * Industry templates pick reusable archetypes and specialize labels — not vertical form engines.
 */
export const DATA_MODEL_TEMPLATES = deepFreeze({
  property_management: {
    objects: [
      { archetypeId: "asset", objectId: "property", label: "Property", specialize: { assetTypeDefault: "property" } },
      { archetypeId: "asset", objectId: "listing", label: "Listing", specialize: { assetTypeDefault: "property" } },
      { archetypeId: "customer", objectId: "resident", label: "Resident" },
      { archetypeId: "lead", objectId: "prospect", label: "Prospect" },
      { archetypeId: "work_order", objectId: "work_order", label: "Work Order" },
      { archetypeId: "inspection", objectId: "inspection", label: "Inspection" },
      { archetypeId: "contract", objectId: "lease", label: "Lease" },
      { archetypeId: "document", objectId: "document", label: "Document" },
      { archetypeId: "vendor", objectId: "vendor", label: "Vendor" },
    ],
    relationships: [
      { from: "listing", to: "property", cardinality: "many_to_one", kind: "reference", label: "Listing of property" },
      { from: "work_order", to: "property", cardinality: "many_to_one", kind: "reference", label: "Work on property" },
      { from: "inspection", to: "property", cardinality: "many_to_one", kind: "reference", label: "Inspection of property" },
      { from: "lease", to: "property", cardinality: "many_to_one", kind: "reference", label: "Lease for property" },
      { from: "lease", to: "resident", cardinality: "many_to_one", kind: "reference", label: "Lease resident" },
      { from: "prospect", to: "listing", cardinality: "many_to_one", kind: "reference", label: "Prospect interest" },
    ],
  },
  dental: {
    objects: [
      { archetypeId: "customer", objectId: "patient", label: "Patient" },
      { archetypeId: "appointment", objectId: "appointment", label: "Appointment" },
      { archetypeId: "case", objectId: "treatment_case", label: "Treatment case" },
      { archetypeId: "invoice", objectId: "invoice", label: "Invoice" },
      { archetypeId: "document", objectId: "clinical_note", label: "Clinical note" },
      { archetypeId: "policy", objectId: "policy", label: "Policy" },
      { archetypeId: "lead", objectId: "lead", label: "Lead" },
    ],
    relationships: [
      { from: "appointment", to: "patient", cardinality: "many_to_one", kind: "reference", label: "Patient appointment" },
      { from: "treatment_case", to: "patient", cardinality: "many_to_one", kind: "parent", label: "Patient case" },
      { from: "invoice", to: "patient", cardinality: "many_to_one", kind: "reference", label: "Patient invoice" },
      { from: "clinical_note", to: "patient", cardinality: "many_to_one", kind: "reference", label: "Patient note" },
    ],
  },
  sports: {
    objects: [
      { archetypeId: "customer", objectId: "player", label: "Player" },
      { archetypeId: "project", objectId: "team", label: "Team" },
      { archetypeId: "appointment", objectId: "practice", label: "Practice" },
      { archetypeId: "document", objectId: "scouting_report", label: "Scouting report" },
      { archetypeId: "equipment", objectId: "equipment", label: "Equipment" },
      { archetypeId: "case", objectId: "travel_case", label: "Travel case" },
      { archetypeId: "knowledge_article", objectId: "drill", label: "Drill" },
    ],
    relationships: [
      { from: "player", to: "team", cardinality: "many_to_one", kind: "reference", label: "Player on team" },
      { from: "practice", to: "team", cardinality: "many_to_one", kind: "reference", label: "Team practice" },
      { from: "scouting_report", to: "player", cardinality: "many_to_one", kind: "reference", label: "Player report" },
      { from: "travel_case", to: "team", cardinality: "many_to_one", kind: "reference", label: "Team travel" },
    ],
  },
  default: {
    objects: [
      { archetypeId: "customer", objectId: "customer", label: "Customer" },
      { archetypeId: "lead", objectId: "lead", label: "Lead" },
      { archetypeId: "opportunity", objectId: "opportunity", label: "Opportunity" },
      { archetypeId: "case", objectId: "case", label: "Case" },
      { archetypeId: "project", objectId: "project", label: "Project" },
      { archetypeId: "invoice", objectId: "invoice", label: "Invoice" },
      { archetypeId: "document", objectId: "document", label: "Document" },
      { archetypeId: "knowledge_article", objectId: "knowledge_article", label: "Knowledge article" },
    ],
    relationships: [
      { from: "opportunity", to: "customer", cardinality: "many_to_one", kind: "reference", label: "Customer opportunity" },
      { from: "case", to: "customer", cardinality: "many_to_one", kind: "reference", label: "Customer case" },
      { from: "invoice", to: "customer", cardinality: "many_to_one", kind: "reference", label: "Customer invoice" },
      { from: "lead", to: "opportunity", cardinality: "one_to_one", kind: "derived", label: "Converted lead" },
    ],
  },
});

export function getObjectArchetype(archetypeId) {
  return OBJECT_ARCHETYPES[String(archetypeId)] ?? null;
}

export function listObjectArchetypeIds() {
  return Object.keys(OBJECT_ARCHETYPES);
}

export function resolveDataModelTemplate(industry) {
  const key = String(industry ?? "default");
  return DATA_MODEL_TEMPLATES[key] ?? DATA_MODEL_TEMPLATES.default;
}
