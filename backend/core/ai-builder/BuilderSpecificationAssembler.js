import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBusinessOSSpecification } from "../business-os/BusinessOSSpecification.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";
import { createBusinessModuleDefinition } from "../business-os/BusinessModuleDefinition.js";
import { resolveBusinessDisplayName, resolveIndustryLabel, scrubOwnerFacingPurpose } from "./businessIdentity.js";
import { deriveRequiredSetupSteps } from "./requiredSetupSteps.js";
import { operatingPackContract } from "./OperatingPackRegistry.js";
import { compileVerticalBlueprint } from "../platform/blueprints/VerticalBlueprintCompiler.js";
import { filterModulesForVertical } from "../platform/vertical/SurfaceInventory.js";
import {
  filterEmployeesForPurchasedPackages,
  filterModulesForPurchasedPackages,
  isFullOsPurchasedScope,
  resolvePurchasedPackageScope,
} from "../platform/packages/SalesPackageCatalog.js";
import { WorkflowEngine } from "../workflows/WorkflowEngine.js";
import {
  applyOperatingContractPatch,
  ensureEmployeeOperatingContract,
} from "./operating-contract/buildOperatingContract.js";

/**
 * Assembles a universal BusinessOSSpecification from Builder session + assembly plan.
 * Never creates vertical runtimes.
 * Blueprint package id (recommendationId) selects Gold/fixture exporters — not industry strings.
 */
export class BuilderSpecificationAssembler {
  constructor({ workflowEngine = new WorkflowEngine() } = {}) {
    this.workflowEngine = workflowEngine;
  }

  assemble({ session, assemblyPlan, nowISO = new Date().toISOString() } = {}) {
    if (!session) throw new Error("BuilderSpecificationAssembler: session required.");
    const industry = resolveIndustryLabel(session.businessSummary?.industry, "");
    const businessId = session.businessId;
    const selectedBlueprint = assemblyPlan?.selectedBlueprints?.[0] ?? null;
    const selectedBlueprintId = selectedBlueprint?.recommendationId ?? null;
    const resolvedName = resolveBusinessDisplayName(
      session.businessSummary?.businessName,
      session.appearance?.businessName,
      session.businessName,
    );

    if (selectedBlueprintId === "rec_bp_pm_gold") {
      const spec = exportMcBrideBusinessOSSpecification({
        businessId,
        generatedAt: nowISO,
      });
      const purchasedPackages = session.businessSummary?.purchasedPackages ?? [];
      const ownerEmployees = normalizeSelectedEmployees(assemblyPlan?.selectedEmployees, {
        businessName: resolveBusinessDisplayName(
          session.businessSummary?.businessName,
          session.appearance?.businessName,
          spec.businessProfile?.businessName,
        ),
        industry: "property_management",
        businessSummary: session.businessSummary,
      });
      const existingLabels = new Set(
        (spec.employeeDefinitions ?? []).map((entry) => String(entry.label ?? entry.employeeId ?? "").toLowerCase()),
      );
      const mergedEmployees = filterEmployeesForPurchasedPackages(
        [
          ...(spec.employeeDefinitions ?? []),
          ...ownerEmployees.filter((entry) => !existingLabels.has(String(entry.label ?? "").toLowerCase())),
        ],
        purchasedPackages,
      );
      const modules = ensureEntitledModules(
        filterModulesForPurchasedPackages(spec.modules ?? [], purchasedPackages),
        purchasedPackages,
      );
      const setupSteps = filterSetupStepsForPurchasedPackages(
        spec.metadata?.requiredSetupSteps ?? deriveRequiredSetupSteps(session.businessSummary?.integrationNeeds),
        purchasedPackages,
      );
      return deepFreeze({
        ok: true,
        specification: createBusinessOSSpecification({
          ...spec,
          businessId,
          modules,
          businessProfile: {
            ...spec.businessProfile,
            industry: "property_management",
            businessName: resolveBusinessDisplayName(
              session.businessSummary?.businessName,
              session.appearance?.businessName,
              spec.businessProfile.businessName,
            ),
          },
          employeeDefinitions: mergedEmployees,
          capabilityGaps: mergeCapabilityGaps(spec.capabilityGaps, assemblyPlan?.capabilityGaps),
          assumptions: [
            ...(spec.assumptions ?? []),
            ...(assemblyPlan?.assumptions ?? []).map((entry) => ({
              id: entry.assumptionId,
              text: entry.text,
            })),
          ],
          source: { kind: "ai_builder", sessionId: session.sessionId, blueprint: selectedBlueprintId },
          status: "proposed",
          metadata: {
            ...(spec.metadata ?? {}),
            builderPolicyVersion: "answers_only_v1",
            requiredSetupSteps: setupSteps,
          },
        }),
        source: selectedBlueprintId,
      });
    }

    // `rec_bp_hockey_fixture` remains readable for sessions created before the
    // Builder stopped using fixture terminology. New sessions use sports-club.
    if (selectedBlueprintId === "rec_bp_sports_club" || selectedBlueprintId === "rec_bp_hockey_fixture") {
      return buildSportsClubSpecification({
        session,
        assemblyPlan,
        businessId,
        businessName: resolvedName,
        nowISO,
        blueprintId: selectedBlueprintId,
        workflowEngine: this.workflowEngine,
      });
    }

    // Universal / marketing / dental — assemble from blueprint package metadata, not industry hard-codes.
    const name = resolvedName;
    const operatingPack = operatingPackContract(industry);
    const usesPatientTerminology = selectedBlueprintId === "rec_bp_dental_universal"
      || (selectedBlueprint?.evidence ?? []).includes("industry:dental");
    const isMarketing = selectedBlueprintId === "rec_bp_marketing_universal"
      || (selectedBlueprint?.evidence ?? []).includes("industry:marketing")
      || /marketing|agency|advertising/i.test(industry);
    const purchasedPackages = session.businessSummary?.purchasedPackages ?? [];
    const packageScope = resolvePurchasedPackageScope(purchasedPackages);
    const schedulingRequested = /\b(yes|schedule|calendar|appointment|practice|game|visit|booking)\b/i.test(
      String(session.businessSummary?.scheduling ?? ""),
    ) || Boolean(packageScope.moduleIds?.has("schedule"));
    const rawModules = [
      createBusinessModuleDefinition({ moduleId: "home", label: "Home", moduleType: "operations", navigationPriority: 1 }),
      createBusinessModuleDefinition({
        moduleId: "for_you",
        label: "Needs Attention",
        moduleType: "operations",
        navigationPriority: 2,
      }),
      createBusinessModuleDefinition({
        moduleId: "work",
        label: "Work",
        moduleType: "operations",
        navigationPriority: 3,
        roleVisibility: ["work.view"],
      }),
      createBusinessModuleDefinition({
        moduleId: "people",
        label: usesPatientTerminology ? "Patients" : "People",
        moduleType: "records",
        navigationPriority: 4,
        roleVisibility: ["people.view"],
      }),
      createBusinessModuleDefinition({
        moduleId: "pipelines",
        label: "Pipelines",
        moduleType: "records",
        navigationPriority: 5,
        roleVisibility: ["people.view"],
      }),
      ...(schedulingRequested ? [createBusinessModuleDefinition({
        moduleId: usesPatientTerminology ? "appointments" : "schedule",
        label: usesPatientTerminology ? "Appointments" : "Schedule",
        moduleType: "planning",
        navigationPriority: 6,
        capabilityIds: ["scheduling"],
      })] : []),
      ...(usesPatientTerminology ? [
        createBusinessModuleDefinition({
          moduleId: "treatment_plans",
          label: "Treatment Plans",
          moduleType: "records",
          navigationPriority: 7,
          primaryNavigationEligible: true,
        }),
        createBusinessModuleDefinition({
          moduleId: "billing",
          label: "Billing",
          moduleType: "analytics",
          navigationPriority: 8,
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
        moduleId: "integrations",
        label: "Integrations",
        moduleType: "configuration",
        navigationPriority: 90,
        roleVisibility: ["integrations.manage"],
      }),
      createBusinessModuleDefinition({
        moduleId: "settings",
        label: "Settings",
        moduleType: "configuration",
        navigationPriority: 100,
        roleVisibility: ["settings.manage"],
      }),
    ];

    const normalizedEmployees = filterEmployeesForPurchasedPackages(
      normalizeSelectedEmployees(assemblyPlan?.selectedEmployees, {
        businessName: name,
        industry: isMarketing ? "marketing_agency" : industry,
        businessSummary: session.businessSummary,
      }),
      purchasedPackages,
    );
    const workflowMapping = this.workflowEngine.recommendWorkflows({
      businessSummary: { ...session.businessSummary, industry: isMarketing ? "marketing_agency" : industry },
      businessId,
    }).businessOsMapping;
    const installedPack = operatingPack.pack;
    const modules = ensureEntitledModules(
      filterModulesForPurchasedPackages(
        filterModulesForVertical(rawModules, {
          industry: isMarketing ? "marketing_agency" : industry,
          operatingPackId: installedPack?.packId,
        }),
        purchasedPackages,
      ),
      purchasedPackages,
    );

    const spec = createBusinessOSSpecification({
      specificationId: `bos_builder_${session.sessionId}`,
      businessId,
      status: "proposed",
      generatedAt: nowISO,
      businessProfile: {
        businessName: name,
        industry: isMarketing ? "marketing_agency" : (industry || "general"),
        services: session.businessSummary?.services ?? [],
        customerTypes: session.businessSummary?.customerTypes ?? [],
        goals: session.businessSummary?.goals ?? [],
        painPoints: session.businessSummary?.painPoints ?? [],
      },
      terminology: {
        operatingSystemTitle: `${name} Operating System`,
        presentation: {
          BusinessSubject: usesPatientTerminology ? "Patient record" : "Business record",
          Party: usesPatientTerminology ? "Patient" : "Person",
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
      subjectDefinitions: usesPatientTerminology
        ? [
          { subjectType: "patient_chart", label: "Patient chart", keyAttributes: ["displayName"] },
          { subjectType: "treatment_plan", label: "Treatment plan", keyAttributes: ["status"] },
        ]
        : [{ subjectType: "business_record", label: "Business record", keyAttributes: ["displayName"] }],
      workDefinitions: mergeDefinitions([
        { workType: "intake_review", label: "Intake review" },
        { workType: "follow_up", label: "Follow-up" },
      ], workflowMapping.workDefinitions, "workType"),
      requestDefinitions: workflowMapping.requestDefinitions,
      pipelineDefinitions: installedPack?.pipelines ?? [],
      workflowDefinitions: workflowMapping.workflowDefinitions,
      employeeDefinitions: normalizedEmployees,
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
          deniedModules: usesPatientTerminology ? ["billing", "settings"] : ["settings"],
        },
      ],
      dashboardDefinitions: [buildOperatingDashboard({
        label: usesPatientTerminology ? "Practice overview" : "Home overview",
        operatingPack: installedPack,
        includesSchedule: schedulingRequested,
      })],
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
      // Only require channels that can operate today. SMS/voice/Meta stay deferred gaps — never fake "required".
      integrationRequirements: buildHonestIntegrationRequirements(session.businessSummary, { isMarketing }),
      capabilityRequirements: [
        { capabilityId: "work_queue" },
        { capabilityId: "digital_workforce" },
        { capabilityId: "approved_knowledge" },
        { capabilityId: "readiness_checklist" },
        ...(usesPatientTerminology ? [{ capabilityId: "scheduling" }] : []),
      ],
      capabilityGaps: assemblyPlan?.capabilityGaps ?? [],
      assumptions: (assemblyPlan?.assumptions ?? []).map((entry) => ({
        id: entry.assumptionId,
        text: entry.text,
      })),
      readinessRequirements: [
        { requirementId: "team_invited", label: "Invite your team", requiredForLaunch: true },
        { requirementId: "knowledge_started", label: "Add approved knowledge", requiredForLaunch: true },
        ...filterSetupStepsForPurchasedPackages(
          deriveRequiredSetupSteps(session.businessSummary?.integrationNeeds ?? ["business_email"]),
          purchasedPackages,
        ).map((stepId) => ({
          requirementId: stepId,
          label: setupStepLabel(stepId),
          requiredForLaunch: true,
        })),
      ],
      governancePolicies: [
        { policyId: "human_approval_customer_comms", label: "Customer-facing messages require approval", enforced: true },
      ],
      source: {
        kind: "ai_builder",
        sessionId: session.sessionId,
        blueprint: selectedBlueprintId ?? "universal_assembly",
      },
      metadata: deepFreeze({
        builderPolicyVersion: "answers_only_v1",
        operatingPackId: operatingPack.pack?.packId ?? null,
        operatingPackVersion: operatingPack.pack?.version ?? null,
        operatingPackLifecycle: operatingPack.pack?.lifecycle ?? null,
        optionalGrowthChannels: operatingPack.sharedCapabilities
          .filter((entry) => ["google_ads", "seo", "meta_ads"].includes(entry.capabilityId))
          .map((entry) => entry.capabilityId),
        automationDefinitions: workflowMapping.automationHints,
        workflowPolicies: {
          approvals: workflowMapping.approvalPolicies,
          escalations: workflowMapping.escalationPolicies,
        },
        requiredSetupSteps: filterSetupStepsForPurchasedPackages(
          deriveRequiredSetupSteps(session.businessSummary?.integrationNeeds ?? ["business_email"]),
          purchasedPackages,
        ),
        // Validated vertical blueprint (config install — never codegen).
        verticalBlueprint: (() => {
          const compiled = compileVerticalBlueprint({
            vertical: industry,
            integrations: (session.businessSummary?.integrationNeeds ?? []).map(String),
          });
          return compiled.ok ? compiled.blueprint : { ok: false, errors: compiled.errors };
        })(),
      }),
      provenance: {
        assembler: "BuilderSpecificationAssembler",
        blueprintId: selectedBlueprintId,
        industry,
        arbitraryCodegen: false,
      },
    });

    return deepFreeze({
      ok: true,
      specification: spec,
      source: selectedBlueprintId ?? "universal_assembly",
    });
  }
}

/**
 * Sports is a reusable capability pack, not a pre-made hockey tenant. The
 * Builder derives the installed operating model from the owner's confirmed
 * answers and records those inputs in the specification for later review.
 */
function buildSportsClubSpecification({
  session,
  assemblyPlan,
  businessId,
  businessName,
  nowISO,
  blueprintId,
  workflowEngine,
} = {}) {
  const answers = Array.isArray(session?.answers) ? session.answers : [];
  const answer = (id) => String(answers.find((entry) => entry?.questionId === id)?.answer ?? "").trim();
  const corpus = answers.map((entry) => String(entry?.answer ?? "")).join("\n").toLowerCase();
  const includeScouting = /scout|opponent|video review/.test(corpus);
  const includeFundraising = /fundrais|sponsor/.test(corpus);
  const includePracticePlans = /practice|drill|workout|training/.test(corpus);
  const integrationNeeds = session?.businessSummary?.integrationNeeds ?? [];
  const purchasedPackages = session?.businessSummary?.purchasedPackages ?? [];
  const employees = filterEmployeesForPurchasedPackages(
    normalizeSelectedEmployees(assemblyPlan?.selectedEmployees, {
      businessName,
      industry: "sports",
      businessSummary: session?.businessSummary,
    }),
    purchasedPackages,
  );
  const operatingPack = operatingPackContract("sports").pack;
  const workflowMapping = workflowEngine.recommendWorkflows({
    businessSummary: { ...session.businessSummary, industry: "sports" },
    businessId,
  }).businessOsMapping;

  const rawModules = [
    createBusinessModuleDefinition({ moduleId: "home", label: "Club HQ", moduleType: "operations", navigationPriority: 1, iconName: "home" }),
    createBusinessModuleDefinition({ moduleId: "teams", label: "Teams", moduleType: "records", navigationPriority: 2, capabilityIds: ["subject_import"], subjectTypes: ["team"], iconName: "users" }),
    createBusinessModuleDefinition({ moduleId: "players", label: "Players & Families", moduleType: "records", navigationPriority: 3, capabilityIds: ["crm_import"], subjectTypes: ["player"], iconName: "users" }),
    createBusinessModuleDefinition({ moduleId: "schedule", label: "Schedule", moduleType: "planning", navigationPriority: 4, capabilityIds: ["scheduling"], subjectTypes: ["game", "tournament"], iconName: "calendar" }),
    ...(includePracticePlans ? [
      createBusinessModuleDefinition({ moduleId: "practices", label: "Practice Plans", moduleType: "planning", navigationPriority: 5, capabilityIds: ["scheduling", "approved_knowledge"], subjectTypes: ["practice"], iconName: "clipboard-list" }),
      createBusinessModuleDefinition({ moduleId: "drills", label: "Drill Library", moduleType: "knowledge", navigationPriority: 6, capabilityIds: ["approved_knowledge"], subjectTypes: ["drill"], iconName: "book" }),
    ] : []),
    ...(includeScouting ? [
      createBusinessModuleDefinition({ moduleId: "scouting", label: "Scouting", moduleType: "records", navigationPriority: 7, capabilityIds: ["scouting_reports"], subjectTypes: ["scouting_report"], iconName: "target" }),
    ] : []),
    createBusinessModuleDefinition({ moduleId: "work", label: "Work", moduleType: "operations", navigationPriority: 20, capabilityIds: ["work_queue"], iconName: "inbox" }),
    createBusinessModuleDefinition({ moduleId: "digital_workforce", label: "AI Team", moduleType: "workforce", navigationPriority: 30, capabilityIds: ["digital_workforce"], iconName: "users" }),
    createBusinessModuleDefinition({ moduleId: "knowledge", label: "Knowledge", moduleType: "knowledge", navigationPriority: 40, capabilityIds: ["approved_knowledge"], iconName: "book" }),
    createBusinessModuleDefinition({ moduleId: "integrations", label: "Integrations", moduleType: "configuration", navigationPriority: 90, roleVisibility: ["integrations.manage"], iconName: "link" }),
    createBusinessModuleDefinition({ moduleId: "reports", label: "Reports", moduleType: "analytics", navigationPriority: 50, capabilityIds: ["relationship_operations_intelligence"], iconName: "chart" }),
    createBusinessModuleDefinition({ moduleId: "settings", label: "Settings", moduleType: "configuration", navigationPriority: 100, roleVisibility: ["settings.manage"], iconName: "settings" }),
  ];
  const modules = ensureEntitledModules(
    filterModulesForPurchasedPackages(rawModules, purchasedPackages),
    purchasedPackages,
  );
  const setupSteps = filterSetupStepsForPurchasedPackages(
    deriveRequiredSetupSteps(integrationNeeds),
    purchasedPackages,
  );

  const visibleToEveryone = modules.map((module) => module.moduleId);
  const spec = createBusinessOSSpecification({
    specificationId: `bos_builder_${session.sessionId}`,
    businessId,
    status: "proposed",
    generatedAt: nowISO,
    businessProfile: {
      businessName,
      industry: "sports",
      subIndustry: answer("q_industry") || "sports_club",
      services: session.businessSummary?.services ?? [],
      customerTypes: session.businessSummary?.customerTypes ?? [],
      goals: session.businessSummary?.goals ?? [],
      painPoints: session.businessSummary?.painPoints ?? [],
    },
    terminology: {
      operatingSystemTitle: `${businessName} Operating System`,
      presentation: {
        BusinessSubject: "Club record",
        Party: "Player, parent, or staff member",
        Work: "Club work",
        team: "Team",
        player: "Player",
        practice: "Practice plan",
        drill: "Drill",
        scouting_report: "Scouting report",
      },
    },
    modules,
    navigation: {
      primaryItems: modules.filter((module) => module.primaryNavigationEligible).map((module) => ({ moduleId: module.moduleId, label: module.label })),
      maximumPrimaryItems: 8,
      overflowBehavior: "more",
    },
    subjectDefinitions: [
      { subjectType: "team", label: "Team", keyAttributes: ["name", "ageGroup"] },
      { subjectType: "player", label: "Player", keyAttributes: ["displayName", "position"] },
      { subjectType: "game", label: "Game", keyAttributes: ["opponent", "startAt"] },
      { subjectType: "tournament", label: "Tournament", keyAttributes: ["name", "startAt"] },
      ...(includePracticePlans ? [
        { subjectType: "practice", label: "Practice plan", keyAttributes: ["date", "team"] },
        { subjectType: "drill", label: "Drill", keyAttributes: ["name", "skillFocus"] },
      ] : []),
      ...(includeScouting ? [{ subjectType: "scouting_report", label: "Scouting report", keyAttributes: ["opponent", "date"] }] : []),
    ],
    relationshipDefinitions: [
      { relationshipType: "PLAYER", label: "Player" },
      { relationshipType: "PARENT", label: "Parent" },
      { relationshipType: "COACH", label: "Coach" },
      { relationshipType: "MEMBER_OF", label: "Member of team" },
    ],
    workDefinitions: mergeDefinitions([
      { workType: "schedule_coordination", label: "Schedule coordination" },
      ...(includePracticePlans ? [{ workType: "practice_prep", label: "Practice preparation" }] : []),
      ...(includeScouting ? [{ workType: "scouting_follow_up", label: "Scouting follow-up" }] : []),
      ...(includeFundraising ? [{ workType: "sponsor_follow_up", label: "Sponsor follow-up" }] : []),
    ], workflowMapping.workDefinitions, "workType"),
    requestDefinitions: workflowMapping.requestDefinitions,
    pipelineDefinitions: operatingPack.pipelines,
    workflowDefinitions: workflowMapping.workflowDefinitions,
    employeeDefinitions: employees,
    roleDefinitions: [
      { roleId: "club_owner", label: "Club owner", membershipRole: "OWNER", moduleVisibility: visibleToEveryone, permissions: ["*"] },
      { roleId: "club_manager", label: "Club manager", membershipRole: "MANAGER", moduleVisibility: modules.filter((module) => module.moduleId !== "settings").map((module) => module.moduleId), permissions: ["work.view", "work.manage", "people.view", "team.manage"] },
      { roleId: "coach", label: "Coach", membershipRole: "EMPLOYEE", moduleVisibility: ["home", "teams", "players", "schedule", "practices", "drills", "work", "knowledge"].filter((id) => modules.some((module) => module.moduleId === id)), permissions: ["work.view", "people.view"] },
    ],
    dashboardDefinitions: [buildOperatingDashboard({
      label: "Club HQ",
      operatingPack,
      includesSchedule: modules.some((module) => module.moduleId === "schedule"),
    })],
    knowledgeRequirements: [
      ...(includePracticePlans ? [{ categoryId: "CLUB_DRILL_LIBRARY", required: true }, { categoryId: "COACHING_CURRICULUM", required: true }] : []),
      { categoryId: "CLUB_POLICIES", required: true },
    ],
    integrationRequirements: buildHonestIntegrationRequirements({ integrationNeeds }, { isMarketing: false }),
    capabilityRequirements: [
      { capabilityId: "work_queue" }, { capabilityId: "digital_workforce" }, { capabilityId: "approved_knowledge" }, { capabilityId: "scheduling" }, { capabilityId: "subject_import" },
    ],
    capabilityGaps: assemblyPlan?.capabilityGaps ?? [],
    readinessRequirements: [
      { requirementId: "team_invited", label: "Invite your club team", requiredForLaunch: true },
      { requirementId: "knowledge_started", label: includePracticePlans ? "Add coaching curriculum and drills" : "Add approved club knowledge", requiredForLaunch: true },
      { requirementId: "roster_loaded", label: "Add teams and players", requiredForLaunch: true },
      ...setupSteps.map((stepId) => ({ requirementId: stepId, label: setupStepLabel(stepId), requiredForLaunch: true })),
    ],
    governancePolicies: [{ policyId: "human_approval_parent_comms", label: "Parent-facing messages require approval", enforced: true }],
    source: { kind: "ai_builder", sessionId: session.sessionId, blueprint: blueprintId },
    metadata: {
      builderPolicyVersion: "answers_only_v1",
      generatedFromConfirmedAnswers: true,
      requiredSetupSteps: setupSteps,
      operatingPackId: operatingPack.packId,
      operatingPackVersion: operatingPack.version,
      automationDefinitions: workflowMapping.automationHints,
      workflowPolicies: {
        approvals: workflowMapping.approvalPolicies,
        escalations: workflowMapping.escalationPolicies,
      },
      builderInputs: {
        services: answer("q_services"),
        scheduling: answer("q_scheduling"),
        communications: answer("q_communications"),
        documents: answer("q_documents"),
      },
    },
    provenance: { assembler: "BuilderSpecificationAssembler", blueprintId, industry: "sports", fixture: false },
  });
  return deepFreeze({ ok: true, specification: spec, source: blueprintId });
}

const OPERABLE_INTEGRATION_IDS = new Set([
  "business_email",
  "email",
  "sms",
  "sms_channel",
  "text",
  "phone",
  "voice",
  "voice_channel",
  "calendar",
  "meta",
  "meta_lead_ads",
  "facebook",
  "fb",
]);
const DEFERRED_INTEGRATION_IDS = new Set([
  "accounting",
  "document_storage",
  "documents",
  "property_management_system",
  "pms",
  "payroll",
]);

function mergeDefinitions(base = [], additions = [], key) {
  const byId = new Map();
  for (const entry of [...base, ...additions]) {
    const id = String(entry?.[key] ?? "");
    if (id && !byId.has(id)) byId.set(id, entry);
  }
  return [...byId.values()];
}

/** Ensure package-entitled modules exist even when a vertical pack omitted them. */
function ensureEntitledModules(modules = [], purchasedPackages = []) {
  const scope = resolvePurchasedPackageScope(purchasedPackages);
  if (scope.fullOs || !scope.moduleIds) return modules;
  const byId = new Map((modules ?? []).map((module) => [String(module.moduleId), module]));
  const ensure = (moduleId, factory) => {
    if (!scope.moduleIds.has(moduleId) || byId.has(moduleId)) return;
    // people entitlement may already be satisfied by sports `players`
    if (moduleId === "people" && (byId.has("players") || byId.has("people"))) return;
    byId.set(moduleId, factory());
  };
  ensure("home", () => createBusinessModuleDefinition({
    moduleId: "home", label: "Home", moduleType: "operations", navigationPriority: 1,
  }));
  ensure("for_you", () => createBusinessModuleDefinition({
    moduleId: "for_you", label: "Needs Attention", moduleType: "operations", navigationPriority: 2,
  }));
  ensure("people", () => createBusinessModuleDefinition({
    moduleId: "people", label: "People", moduleType: "records", navigationPriority: 3, roleVisibility: ["people.view"],
  }));
  ensure("pipelines", () => createBusinessModuleDefinition({
    moduleId: "pipelines", label: "Pipelines", moduleType: "records", navigationPriority: 4, roleVisibility: ["people.view"],
  }));
  ensure("work", () => createBusinessModuleDefinition({
    moduleId: "work", label: "Work", moduleType: "operations", navigationPriority: 5, roleVisibility: ["work.view"],
  }));
  ensure("knowledge", () => createBusinessModuleDefinition({
    moduleId: "knowledge", label: "Knowledge", moduleType: "knowledge", navigationPriority: 60,
  }));
  ensure("integrations", () => createBusinessModuleDefinition({
    moduleId: "integrations",
    label: "Integrations",
    moduleType: "configuration",
    navigationPriority: 90,
    roleVisibility: ["integrations.manage"],
  }));
  ensure("settings", () => createBusinessModuleDefinition({
    moduleId: "settings",
    label: "Settings",
    moduleType: "configuration",
    navigationPriority: 100,
    roleVisibility: ["settings.manage"],
  }));
  ensure("digital_workforce", () => createBusinessModuleDefinition({
    moduleId: "digital_workforce", label: "Digital Workforce", moduleType: "workforce", navigationPriority: 50,
  }));
  ensure("schedule", () => createBusinessModuleDefinition({
    moduleId: "schedule", label: "Schedule", moduleType: "planning", navigationPriority: 6, capabilityIds: ["scheduling"],
  }));
  return [...byId.values()];
}

/** Map checklist step ids → Launch mission / package capability gates. */
const SETUP_STEP_MISSION_GATES = Object.freeze({
  email: "customer_email_send",
  calendar: "calendar_scheduling",
  sms: "sms_send",
  a2p_registration: "sms_send",
  voice: "voice_calls",
  meta_ads: "meta_lead_intake",
  meta_lead_ads: "meta_lead_intake",
  google_ads: null,
  google_search_console: null,
});

function filterSetupStepsForPurchasedPackages(steps = [], purchasedPackages = []) {
  if (isFullOsPurchasedScope(purchasedPackages)) return steps;
  const scope = resolvePurchasedPackageScope(purchasedPackages);
  if (!scope.launchMissionIds) return steps;
  return (steps ?? []).filter((stepId) => {
    const gate = SETUP_STEP_MISSION_GATES[String(stepId)];
    if (gate === undefined) return true;
    if (gate === null) return false;
    return scope.launchMissionIds.has(gate);
  });
}

function buildOperatingDashboard({ label, operatingPack = null, includesSchedule = false } = {}) {
  const widgets = [
    { id: "w_attention", componentType: "attention_queue", dataSource: "attention", label: "Needs attention" },
    { id: "w_work", componentType: "work_queue", dataSource: "work", label: "Open work" },
    { id: "w_workforce", componentType: "digital_workforce", dataSource: "workforce", label: "Digital workforce" },
    { id: "w_workflows", componentType: "operational_alerts", dataSource: "workflow_health", label: "Workflow health" },
  ];
  if (operatingPack?.pipelines?.length) {
    widgets.push({ id: "w_pipeline", componentType: "pipeline", dataSource: "pipelines", label: "Pipelines" });
  }
  if (includesSchedule) {
    widgets.push({ id: "w_schedule", componentType: "calendar_deadlines", dataSource: "calendar", label: "Schedule" });
  }
  if (operatingPack?.dashboardSignals?.includes("communications_waiting") || operatingPack?.dashboardSignals?.includes("parent_messages_waiting")) {
    widgets.push({ id: "w_comms", componentType: "communication_summary", dataSource: "communications", label: "Communications" });
  }
  return {
    dashboardId: "home_overview",
    label,
    widgets,
  };
}

function normalizeSelectedEmployees(selectedEmployees = [], { businessName, industry, businessSummary = null } = {}) {
  return (selectedEmployees ?? []).map((entry, index) => {
    const archetypeEvidence = (entry.evidence ?? []).find((item) => String(item).startsWith("archetype:"));
    const archetypeId = archetypeEvidence
      ? String(archetypeEvidence).replace("archetype:", "")
      : (entry.payload?.employee?.archetypeId ?? entry.payload?.archetype?.archetypeId ?? "coordinator");
    const fromPayload = entry.payload?.employee?.purpose
      ?? entry.payload?.archetype?.purpose
      ?? null;
    const connectionDependencies =
      String(archetypeId) === "facebook_lead_specialist"
        ? ["meta_lead_ads"]
        : String(archetypeId) === "ai_caller"
          ? ["voice_channel"]
          : String(archetypeId) === "scheduler"
            ? ["calendar"]
            : ["business_email"];
    const automationPath = entry.payload?.employee?.automationPath ?? null;
    const trigger = entry.payload?.employee?.trigger ?? null;
    const base = {
      employeeId: `emp_${index}_${String(archetypeId).slice(0, 24)}`,
      label: entry.label,
      archetypeId,
      purpose: scrubOwnerFacingPurpose(fromPayload ?? entry.why, {
        businessName,
        industry,
        roleLabel: entry.label,
      }),
      // Sports uses Players & Families rather than the universal People
      // workspace. Keep the employee's declared scope aligned with the
      // modules that this specification actually installs.
      applicableModules: ["work", "digital_workforce", industry === "sports" ? "players" : "people"],
      communicationPermissions: { customerFacingRequiresApproval: true },
      approvalRequirements: ["human_approval"],
      prohibitedActions: ["autonomous_customer_send"],
      readinessState: "needs_knowledge",
      connectionDependencies,
      honestyNote: null,
    };
    const { _operatingContractMeta, ...withContract } = ensureEmployeeOperatingContract(base, {
      industry,
      discoverySummary: businessSummary,
    });
    if (!automationPath) return withContract;
    const patched = applyOperatingContractPatch({
      employee: withContract,
      industry,
      patch: {
        automationPath: { ...automationPath, customized: true },
        ...(trigger ? { trigger } : {}),
      },
    });
    return {
      ...withContract,
      operatingContract: patched.contract,
    };
  });
}

function buildHonestIntegrationRequirements(businessSummary = {}, { isMarketing = false } = {}) {
  const requested = Array.isArray(businessSummary?.integrationNeeds)
    ? businessSummary.integrationNeeds
    : ["business_email"];
  const out = [];
  const seen = new Set();
  for (const raw of requested) {
    const id = String(raw).toLowerCase().replace(/\s+/g, "_");
    if (seen.has(id)) continue;
    seen.add(id);
    if (DEFERRED_INTEGRATION_IDS.has(id) || (!OPERABLE_INTEGRATION_IDS.has(id) && id !== "business_email")) {
      if (id === "business_email" || OPERABLE_INTEGRATION_IDS.has(id)) {
        out.push({ integrationId: "business_email", label: "Business email", status: "required" });
      } else {
        out.push({
          integrationId: id,
          label: String(raw),
          status: "deferred",
        });
      }
      continue;
    }
    out.push({
      integrationId: id === "email" ? "business_email" : id,
      label: integrationLabel(id),
      status: "required",
    });
  }
  if (!out.some((entry) => entry.integrationId === "business_email" && entry.status === "required")) {
    out.unshift({ integrationId: "business_email", label: "Business email", status: "required" });
  }
  if (isMarketing) {
    // Marketing OS never requires property software.
    return deepFreeze(out.filter((entry) => entry.integrationId !== "property_management_system"));
  }
  return deepFreeze(out);
}

function integrationLabel(id) {
  const normalized = String(id).toLowerCase();
  if (normalized === "email" || normalized === "business_email") return "Business email";
  if (normalized === "calendar") return "Google Calendar";
  if (normalized === "sms_channel" || normalized === "sms") return "Text messaging";
  if (normalized === "voice_channel" || normalized === "voice" || normalized === "phone") return "Phone";
  if (normalized === "meta_lead_ads" || normalized === "facebook") return "Meta Lead Forms";
  return String(id).replace(/_/g, " ");
}

function setupStepLabel(stepId) {
  const labels = {
    email: "Connect business email",
    calendar: "Connect Google Calendar",
    sms: "Connect text messaging",
    voice: "Connect phone",
    a2p_registration: "Complete Twilio A2P registration",
  };
  return labels[String(stepId)] ?? String(stepId);
}

function mergeCapabilityGaps(primary = [], secondary = []) {
  const byId = new Map();
  for (const gap of [...(primary ?? []), ...(secondary ?? [])]) {
    const id = String(gap.gapId ?? gap.id ?? gap.label ?? JSON.stringify(gap));
    if (!byId.has(id)) byId.set(id, gap);
  }
  return [...byId.values()];
}
