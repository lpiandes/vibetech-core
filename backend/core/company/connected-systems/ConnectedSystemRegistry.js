const FEATURES_BY_CATEGORY_PROVIDER = [
  {
    category: "Communication",
    provider: "email",
    features: ["Send Email", "Receive Email", "Threads", "Labels"],
    capabilitiesUnlocked: ["send_email", "receive_email", "threads", "labels"],
  },
  {
    category: "Communication",
    provider: "sms",
    features: ["Send SMS", "Quiet Hours Opt-out"],
    capabilitiesUnlocked: ["send_sms"],
  },
  {
    category: "Website",
    provider: "website_intake",
    features: ["Intake", "Lead Capture", "Chat"],
    capabilitiesUnlocked: ["intake", "lead_capture", "chat"],
  },
  {
    category: "CRM",
    provider: "crm",
    features: ["Leads", "Contacts", "Deals"],
    capabilitiesUnlocked: ["leads", "contacts", "deals"],
  },
  {
    category: "Knowledge Source",
    provider: "knowledge_os",
    features: ["Knowledge Repository", "Knowledge Categories", "Published Knowledge"],
    capabilitiesUnlocked: ["knowledge_repository", "knowledge_categories", "published_knowledge"],
  },
  {
    category: "Storage",
    provider: "document_storage",
    features: ["Store Documents", "Retrieve Documents"],
    capabilitiesUnlocked: ["store_documents", "retrieve_documents"],
  },
];

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

export class ConnectedSystemRegistry {
  constructor() {
    this.map = new Map(
      FEATURES_BY_CATEGORY_PROVIDER.map((x) => [
        `${x.category}::${x.provider}`,
        deepFreeze({
          category: x.category,
          provider: x.provider,
          features: x.features,
          capabilitiesUnlocked: x.capabilitiesUnlocked,
        }),
      ]),
    );
  }

  getSpec({ category, provider } = {}) {
    const key = `${category}::${provider}`;
    return this.map.get(key) ?? null;
  }

  getDefaultSpec({ category } = {}) {
    return deepFreeze({
      category: category ?? "Custom",
      provider: "custom",
      features: [],
      capabilitiesUnlocked: [],
    });
  }
}

