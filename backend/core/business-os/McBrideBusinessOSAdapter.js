import { createBusinessOSSpecification } from "./BusinessOSSpecification.js";
import { MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE } from "../../../industries/property-management/config/mcbrideClientTemplate.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { PM_CAMPAIGN_TEMPLATES, PM_RECURRING_OPERATION_DEFINITIONS } from "../../../industries/property-management/config/campaignOperations.js";
import { MCBRIDE_RELATIONSHIP_TYPES } from "../../../industries/property-management/config/mcbrideRelationshipRegistry.js";

const NOW = "2026-07-10T20:00:00.000Z";

/**
 * Expresses the completed McBride reference OS as a BusinessOSSpecification.
 * Does not mutate the live McBride installation.
 */
export function exportMcBrideBusinessOSSpecification({
  businessId = null,
  template = MCBRIDE_MAGNA_MARE_CLIENT_TEMPLATE,
  industryPackage = PROPERTY_MANAGEMENT_PACKAGE,
  generatedAt = NOW,
} = {}) {
  const modules = [
    {
      moduleId: "home",
      label: "Home",
      description: "Daily operating overview.",
      moduleType: "operations",
      capabilityIds: ["readiness_checklist", "work_queue"],
      primaryNavigationEligible: true,
      navigationPriority: 1,
      roleVisibility: [],
      primaryActions: ["review_attention"],
      emptyState: "Nothing needs attention right now.",
    },
    {
      moduleId: "work",
      label: "Work",
      description: "Human-approved operating work.",
      moduleType: "operations",
      capabilityIds: ["work_queue", "relationship_follow_up"],
      workTypes: ["prospect_follow_up", "showing_coordination", "maintenance_coordination", "campaign_preparation"],
      primaryNavigationEligible: true,
      navigationPriority: 2,
      roleVisibility: ["work.view"],
      primaryActions: ["open_work", "approve_work"],
      emptyState: "No open work.",
    },
    {
      moduleId: "people",
      label: "People",
      description: "CRM relationships and qualification.",
      moduleType: "records",
      capabilityIds: ["crm_import", "relationship_classification"],
      primaryNavigationEligible: true,
      navigationPriority: 3,
      roleVisibility: ["people.view"],
      primaryActions: ["import_crm", "classify_relationship"],
      emptyState: "Import contacts to get started.",
    },
    {
      moduleId: "properties",
      label: "Properties",
      description: "Listings and property interest.",
      moduleType: "records",
      capabilityIds: ["subject_import", "subject_party_linkage"],
      subjectTypes: ["property", "listing"],
      primaryNavigationEligible: true,
      navigationPriority: 4,
      roleVisibility: ["people.view"],
      primaryActions: ["import_properties"],
      emptyState: "Import trusted property listings.",
    },
    {
      moduleId: "inbox",
      label: "Inbox",
      description: "Business communications.",
      moduleType: "communications",
      capabilityIds: ["communications_inbox"],
      primaryNavigationEligible: true,
      navigationPriority: 5,
      roleVisibility: ["inbox.view"],
      emptyState: "No conversations yet.",
    },
    {
      moduleId: "campaigns",
      label: "Campaigns",
      description: "Recurring campaign preparation and studio.",
      moduleType: "communications",
      capabilityIds: ["campaign_preparation", "campaign_delivery_email"],
      primaryNavigationEligible: true,
      navigationPriority: 6,
      roleVisibility: ["performance.view"],
      primaryActions: ["prepare_campaign", "approve_campaign", "send_campaign"],
      emptyState: "No campaign preparations yet.",
      secondaryNavigationItems: [
        { id: "sec_campaign_ops", label: "Recurring operations" },
        { id: "sec_campaign_studio", label: "Campaign studio" },
      ],
    },
    {
      moduleId: "digital_workforce",
      label: "Team",
      description: "Human team and digital workforce.",
      moduleType: "workforce",
      capabilityIds: ["digital_workforce", "team_assignment"],
      primaryNavigationEligible: true,
      navigationPriority: 7,
      roleVisibility: ["team.manage"],
      emptyState: "Invite teammates and review digital employees.",
    },
    {
      moduleId: "knowledge",
      label: "Knowledge",
      description: "Approved business knowledge.",
      moduleType: "knowledge",
      capabilityIds: ["approved_knowledge", "knowledge_guided_drafts"],
      primaryNavigationEligible: true,
      navigationPriority: 8,
      emptyState: "Upload approved knowledge.",
    },
    {
      moduleId: "performance",
      label: "Performance",
      description: "Relationship and campaign operations intelligence.",
      moduleType: "analytics",
      capabilityIds: ["relationship_operations_intelligence"],
      primaryNavigationEligible: true,
      navigationPriority: 9,
      roleVisibility: ["performance.view"],
      emptyState: "Performance appears after operating activity.",
    },
    {
      moduleId: "integrations",
      label: "Integrations",
      description: "Connected systems.",
      moduleType: "configuration",
      capabilityIds: ["campaign_delivery_email"],
      primaryNavigationEligible: true,
      navigationPriority: 10,
      roleVisibility: ["integrations.manage"],
    },
    {
      moduleId: "settings",
      label: "Settings",
      description: "Workspace configuration.",
      moduleType: "configuration",
      capabilityIds: [],
      primaryNavigationEligible: true,
      navigationPriority: 11,
      roleVisibility: ["settings.manage"],
    },
    {
      moduleId: "readiness",
      label: "Launch readiness",
      description: "Client-readable launch checklist.",
      moduleType: "configuration",
      capabilityIds: ["readiness_checklist"],
      primaryNavigationEligible: false,
      navigationPriority: 12,
    },
  ];

  return createBusinessOSSpecification({
    specificationId: `bos_mcbride_${template.id}`,
    specificationVersion: 1,
    businessId,
    status: "validated",
    generatedAt,
    updatedAt: generatedAt,
    businessProfile: {
      businessName: "McBride / Magna Mare",
      industry: "property_management",
      subIndustry: "residential_leasing_and_brokerage",
      businessModel: "property_management_and_client_relationship_operations",
      services: ["leasing", "owner_communication", "maintenance_coordination", "showings", "campaigns"],
      customerTypes: ["prospect", "buyer", "seller", "owner", "resident", "vendor", "referral_source"],
      channels: ["email", "inbox", "crm_import"],
      goals: ["trusted CRM operations", "property interest tracking", "governed campaigns"],
      painPoints: ["manual follow-up", "fragmented property interest", "unapproved outreach risk"],
      complianceConcerns: ["consent", "suppression", "approval_before_send"],
      currentSystems: ["CRM CSV", "property listing CSV", "business email"],
      terminologyPreferences: {
        BusinessSubject: "Property",
        Party: "Person",
        Work: "Work",
      },
    },
    terminology: {
      operatingSystemTitle: "McBride Property Operating System",
      presentation: {
        BusinessSubject: "Property",
        Party: "Person",
        Work: "Work",
        Request: "Request",
      },
      entityLabels: industryPackage.terminology?.entityLabels ?? {},
      party: industryPackage.terminology?.party ?? { default: "Person" },
      pages: {
        workTitle: "Work",
        requestsTitle: "Requests",
        teamTitle: "Team",
        knowledgeTitle: "Knowledge",
        analyticsTitle: "Performance",
      },
    },
    modules,
    navigation: {
      primaryItems: modules
        .filter((module) => module.primaryNavigationEligible)
        .sort((a, b) => a.navigationPriority - b.navigationPriority)
        .map((module) => ({ moduleId: module.moduleId, label: module.label })),
      secondaryItemsByModule: {
        campaigns: [
          { id: "sec_campaign_ops", label: "Recurring operations" },
          { id: "sec_campaign_studio", label: "Campaign studio" },
        ],
      },
      utilityItems: [{ id: "util_readiness", label: "Launch readiness", href: "readiness" }],
      roleOverrides: {},
      maximumPrimaryItems: 8,
      overflowBehavior: "more",
    },
    subjectDefinitions: [
      { subjectType: "property", label: "Property", keyAttributes: ["address", "displayName"] },
      { subjectType: "listing", label: "Listing", keyAttributes: ["address", "displayName"] },
    ],
    relationshipDefinitions: MCBRIDE_RELATIONSHIP_TYPES.map((entry) => ({
      relationshipType: entry.type,
      label: entry.label,
      category: entry.category,
    })),
    requestDefinitions: asRequestDefs(industryPackage),
    workDefinitions: asWorkDefs(industryPackage),
    workflowDefinitions: [
      { workflowId: "prospect_operating_loop", label: "Prospect inquiry loop" },
      { workflowId: "maintenance_operating_loop", label: "Maintenance loop" },
      { workflowId: "showing_operating_loop", label: "Showing loop" },
      { workflowId: "relationship_follow_up", label: "Relationship follow-up" },
      { workflowId: "campaign_preparation", label: "Campaign preparation" },
    ],
    employeeDefinitions: (industryPackage.employeeDefinitions ?? []).map((employee) => ({
      employeeId: employee.id ?? employee.employeeId,
      label: employee.displayName ?? employee.name ?? employee.label,
      archetypeId: inferArchetype(employee),
      purpose: employee.purpose ?? employee.description ?? "Coordinate property operations.",
      capabilities: employee.capabilities ?? [],
      applicableModules: ["work", "people", "properties", "inbox"],
      acceptedWorkTypes: employee.acceptedWorkTypes ?? [],
      assignmentRules: employee.assignmentRules ?? {},
      knowledgeRequirements: employee.knowledgeRequirements ?? [],
      approvalRequirements: employee.requiresApproval ? ["human_approval"] : [],
      communicationPermissions: { customerFacingRequiresApproval: true },
      operatingPolicies: [],
      readinessRequirements: employee.readinessRequirements ?? [],
    })),
    dashboardDefinitions: [
      {
        dashboardId: "home_overview",
        label: "Home overview",
        widgets: [
          { id: "w_attention", componentType: "attention_queue", dataSource: "attention", label: "Needs attention" },
          { id: "w_work", componentType: "work_queue", dataSource: "work", label: "Open work" },
          { id: "w_workforce", componentType: "digital_workforce", dataSource: "workforce", label: "Digital workforce" },
          { id: "w_readiness", componentType: "readiness", dataSource: "readiness", label: "Launch readiness" },
        ],
      },
      {
        dashboardId: "performance",
        label: "Performance",
        widgets: [
          { id: "w_metrics", componentType: "metric_cards", dataSource: "metrics", label: "Key metrics" },
          { id: "w_pipeline", componentType: "pipeline", dataSource: "relationships", label: "Relationship pipeline" },
          { id: "w_subjects", componentType: "subject_summaries", dataSource: "subjects", label: "Property demand" },
          { id: "w_comms", componentType: "communication_summary", dataSource: "communications", label: "Campaign delivery" },
        ],
      },
    ],
    campaignDefinitions: (template.campaignTemplateRefs ?? []).map((id) => {
      const templateDef = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === id);
      return {
        campaignTemplateId: id,
        label: templateDef?.name ?? id,
        channel: templateDef?.channel ?? "email",
        approvalRequired: true,
        recurringOperationId: PM_RECURRING_OPERATION_DEFINITIONS.find((op) => op.campaignTemplateId === id)?.id ?? null,
      };
    }),
    knowledgeRequirements: (template.knowledgeExpectations?.requiredCategoryIds ?? []).map((categoryId) => ({
      categoryId,
      required: true,
    })),
    integrationRequirements: [
      { integrationId: "business_email", label: "Business email", requiredFor: ["campaign_delivery_email"], status: "required" },
      { integrationId: "sms", label: "SMS", status: "deferred" },
      { integrationId: "appfolio", label: "AppFolio sync", status: "deferred" },
      { integrationId: "website_ingress", label: "Website inquiries", status: "deferred" },
      { integrationId: "missed_call", label: "Missed-call handling", status: "deferred" },
    ],
    teamAndAssignmentRules: {
      approvalRequiredBeforeWorkCreation: template.followUpRuleSettings?.approvalRequiredBeforeWorkCreation ?? true,
      autoCreateFutureWork: template.followUpRuleSettings?.autoCreateFutureWork ?? false,
    },
    permissions: [
      { permissionId: "work.view", label: "View work" },
      { permissionId: "people.view", label: "View people" },
      { permissionId: "inbox.view", label: "View inbox" },
      { permissionId: "team.manage", label: "Manage team" },
      { permissionId: "performance.view", label: "View performance" },
      { permissionId: "integrations.manage", label: "Manage integrations" },
      { permissionId: "settings.manage", label: "Manage settings" },
    ],
    governancePolicies: [
      { policyId: "human_approval_customer_comms", label: "Human approval required for customer-facing communications", enforced: true },
      { policyId: "no_silent_campaign_send", label: "Campaign send is an explicit separate action", enforced: true },
      { policyId: "consent_recheck_before_send", label: "Consent and suppression rechecked before send", enforced: true },
    ],
    readinessRequirements: (template.dataRequirements ?? []).map((item) => ({
      requirementId: item.id,
      label: item.label,
      requiredForLaunch: item.requiredForLaunch !== false,
    })),
    capabilityRequirements: [
      ...template.enabledCapabilities.map((id) => ({ capabilityId: id, source: "mcbride_template" })),
      { capabilityId: "campaign_delivery_email", source: "mcbride_completion" },
      { capabilityId: "referral_attribution", source: "mcbride_completion" },
      { capabilityId: "readiness_checklist", source: "mcbride_completion" },
      { capabilityId: "sms_messaging", source: "deferred" },
      { capabilityId: "appfolio_api_sync", source: "deferred" },
      { capabilityId: "website_form_automation", source: "deferred" },
      { capabilityId: "missed_call_automation", source: "deferred" },
    ],
    unresolvedRequirements: [],
    sourceEvidence: [
      { evidenceId: "mcbride_template", kind: "client_template", ref: template.id },
      { evidenceId: "pm_package", kind: "industry_package", ref: industryPackage.id },
    ],
    metadata: {
      goldBlueprint: true,
      packageId: industryPackage.id,
      clientTemplateId: template.id,
      representation: "mcbride_reference_os",
    },
  });
}

function asRequestDefs(industryPackage) {
  return (industryPackage.requestTypes ?? []).map((entry) => ({
    requestType: entry.id ?? entry.requestType ?? entry,
    label: entry.label ?? entry.id ?? String(entry),
  }));
}

function asWorkDefs(industryPackage) {
  return (industryPackage.workTypes ?? []).map((entry) => ({
    workType: entry.id ?? entry.workType ?? entry,
    label: entry.label ?? entry.id ?? String(entry),
  }));
}

function inferArchetype(employee) {
  const blob = `${employee.id ?? ""} ${employee.name ?? ""} ${employee.displayName ?? ""} ${employee.purpose ?? ""}`.toLowerCase();
  if (blob.includes("campaign")) return "campaign_coordinator";
  if (blob.includes("owner") || blob.includes("review")) return "reviewer";
  if (blob.includes("maintenance") || blob.includes("operations")) return "operations_monitor";
  if (blob.includes("follow")) return "follow_up_specialist";
  if (blob.includes("intake") || blob.includes("prospect") || blob.includes("resident")) return "intake_specialist";
  return "coordinator";
}
