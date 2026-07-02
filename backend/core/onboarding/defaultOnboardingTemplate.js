import { createOnboardingStep, STEP_STATUS } from "./OnboardingStep.js";

function makeDefaultSteps() {
  return [
    {
      id: "company_profile",
      title: "Company Profile",
      description: "Define your company and operational baseline.",
      requirements: { kind: "MANDATORY" },
      metadata: { category: "Company" },
      progress: 0,
      status: STEP_STATUS.PENDING,
    },
    {
      id: "business_setup",
      title: "Business Setup",
      description: "Configure business defaults and workflows.",
      requirements: { kind: "MANDATORY" },
      metadata: { category: "Operations" },
      progress: 0,
      status: STEP_STATUS.PENDING,
    },
    {
      id: "brand_setup",
      title: "Brand Setup",
      description: "Establish tone, voice, and communication style.",
      requirements: { kind: "MANDATORY" },
      metadata: { category: "Brand" },
      progress: 0,
      status: STEP_STATUS.PENDING,
    },
    {
      id: "integrations",
      title: "Integrations",
      description: "Connect external systems (future).",
      requirements: { kind: "OPTIONAL" },
      metadata: { category: "Integrations" },
      progress: 0,
      status: STEP_STATUS.PENDING,
    },
    {
      id: "knowledge_import",
      title: "Knowledge Import",
      description: "Import company knowledge (future).",
      requirements: { kind: "MANDATORY" },
      metadata: { category: "Knowledge" },
      progress: 0,
      status: STEP_STATUS.PENDING,
    },
    {
      id: "employee_provisioning",
      title: "Employee Provisioning",
      description: "Provision digital employees (future).",
      requirements: { kind: "MANDATORY" },
      metadata: { category: "Workforce" },
      progress: 0,
      status: STEP_STATUS.PENDING,
    },
    {
      id: "workspace_generation",
      title: "Workspace Generation",
      description: "Generate runtime workspace configuration (future).",
      requirements: { kind: "MANDATORY" },
      metadata: { category: "Workspace" },
      progress: 0,
      status: STEP_STATUS.PENDING,
    },
    {
      id: "ready",
      title: "Ready",
      description: "Onboarding complete and ready for operational use.",
      requirements: { kind: "SYSTEM" },
      metadata: { category: "System" },
      progress: 0,
      status: STEP_STATUS.PENDING,
    },
  ].map((s) => createOnboardingStep(s));
}

export function createDefaultOnboardingTemplate() {
  return Object.freeze({
    templateId: "default",
    steps: makeDefaultSteps(),
  });
}

