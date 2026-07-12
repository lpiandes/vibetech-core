/**
 * High-value universal Architect change capabilities (declarative).
 */

const audit = {
  interpreted: "architect.change_interpreted",
  needsInformation: "architect.change_needs_information",
  ambiguous: "architect.change_ambiguous",
  unsupported: "architect.change_unsupported",
  proposed: "architect.change_proposed",
  rejected: "architect.change_rejected",
  approved: "architect.change_approved",
  executionStarted: "architect.change_execution_started",
  executed: "architect.change_executed",
  failed: "architect.change_failed",
};

const baseApproval = {
  requiresDryRun: true,
  requiresHumanApproval: true,
  bindsContentHash: true,
};

export const HIGH_VALUE_ARCHITECT_CHANGE_CAPABILITIES = [
  {
    capabilityId: "architect.change.update_business_profile",
    version: "1.0.0",
    title: "Update business profile",
    description: "Update business name, industry, services, or goals on the OS profile.",
    matchPriority: 90,
    requestPatterns: [{
      id: "profile",
      examples: ["Update our business name to Northline PM", "Change our industry description"],
      keywords: ["business name", "update profile", "change our industry", "update our business"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "businessName",
        label: "Business name",
        required: false,
        prompt: "What is the updated business name?",
        extractFromText: {
          regex: "(?:name to|rename (?:the )?business to|called)\\s+(.+?)(?:\\.|$)",
          group: 1,
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Update business profile",
      operations: [{
        operationType: "updateBusinessProfile",
        targetType: "business_profile",
        payload: { businessName: "{{businessName}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["business_profile"],
        allowsExternalCommunication: false,
      }],
    },
    // Prefer buildMutationPlan so we don't wipe name when missing
    buildMutationPlan: ({ capability, values, text, businessId, createMutationPlan, createMutationOperation }) => {
      const payload = {};
      if (values.businessName) payload.businessName = values.businessName;
      if (!Object.keys(payload).length) {
        payload.description = String(text);
      }
      return createMutationPlan({
        capabilityId: capability.capabilityId,
        businessId,
        summary: "Update business profile",
        operations: [createMutationOperation({
          operationType: "updateBusinessProfile",
          targetType: "business_profile",
          payload,
          requiredPermission: "business.manage",
          affectedRuntimeKinds: ["business_profile"],
          allowsExternalCommunication: false,
          reason: text,
        })],
      });
    },
    affectedCanonicalAreas: ["business_profile", "profile"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "profile", summaryTemplate: "Update profile" },
  },
  {
    capabilityId: "architect.change.invite_team_member",
    version: "1.0.0",
    title: "Invite team member",
    description: "Invite a person via the governed invitation service after approval.",
    matchPriority: 106,
    requestPatterns: [{
      id: "invite",
      examples: ["Invite jordan@example.com as a manager", "Send an invite to alex@co.com"],
      keywords: ["invite", "invitation"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [
        {
          id: "email",
          label: "Email",
          required: true,
          prompt: "What email should we invite?",
          extractFromText: { regex: "([a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,})", group: 1 },
        },
        {
          id: "role",
          label: "Role",
          required: false,
          prompt: "What membership role (OWNER, MANAGER, EMPLOYEE)?",
          extractFromText: {
            regex: "\\b(owner|manager|employee|admin)\\b",
            group: 1,
            fallback: "EMPLOYEE",
          },
        },
      ],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Invite {{email}} as {{role}}",
      operations: [{
        operationType: "inviteMembership",
        targetType: "membership",
        payload: { email: "{{email}}", role: "{{role}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["team_membership"],
        allowsExternalCommunication: true,
      }],
    },
    affectedCanonicalAreas: ["team_membership"],
    approvalPolicy: baseApproval,
    warningRules: [{
      id: "governed_invite",
      when: "always",
      message: "Invitation email is sent only through the governed invitation service after you approve.",
    }],
    auditEventTypes: audit,
    uiPresentation: { category: "team", summaryTemplate: "Invite teammate" },
  },
  {
    capabilityId: "architect.change.enable_integration",
    version: "1.0.0",
    title: "Enable integration",
    description: "Enable or require an integration on the Business OS.",
    matchPriority: 104,
    requestPatterns: [{
      id: "enable_integration",
      examples: ["Enable business email integration", "Turn on Gmail integration"],
      keywords: ["enable integration", "turn on", "enable"],
      excludeKeywords: ["disconnect", "unlink", "remove"],
      allKeywords: ["enable"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "integrationId",
        label: "Integration",
        required: true,
        prompt: "Which integration should we enable?",
        extractFromText: {
          regex: "(?:enable|connect)\\s+(.+?)(?:\\s+integration)?(?:\\.|$)",
          group: 1,
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Enable integration: {{integrationId}}",
      operations: [{
        operationType: "enableIntegration",
        targetType: "integration",
        payload: { integrationId: "{{integrationId}}", label: "{{integrationId}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["integrations"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["integrations"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "integrations", summaryTemplate: "Enable integration" },
  },
  {
    capabilityId: "architect.change.enable_ai_employee",
    version: "1.0.0",
    title: "Enable or disable AI employee",
    description: "Toggle an AI employee definition readiness/enabled state.",
    matchPriority: 103,
    requestPatterns: [{
      id: "enable_ai",
      examples: ["Enable the intake AI employee", "Disable the scouting AI employee"],
      keywords: ["enable", "disable", "ai employee"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [
        {
          id: "label",
          label: "Employee label",
          required: true,
          prompt: "Which AI employee?",
          extractFromText: {
            regex: "(?:enable|disable)\\s+(?:the\\s+)?(.+?)(?:\\s+ai employee)?(?:\\.|$)",
            group: 1,
          },
        },
        {
          id: "enabled",
          label: "Enabled",
          required: false,
          extractFromText: { regex: "\\b(enable|disable)\\b", group: 1 },
        },
      ],
    },
    mutationPlanTemplate: { operations: [] },
    buildMutationPlan: ({ capability, values, text, businessId, createMutationPlan, createMutationOperation }) => {
      const enable = !String(values.enabled ?? text).toLowerCase().includes("disable");
      return createMutationPlan({
        capabilityId: capability.capabilityId,
        businessId,
        summary: `${enable ? "Enable" : "Disable"} AI employee: ${values.label}`,
        operations: [createMutationOperation({
          operationType: enable ? "enableEmployeeDefinition" : "disableEmployeeDefinition",
          targetType: "employee_definition",
          payload: enable
            ? { label: values.label, readinessState: "ready" }
            : { match: values.label, archive: false },
          requiredPermission: "business.manage",
          affectedRuntimeKinds: ["employees"],
          allowsExternalCommunication: false,
          reason: text,
        })],
      });
    },
    affectedCanonicalAreas: ["employees", "workforce"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "workforce", summaryTemplate: "Toggle AI employee" },
  },
  {
    capabilityId: "architect.change.enable_blueprint_capability",
    version: "1.0.0",
    title: "Enable blueprint capability",
    description: "Enable or disable a blueprint/package capability requirement.",
    matchPriority: 95,
    requestPatterns: [{
      id: "enable_capability",
      examples: ["Enable the scheduling capability", "Turn on relationship follow-up"],
      keywords: ["enable the", "capability", "turn on", "blueprint"],
      weight: 1,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "capabilityId",
        label: "Capability id",
        required: true,
        prompt: "Which capability should we enable?",
        extractFromText: {
          regex: "(?:enable|turn on)\\s+(?:the\\s+)?(.+?)(?:\\s+capability)?(?:\\.|$)",
          group: 1,
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Enable capability: {{capabilityId}}",
      operations: [{
        operationType: "enableCapability",
        targetType: "capability",
        targetId: "{{capabilityId}}",
        payload: { capabilityId: "{{capabilityId}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["blueprint_component", "capability"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["blueprint_component", "capabilities"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "blueprint", summaryTemplate: "Enable capability" },
  },
  {
    capabilityId: "architect.change.modify_approval_policy",
    version: "1.0.0",
    title: "Modify approval policy",
    description: "Create or update an approval / governance policy.",
    matchPriority: 96,
    requestPatterns: [{
      id: "modify_approval",
      examples: ["Require owner approval for campaigns", "Tighten approval policy for customer email"],
      keywords: ["approval policy", "require approval", "tighten approval"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "label",
        label: "Policy",
        required: false,
        extractFromText: { fallback: "Updated approval policy" },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Modify approval policy: {{label}}",
      operations: [{
        operationType: "updateApprovalPolicy",
        targetType: "governance_policy",
        payload: { label: "{{label}}", enforced: true },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["governance_policies"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["governance_policies"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "governance", summaryTemplate: "Modify approval policy" },
  },
  {
    capabilityId: "architect.change.update_workflow",
    version: "1.0.0",
    title: "Create or update workflow",
    description: "Create or update workflow configuration on the Business OS.",
    matchPriority: 94,
    requestPatterns: [{
      id: "update_workflow",
      examples: ["Update the intake workflow configuration", "Configure the follow-up workflow"],
      keywords: ["update workflow", "configure workflow", "workflow configuration"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "label",
        label: "Workflow",
        required: true,
        prompt: "Which workflow should we create or update?",
        extractFromText: {
          regex: "(?:update|configure)\\s+(?:the\\s+)?(.+?)(?:\\s+workflow)?(?:\\.|$)",
          group: 1,
          fallback: "Updated workflow",
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Update workflow: {{label}}",
      operations: [{
        operationType: "createWorkflow",
        targetType: "workflow",
        payload: { label: "{{label}}", configuration: { source: "architect" } },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["workflows"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["workflows"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "workflows", summaryTemplate: "Update workflow" },
  },
  {
    capabilityId: "architect.change.add_knowledge",
    version: "1.0.0",
    title: "Add or update business knowledge",
    description: "Queue a knowledge document change — never sends externally.",
    matchPriority: 92,
    requestPatterns: [{
      id: "knowledge",
      examples: ["Add a knowledge document for leasing policy", "Update our operating policies knowledge"],
      keywords: ["knowledge document", "add knowledge", "update knowledge", "operating policies"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "title",
        label: "Document title",
        required: true,
        prompt: "What should we title the knowledge document?",
        extractFromText: {
          regex: "(?:knowledge(?: document)?(?: for)?|titled)\\s+(.+?)(?:\\.|$)",
          group: 1,
          fallback: "Operating policy",
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Add knowledge: {{title}}",
      operations: [{
        operationType: "createKnowledgeDocument",
        targetType: "knowledge_document",
        payload: { title: "{{title}}", categoryId: "OPERATING_POLICIES" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["knowledge"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["knowledge"],
    approvalPolicy: baseApproval,
    warningRules: [{
      id: "no_external",
      when: "always",
      message: "Knowledge updates never send customer communications.",
    }],
    auditEventTypes: audit,
    uiPresentation: { category: "knowledge", summaryTemplate: "Add knowledge" },
  },
];
