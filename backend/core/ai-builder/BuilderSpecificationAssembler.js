import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBusinessOSSpecification } from "../business-os/BusinessOSSpecification.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";
import { createHockeyTravelClubSpecification } from "../business-os/fixtures/HockeyTravelClubSpecification.js";
import { createBusinessModuleDefinition } from "../business-os/BusinessModuleDefinition.js";

/**
 * Assembles a universal BusinessOSSpecification from Builder session + assembly plan.
 * Never creates vertical runtimes.
 */
export class BuilderSpecificationAssembler {
  assemble({ session, assemblyPlan, nowISO = new Date().toISOString() } = {}) {
    if (!session) throw new Error("BuilderSpecificationAssembler: session required.");
    const industry = String(session.businessSummary?.industry ?? "");
    const businessId = session.businessId;
    const selectedBlueprintId = assemblyPlan?.selectedBlueprints?.[0]?.recommendationId ?? null;

    if (industry === "property_management" || selectedBlueprintId === "rec_bp_pm_gold") {
      const spec = exportMcBrideBusinessOSSpecification({
        businessId,
        generatedAt: nowISO,
      });
      return deepFreeze({
        ok: true,
        specification: createBusinessOSSpecification({
          ...spec,
          businessId,
          businessProfile: {
            ...spec.businessProfile,
            businessName: session.businessSummary?.businessName ?? spec.businessProfile.businessName,
          },
          capabilityGaps: assemblyPlan?.capabilityGaps ?? spec.capabilityGaps,
          assumptions: [
            ...(spec.assumptions ?? []),
            ...(assemblyPlan?.assumptions ?? []).map((entry) => ({
              id: entry.assumptionId,
              text: entry.text,
            })),
          ],
          source: { kind: "ai_builder", sessionId: session.sessionId, blueprint: "mcbride_gold" },
          status: "proposed",
        }),
        source: "mcbride_gold",
      });
    }

    if (industry === "sports" || selectedBlueprintId === "rec_bp_hockey_fixture") {
      const spec = createHockeyTravelClubSpecification({ businessId, generatedAt: nowISO });
      return deepFreeze({
        ok: true,
        specification: createBusinessOSSpecification({
          ...spec,
          businessId,
          businessProfile: {
            ...spec.businessProfile,
            businessName: session.businessSummary?.businessName ?? spec.businessProfile.businessName,
          },
          capabilityGaps: assemblyPlan?.capabilityGaps ?? [],
          source: { kind: "ai_builder", sessionId: session.sessionId, blueprint: "hockey_fixture" },
          status: "proposed",
        }),
        source: "hockey_fixture",
      });
    }

    // Dental / generic universal assembly
    const name = session.businessSummary?.businessName ?? "Your business";
    const isDental = industry === "dental";
    const modules = [
      createBusinessModuleDefinition({ moduleId: "home", label: "Home", moduleType: "operations", navigationPriority: 1 }),
      createBusinessModuleDefinition({
        moduleId: "work",
        label: "Work",
        moduleType: "operations",
        navigationPriority: 2,
        roleVisibility: ["work.view"],
      }),
      createBusinessModuleDefinition({
        moduleId: "people",
        label: isDental ? "Patients" : "People",
        moduleType: "records",
        navigationPriority: 3,
        roleVisibility: ["people.view"],
      }),
      createBusinessModuleDefinition({
        moduleId: isDental ? "appointments" : "schedule",
        label: isDental ? "Appointments" : "Schedule",
        moduleType: "planning",
        navigationPriority: 4,
        capabilityIds: ["scheduling"],
      }),
      ...(isDental ? [
        createBusinessModuleDefinition({
          moduleId: "treatment_plans",
          label: "Treatment Plans",
          moduleType: "records",
          navigationPriority: 5,
          primaryNavigationEligible: true,
        }),
        createBusinessModuleDefinition({
          moduleId: "billing",
          label: "Billing",
          moduleType: "analytics",
          navigationPriority: 6,
          roleVisibility: ["performance.view"],
        }),
      ] : []),
      createBusinessModuleDefinition({
        moduleId: "digital_workforce",
        label: "Digital Workforce",
        moduleType: "workforce",
        navigationPriority: 50,
      }),
      createBusinessModuleDefinition({
        moduleId: "knowledge",
        label: "Knowledge",
        moduleType: "knowledge",
        navigationPriority: 60,
      }),
      createBusinessModuleDefinition({
        moduleId: "settings",
        label: "Settings",
        moduleType: "configuration",
        navigationPriority: 100,
        roleVisibility: ["settings.manage"],
      }),
    ];

    const employees = (assemblyPlan?.selectedEmployees ?? []).map((entry, index) => ({
      employeeId: `emp_${index}_${entry.recommendationId}`.slice(0, 64),
      label: entry.label,
      archetypeId: String(entry.evidence?.find?.((item) => String(item).startsWith("archetype:")) ?? "coordinator")
        .replace("archetype:", "") || "coordinator",
      purpose: entry.why,
      applicableModules: ["work", "digital_workforce", "people"],
      communicationPermissions: { customerFacingRequiresApproval: true },
      approvalRequirements: ["human_approval"],
      prohibitedActions: ["autonomous_customer_send"],
      readinessState: "needs_knowledge",
    }));

    // Fix archetype extraction
    const normalizedEmployees = (assemblyPlan?.selectedEmployees ?? []).map((entry, index) => {
      const archetypeEvidence = (entry.evidence ?? []).find((item) => String(item).startsWith("archetype:"));
      return {
        employeeId: `emp_${index}`,
        label: entry.label,
        archetypeId: archetypeEvidence ? String(archetypeEvidence).replace("archetype:", "") : "coordinator",
        purpose: entry.why,
        applicableModules: ["work", "digital_workforce", "people"],
        communicationPermissions: { customerFacingRequiresApproval: true },
        approvalRequirements: ["human_approval"],
        prohibitedActions: ["autonomous_customer_send"],
        readinessState: "needs_knowledge",
      };
    });

    const spec = createBusinessOSSpecification({
      specificationId: `bos_builder_${session.sessionId}`,
      businessId,
      status: "proposed",
      generatedAt: nowISO,
      businessProfile: {
        businessName: name,
        industry: industry || "general",
        services: session.businessSummary?.services ?? [],
        customerTypes: session.businessSummary?.customerTypes ?? [],
        goals: session.businessSummary?.goals ?? [],
        painPoints: session.businessSummary?.painPoints ?? [],
      },
      terminology: {
        operatingSystemTitle: `${name} Operating System`,
        presentation: {
          BusinessSubject: isDental ? "Patient record" : "Business record",
          Party: isDental ? "Patient" : "Person",
          Work: "Work",
        },
      },
      modules,
      navigation: {
        primaryItems: modules
          .filter((module) => module.primaryNavigationEligible)
          .map((module) => ({ moduleId: module.moduleId, label: module.label })),
        maximumPrimaryItems: 7,
        overflowBehavior: "more",
      },
      subjectDefinitions: isDental
        ? [
          { subjectType: "patient_chart", label: "Patient chart", keyAttributes: ["displayName"] },
          { subjectType: "treatment_plan", label: "Treatment plan", keyAttributes: ["status"] },
        ]
        : [{ subjectType: "business_record", label: "Business record", keyAttributes: ["displayName"] }],
      workDefinitions: [
        { workType: "intake_review", label: "Intake review" },
        { workType: "follow_up", label: "Follow-up" },
      ],
      employeeDefinitions: normalizedEmployees.length ? normalizedEmployees : employees,
      dashboardDefinitions: [
        {
          dashboardId: "home_overview",
          label: "Home overview",
          widgets: [
            { id: "w_attention", componentType: "attention_queue", dataSource: "attention", label: "Needs attention" },
            { id: "w_work", componentType: "work_queue", dataSource: "work", label: "Open work" },
            { id: "w_workforce", componentType: "digital_workforce", dataSource: "workforce", label: "Digital workforce" },
          ],
        },
      ],
      roleDefinitions: [
        {
          roleId: "owner",
          label: "Owner",
          membershipRole: "OWNER",
          moduleVisibility: modules.map((module) => module.moduleId),
          permissions: ["*"],
        },
        {
          roleId: "manager",
          label: "Manager",
          membershipRole: "MANAGER",
          moduleVisibility: modules.filter((module) => module.moduleId !== "settings").map((module) => module.moduleId),
          permissions: ["work.view", "work.manage", "people.view", "inbox.view"],
        },
        {
          roleId: "employee",
          label: "Team member",
          membershipRole: "EMPLOYEE",
          moduleVisibility: ["home", "work", "people", "knowledge"],
          permissions: ["work.view", "people.view"],
          deniedModules: isDental ? ["billing", "settings"] : ["settings"],
        },
      ],
      accessRequestPolicies: [
        {
          policyId: "module_access_request",
          requestKinds: ["module_access", "role_upgrade", "temporary_access"],
          requiresApproval: true,
          autoApprove: false,
          approverRoles: ["OWNER", "ADMIN"],
        },
      ],
      knowledgeRequirements: [{ categoryId: "OPERATING_POLICIES", required: true }],
      integrationRequirements: (session.businessSummary?.integrationNeeds ?? ["business_email"]).map((id) => ({
        integrationId: String(id).toLowerCase().replace(/\s+/g, "_"),
        label: String(id),
        status: "required",
      })),
      capabilityRequirements: [
        { capabilityId: "work_queue" },
        { capabilityId: "digital_workforce" },
        { capabilityId: "approved_knowledge" },
        { capabilityId: "readiness_checklist" },
        ...(isDental ? [{ capabilityId: "scheduling" }] : []),
      ],
      capabilityGaps: assemblyPlan?.capabilityGaps ?? [],
      assumptions: (assemblyPlan?.assumptions ?? []).map((entry) => ({
        id: entry.assumptionId,
        text: entry.text,
      })),
      readinessRequirements: [
        { requirementId: "team_invited", label: "Invite your team", requiredForLaunch: true },
        { requirementId: "knowledge_started", label: "Add approved knowledge", requiredForLaunch: true },
      ],
      governancePolicies: [
        { policyId: "human_approval_customer_comms", label: "Customer-facing messages require approval", enforced: true },
      ],
      source: { kind: "ai_builder", sessionId: session.sessionId, blueprint: "universal_assembly" },
      provenance: { assembler: "BuilderSpecificationAssembler", industry },
    });

    return deepFreeze({ ok: true, specification: spec, source: "universal_assembly" });
  }
}
