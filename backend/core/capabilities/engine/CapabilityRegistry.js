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
    requirements: [{ type: "onboarding_step_completed", stepId: "company_profile" }],
    providedFeatures: ["company-profile-loaded"],
    industrySupport: ["any"],
    recommendationSeeds: ["Complete Company Profile."],
  }),
  makeBaseCapability({
    id: "business_profile",
    name: "Business Profile",
    description: "Business setup is configured for operations.",
    dependencies: ["company_identity"],
    requirements: [{ type: "onboarding_step_completed", stepId: "business_setup" }],
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
    name: "Integrations",
    description: "External integrations are connected or ready for onboarding.",
    dependencies: ["business_profile"],
    requirements: [
      { type: "onboarding_step_completed", stepId: "integrations" },
      { type: "company_integration_connected_any" },
    ],
    providedFeatures: ["integrations-connected"],
    industrySupport: ["any"],
    recommendationSeeds: ["Connect at least one integration."],
  }),
  makeBaseCapability({
    id: "knowledge",
    name: "Knowledge",
    description: "Company knowledge exists and is ready for employee context.",
    dependencies: ["company_identity", "business_profile", "brand"],
    requirements: [
      { type: "onboarding_step_completed", stepId: "knowledge_import" },
      { type: "knowledge_repository_initialized" },
      { type: "company_brain_available" },
    ],
    providedFeatures: ["knowledge-context-available"],
    industrySupport: ["any"],
    recommendationSeeds: ["Publish imported knowledge."],
  }),
  makeBaseCapability({
    id: "communications",
    name: "Communications",
    description: "Digital communications can be produced deterministically.",
    dependencies: ["brand", "integrations"],
    requirements: [
      // Communications require integrations + brand operational readiness.
      { type: "onboarding_step_completed", stepId: "integrations" },
      { type: "company_communication_engine_ready" },
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

