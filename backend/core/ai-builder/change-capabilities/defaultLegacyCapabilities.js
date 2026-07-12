/**
 * Declarative default Architect change capabilities (universal core).
 * Industry terminology/examples belong in package contributions — not here.
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

export const DEFAULT_ARCHITECT_CHANGE_CAPABILITIES = [
  {
    capabilityId: "architect.change.terminology_rename",
    version: "1.0.0",
    title: "Rename terminology",
    description: "Rename a label used in navigation and presentation.",
    legacyKindAliases: ["terminology_rename"],
    matchPriority: 120,
    requestPatterns: [{
      id: "rename_to",
      examples: ["Rename Patients to Clients", "Rename Customers to Patients"],
      keywords: ["rename"],
      allKeywords: ["rename", "to"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [
        {
          id: "from",
          label: "Current name",
          required: true,
          prompt: "What label should we rename?",
          extractFromText: { regex: "rename\\s+(.+?)\\s+to\\s+(.+)", group: 1 },
        },
        {
          id: "to",
          label: "New name",
          required: true,
          prompt: "What should it be called instead?",
          extractFromText: { regex: "rename\\s+(.+?)\\s+to\\s+(.+)", group: 2 },
        },
      ],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Rename \"{{from}}\" to \"{{to}}\"",
      operations: [{
        operationType: "renameTerminology",
        targetType: "terminology",
        payload: { from: "{{from}}", to: "{{to}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["terminology", "modules"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["terminology", "navigation", "modules"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "terminology", summaryTemplate: "Rename terminology" },
  },
  {
    capabilityId: "architect.change.add_employee",
    version: "1.0.0",
    title: "Add AI / digital employee",
    description: "Add an employee definition to the Business OS workforce.",
    legacyKindAliases: ["add_employee"],
    matchPriority: 115,
    requestPatterns: [{
      id: "hire",
      examples: ["We hired another leasing agent", "Add an AI employee for intake"],
      keywords: ["hire", "hired", "employee", "agent", "ai employee", "leasing"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "label",
        label: "Role or employee label",
        required: true,
        prompt: "What role or employee should we add?",
        extractFromText: {
          regex: "(?:hire|hired|add)\\s+(?:an?\\s+|another\\s+)?(.+?)(?:\\.|$)",
          group: 1,
          fallback: "New team member",
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Add employee definition: {{label}}",
      operations: [{
        operationType: "enableEmployeeDefinition",
        targetType: "employee_definition",
        payload: { label: "{{label}}", purpose: "{{text}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["employees", "workforce"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["employees", "workforce"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "workforce", summaryTemplate: "Add employee" },
  },
  {
    capabilityId: "architect.change.add_location",
    version: "1.0.0",
    title: "Add or modify location",
    description: "Add a business location or office to the profile.",
    legacyKindAliases: ["add_office"],
    matchPriority: 110,
    requestPatterns: [{
      id: "office",
      examples: ["Add a new office in Austin", "Open another location"],
      keywords: ["office", "location", "branch"],
      allKeywords: [],
      weight: 1,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "label",
        label: "Location name",
        required: false,
        prompt: "What is the location or office name?",
        extractFromText: {
          regex: "(?:office|location|branch)\\s+(?:in\\s+)?(.+?)(?:\\.|$)",
          group: 1,
          fallback: "New office",
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Add location: {{label}}",
      operations: [{
        operationType: "addLocation",
        targetType: "location",
        payload: { label: "{{label}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["locations", "profile"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["locations", "profile"],
    approvalPolicy: baseApproval,
    warningRules: [{ id: "office_keywords", when: "always", message: "Location changes update the Business OS profile only after approval." }],
    auditEventTypes: audit,
    uiPresentation: { category: "profile", summaryTemplate: "Add location" },
    // Match only when add/open/new present — use exclude of empty via custom pattern keywords
    // Enforced by requiring one of add/open/new in keywords set with weight via second pattern:
  },
  {
    capabilityId: "architect.change.disable_integration",
    version: "1.0.0",
    title: "Disable integration",
    description: "Disconnect or disable an integration requirement.",
    legacyKindAliases: ["disconnect_integration"],
    matchPriority: 112,
    requestPatterns: [{
      id: "disconnect",
      examples: ["Disconnect the Gmail integration", "Unlink our CRM app"],
      keywords: ["disconnect", "unlink"],
      weight: 2,
    }, {
      id: "remove_integration",
      examples: ["Remove the AppFolio integration"],
      keywords: ["remove", "integration"],
      allKeywords: ["remove"],
      weight: 1,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: { fields: [] },
    mutationPlanTemplate: {
      summaryTemplate: "Disable integration matching request",
      operations: [{
        operationType: "disableIntegration",
        targetType: "integration",
        payload: { integrationId: "{{text}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["integrations"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["integrations"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "integrations", summaryTemplate: "Disable integration" },
  },
  {
    capabilityId: "architect.change.modify_permissions",
    version: "1.0.0",
    title: "Modify role permissions",
    description: "Grant or revoke module visibility for roles.",
    legacyKindAliases: ["permission_change"],
    matchPriority: 108,
    requestPatterns: [{
      id: "access",
      examples: ["Only managers should see billing", "Give coaches access to scouting"],
      keywords: ["access", "permission", "only managers", "managers"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: { fields: [] },
    mutationPlanTemplate: { operations: [] },
    buildMutationPlan: ({ capability, text, businessId, createMutationPlan, createMutationOperation }) => {
      const lower = String(text).toLowerCase();
      const ops = [];
      if (lower.includes("managers") && lower.includes("billing")) {
        ops.push(createMutationOperation({
          operationType: "grantPermission",
          targetType: "role",
          targetId: "manager",
          payload: { moduleId: "billing", roleId: "manager" },
          requiredPermission: "business.manage",
          affectedRuntimeKinds: ["roles", "permissions"],
          allowsExternalCommunication: false,
          reason: text,
        }));
        ops.push(createMutationOperation({
          operationType: "revokePermission",
          targetType: "role",
          targetId: "employee",
          payload: { moduleId: "billing", roleId: "employee" },
          requiredPermission: "business.manage",
          affectedRuntimeKinds: ["roles", "permissions"],
          allowsExternalCommunication: false,
          reason: text,
        }));
      } else {
        // Preserve prior no-op-safe behavior: still produce an idempotent grant attempt on manager if module hinted
        const moduleMatch = String(text).match(/access to\s+([a-z0-9_\s-]+)/i);
        const moduleId = moduleMatch?.[1]?.trim().toLowerCase().replace(/\s+/g, "_") ?? null;
        if (moduleId) {
          ops.push(createMutationOperation({
            operationType: "grantPermission",
            targetType: "role",
            targetId: "manager",
            payload: { moduleId, roleId: "manager" },
            requiredPermission: "business.manage",
            affectedRuntimeKinds: ["roles", "permissions"],
            allowsExternalCommunication: false,
            reason: text,
          }));
        } else {
          ops.push(createMutationOperation({
            operationType: "appendUnresolvedRequirement",
            targetType: "unresolved_requirement",
            payload: { question: `Clarify permission change: ${text}` },
            requiredPermission: "business.manage",
            affectedRuntimeKinds: ["permissions"],
            allowsExternalCommunication: false,
          }));
        }
      }
      return createMutationPlan({
        capabilityId: capability.capabilityId,
        businessId,
        operations: ops,
        summary: "Modify role permissions",
      });
    },
    affectedCanonicalAreas: ["roles", "permissions"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "permissions", summaryTemplate: "Modify permissions" },
  },
  {
    capabilityId: "architect.change.add_module",
    version: "1.0.0",
    title: "Add workspace module",
    description: "Add a navigation workspace/module to the Business OS.",
    legacyKindAliases: ["add_module"],
    matchPriority: 105,
    requestPatterns: [{
      id: "workspace",
      examples: ["Add a referrals workspace", "Add a module for reporting"],
      keywords: ["workspace", "module"],
      allKeywords: ["add"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "label",
        label: "Workspace name",
        required: true,
        prompt: "What should the new workspace be called?",
        extractFromText: {
          regex: "add\\s+(?:a\\s+|an\\s+)?(.+?)(?:\\s+workspace|\\s+module)?(?:\\.|$)",
          group: 1,
          fallback: "New workspace",
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Add workspace: {{label}}",
      operations: [{
        operationType: "addModule",
        targetType: "module",
        payload: { label: "{{label}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["modules"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["modules", "navigation"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "navigation", summaryTemplate: "Add workspace" },
  },
  {
    capabilityId: "architect.change.remove_employee",
    version: "1.0.0",
    title: "Remove employee definition",
    description: "Archive or remove a digital employee definition.",
    legacyKindAliases: ["remove_employee"],
    matchPriority: 114,
    requestPatterns: [{
      id: "remove_employee",
      examples: ["Remove the intake employee"],
      keywords: ["remove", "employee"],
      allKeywords: ["remove", "employee"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "match",
        label: "Employee to remove",
        required: false,
        prompt: "Which employee definition should we remove?",
        extractFromText: {
          regex: "remove\\s+(.+?)(?:\\s+employee)?(?:\\.|$)",
          group: 1,
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Remove employee: {{match}}",
      operations: [{
        operationType: "disableEmployeeDefinition",
        targetType: "employee_definition",
        payload: { match: "{{match}}", archive: true },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["employees"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["employees", "workforce"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "workforce", summaryTemplate: "Remove employee" },
  },
  {
    capabilityId: "architect.change.add_campaign",
    version: "1.0.0",
    title: "Add campaign",
    description: "Add a campaign template requiring approval before send.",
    legacyKindAliases: ["add_campaign"],
    matchPriority: 100,
    requestPatterns: [{
      id: "campaign",
      examples: ["Add a weekly newsletter", "Create an email campaign"],
      keywords: ["newsletter", "campaign"],
      weight: 2,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "label",
        label: "Campaign name",
        required: false,
        prompt: "What should we call the campaign?",
        extractFromText: { fallback: "New campaign" },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Add campaign: {{label}}",
      operations: [{
        operationType: "addCampaign",
        targetType: "campaign",
        payload: { label: "{{label}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["campaigns"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["campaigns"],
    approvalPolicy: baseApproval,
    warningRules: [{
      id: "no_silent_send",
      when: "always",
      message: "Campaigns never send without explicit approval.",
    }],
    auditEventTypes: audit,
    uiPresentation: { category: "campaigns", summaryTemplate: "Add campaign" },
  },
  {
    capabilityId: "architect.change.add_approval_policy",
    version: "1.0.0",
    title: "Add approval policy",
    description: "Add or tighten a governance approval policy.",
    legacyKindAliases: ["add_approval"],
    matchPriority: 98,
    requestPatterns: [{
      id: "approval",
      examples: ["Add an approval step for owner reports"],
      keywords: ["approval"],
      weight: 1,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "label",
        label: "Policy label",
        required: false,
        extractFromText: { fallback: "Additional approval required" },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Add approval policy: {{label}}",
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
    uiPresentation: { category: "governance", summaryTemplate: "Add approval policy" },
  },
  {
    capabilityId: "architect.change.add_workflow",
    version: "1.0.0",
    title: "Add workflow",
    description: "Create a workflow definition on the Business OS.",
    legacyKindAliases: ["add_workflow"],
    matchPriority: 97,
    requestPatterns: [{
      id: "workflow",
      examples: ["Add an intake workflow", "Create a follow-up workflow"],
      keywords: ["workflow", "intake"],
      weight: 1,
    }],
    requiredPermissions: ["business.manage"],
    requiredInformationSchema: {
      fields: [{
        id: "label",
        label: "Workflow name",
        required: false,
        extractFromText: {
          regex: "add\\s+(?:an?\\s+)?(.+?)(?:\\s+workflow)?(?:\\.|$)",
          group: 1,
          fallback: "New workflow",
        },
      }],
    },
    mutationPlanTemplate: {
      summaryTemplate: "Add workflow: {{label}}",
      operations: [{
        operationType: "createWorkflow",
        targetType: "workflow",
        payload: { label: "{{label}}" },
        requiredPermission: "business.manage",
        affectedRuntimeKinds: ["workflows"],
        allowsExternalCommunication: false,
      }],
    },
    affectedCanonicalAreas: ["workflows"],
    approvalPolicy: baseApproval,
    auditEventTypes: audit,
    uiPresentation: { category: "workflows", summaryTemplate: "Add workflow" },
  },
];

// Fix add_location to require add/open/new — redefine pattern properly
DEFAULT_ARCHITECT_CHANGE_CAPABILITIES.find((c) => c.capabilityId === "architect.change.add_location").requestPatterns = [{
  id: "add_office_strict",
  examples: ["Add a new office in Austin", "Add another office"],
  keywords: ["office", "location", "branch"],
  allKeywords: ["add"],
  weight: 2,
}, {
  id: "open_location",
  examples: ["Open another location"],
  keywords: ["location", "office", "branch"],
  allKeywords: ["open"],
  weight: 2,
}, {
  id: "new_branch",
  examples: ["Open a new branch"],
  keywords: ["branch", "office", "location"],
  allKeywords: ["new"],
  weight: 2,
}];
