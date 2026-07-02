const CAPABILITY_STATUS_CATEGORY = "platform";

function makeBaseCapability({
  id,
  name,
  description,
  category = CAPABILITY_STATUS_CATEGORY,
  dependencies = [],
  requirements = [],
  providedFeatures = [],
  industrySupport = ["any"],
  recommendationSeeds = [],
} = {}) {
  return deepFreeze({
    id,
    name,
    description,
    category,
    dependencies,
    requirements,
    providedFeatures,
    industrySupport,
    recommendationSeeds,
  });
}

// Deterministic built-in capabilities.
// Note: "requirements" and "recommendations" are evaluated later by CapabilityEvaluator.
const BUILT_IN_CAPABILITIES = [
  makeBaseCapability({
    id: "company_identity",
    name: "Company Identity",
    description: "Company identity and baseline configuration is defined.",
    requirements: [
      { type: "company_profile_validation_passed" },
      { type: "company_profile_completion_percent_threshold", threshold: 40 },
    ],
    providedFeatures: ["company-profile-loaded"],
    industrySupport: ["any"],
    recommendationSeeds: ["Complete Company Profile."],
  }),
  makeBaseCapability({
    id: "business_profile",
    name: "Business Profile",
    description: "Business setup is configured for operations.",
    dependencies: ["company_identity"],
    requirements: [
      { type: "company_business_profile_validation_passed" },
      { type: "company_business_profile_completion_percent_threshold", threshold: 80 },
    ],
    providedFeatures: ["business-profile-configured"],
    industrySupport: ["any"],
    recommendationSeeds: ["Complete Business Setup."],
  }),
  makeBaseCapability({
    id: "brand",
    name: "Brand",
    description: "Brand setup provides voice and communication style.",
    dependencies: ["business_profile"],
    requirements: [{ type: "onboarding_step_completed", stepId: "brand_setup" }],
    providedFeatures: ["brand-voice-configured"],
    industrySupport: ["any"],
    recommendationSeeds: ["Complete Brand Setup."],
  }),
  makeBaseCapability({
    id: "integrations",
    name: "Connections",
    description: "External systems are connected and ready for operations.",
    dependencies: ["business_profile"],
    requirements: [
      { type: "onboarding_step_completed", stepId: "integrations" },
      { type: "company_connected_systems_feature_available", feature: "Intake" },
    ],
    providedFeatures: ["connections-ready"],
    industrySupport: ["any"],
    recommendationSeeds: ["Connect at least one system."],
  }),
  makeBaseCapability({
    id: "knowledge",
    name: "Knowledge",
    description: "Company knowledge exists and is ready for employee context.",
    dependencies: ["company_identity", "business_profile", "brand"],
    requirements: [
      { type: "company_knowledge_repository_initialized" },
      { type: "company_knowledge_categories_available" },
      { type: "company_knowledge_items_published" },
      { type: "company_knowledge_minimum_published_count", minCount: 1 },
      { type: "company_knowledge_publishing_activity_exists" },
      { type: "company_knowledge_brain_context_available" },
      { type: "company_knowledge_no_blocking_errors" },
    ],
    providedFeatures: ["knowledge-context-available"],
    industrySupport: ["any"],
    recommendationSeeds: ["Upload company knowledge.", "Publish at least one knowledge item."],
  }),
  makeBaseCapability({
    id: "communications",
    name: "Communications",
    description: "Digital communications can be produced deterministically.",
    dependencies: ["brand", "integrations"],
    requirements: [
      { type: "company_communication_setup_email_ready" },
      { type: "company_communication_setup_sms_ready" },
      { type: "company_communication_setup_brand_ready" },
      { type: "company_communication_setup_quiet_hours_ready" },
      { type: "company_communication_setup_approval_policy_ready" },
    ],
    providedFeatures: ["communications-ready"],
    industrySupport: ["any"],
    recommendationSeeds: ["Generate a communication after approval."],
  }),
  makeBaseCapability({
    id: "digital_workforce",
    name: "Digital Workforce",
    description: "Digital employees are provisioned and can operate with knowledge context.",
    dependencies: ["knowledge", "communications"],
    requirements: [{ type: "onboarding_step_completed", stepId: "employee_provisioning" }],
    providedFeatures: ["employees-provisioned"],
    industrySupport: ["any"],
    recommendationSeeds: ["Provision employees."],
  }),
  makeBaseCapability({
    id: "workspace",
    name: "Workspace",
    description: "Workspace generation is complete and the platform is ready for operations.",
    dependencies: ["digital_workforce"],
    requirements: [{ type: "onboarding_step_completed", stepId: "workspace_generation" }],
    providedFeatures: ["workspace-generated"],
    industrySupport: ["any"],
    recommendationSeeds: ["Generate workspace."],
  }),
  makeBaseCapability({
    id: "analytics",
    name: "Analytics",
    description: "Operational analytics views are available.",
    dependencies: ["workspace"],
    requirements: [{ type: "company_metrics_available" }],
    providedFeatures: ["metrics-available"],
    industrySupport: ["any"],
    recommendationSeeds: ["Enable analytics after workspace generation."],
  }),
  makeBaseCapability({
    id: "automation",
    name: "Automation",
    description: "Deterministic automations can run based on operational events.",
    dependencies: ["communications", "integrations"],
    requirements: [{ type: "onboarding_step_completed", stepId: "integrations" }],
    providedFeatures: ["automation-ready"],
    industrySupport: ["any"],
    recommendationSeeds: ["Connect integrations and enable automation rules."],
  }),
];

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

export class CapabilityRegistry {
  constructor({ additionalCapabilities } = {}) {
    this.capabilities = [...BUILT_IN_CAPABILITIES, ...(additionalCapabilities ?? [])];
    this.capabilitiesById = new Map(this.capabilities.map((c) => [c.id, c]));
  }

  list() {
    return this.capabilities;
  }

  getById(id) {
    return this.capabilitiesById.get(String(id));
  }
}

