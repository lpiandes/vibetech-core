import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBusinessOSSpecification } from "../business-os/BusinessOSSpecification.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";
import { createHockeyTravelClubSpecification } from "../business-os/fixtures/HockeyTravelClubSpecification.js";
import { createBusinessModuleDefinition } from "../business-os/BusinessModuleDefinition.js";
import { resolveBusinessDisplayName, resolveIndustryLabel, scrubOwnerFacingPurpose } from "./businessIdentity.js";
import { deriveRequiredSetupSteps } from "./requiredSetupSteps.js";

/**
 * Assembles a universal BusinessOSSpecification from Builder session + assembly plan.
 * Never creates vertical runtimes.
 * Blueprint package id (recommendationId) selects Gold/fixture exporters — not industry strings.
 */
export class BuilderSpecificationAssembler {
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
      const ownerEmployees = normalizeSelectedEmployees(assemblyPlan?.selectedEmployees, {
        businessName: resolveBusinessDisplayName(
          session.businessSummary?.businessName,
          session.appearance?.businessName,
          spec.businessProfile?.businessName,
        ),
        industry: "property_management",
      });
      const existingLabels = new Set(
        (spec.employeeDefinitions ?? []).map((entry) => String(entry.label ?? entry.employeeId ?? "").toLowerCase()),
      );
      const mergedEmployees = [
        ...(spec.employeeDefinitions ?? []),
        ...ownerEmployees.filter((entry) => !existingLabels.has(String(entry.label ?? "").toLowerCase())),
      ];
      return deepFreeze({
        ok: true,
        specification: createBusinessOSSpecification({
          ...spec,
          businessId,
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
        }),
        source: selectedBlueprintId,
      });
    }

    if (selectedBlueprintId === "rec_bp_hockey_fixture") {
      const spec = createHockeyTravelClubSpecification({ businessId, generatedAt: nowISO });
      return deepFreeze({
        ok: true,
        specification: createBusinessOSSpecification({
          ...spec,
          businessId,
          businessProfile: {
            ...spec.businessProfile,
            businessName: resolveBusinessDisplayName(
              session.businessSummary?.businessName,
              session.appearance?.businessName,
              spec.businessProfile.businessName,
            ),
          },
          capabilityGaps: assemblyPlan?.capabilityGaps ?? [],
          source: { kind: "ai_builder", sessionId: session.sessionId, blueprint: selectedBlueprintId },
          status: "proposed",
        }),
        source: selectedBlueprintId,
      });
    }

    // Universal / marketing / dental — assemble from blueprint package metadata, not industry hard-codes.
    const name = resolvedName;
    const usesPatientTerminology = selectedBlueprintId === "rec_bp_dental_universal"
      || (selectedBlueprint?.evidence ?? []).includes("industry:dental");
    const isMarketing = selectedBlueprintId === "rec_bp_marketing_universal"
      || (selectedBlueprint?.evidence ?? []).includes("industry:marketing")
      || /marketing|agency|advertising/i.test(industry);
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
        label: usesPatientTerminology ? "Patients" : "People",
        moduleType: "records",
        navigationPriority: 3,
        roleVisibility: ["people.view"],
      }),
      createBusinessModuleDefinition({
        moduleId: usesPatientTerminology ? "appointments" : "schedule",
        label: usesPatientTerminology ? "Appointments" : "Schedule",
        moduleType: "planning",
        navigationPriority: 4,
        capabilityIds: ["scheduling"],
      }),
      ...(usesPatientTerminology ? [
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

    const normalizedEmployees = normalizeSelectedEmployees(assemblyPlan?.selectedEmployees, {
      businessName: name,
      industry: isMarketing ? "marketing_agency" : industry,
    });

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
      workDefinitions: [
        { workType: "intake_review", label: "Intake review" },
        { workType: "follow_up", label: "Follow-up" },
      ],
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
        ...deriveRequiredSetupSteps(session.businessSummary?.integrationNeeds ?? ["business_email"]).map((stepId) => ({
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
        requiredSetupSteps: deriveRequiredSetupSteps(session.businessSummary?.integrationNeeds ?? ["business_email"]),
      }),
      provenance: {
        assembler: "BuilderSpecificationAssembler",
        blueprintId: selectedBlueprintId,
        industry,
      },
    });

    return deepFreeze({
      ok: true,
      specification: spec,
      source: selectedBlueprintId ?? "universal_assembly",
    });
  }
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

function normalizeSelectedEmployees(selectedEmployees = [], { businessName, industry } = {}) {
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
    return {
      employeeId: `emp_${index}_${String(archetypeId).slice(0, 24)}`,
      label: entry.label,
      archetypeId,
      purpose: scrubOwnerFacingPurpose(fromPayload ?? entry.why, {
        businessName,
        industry,
        roleLabel: entry.label,
      }),
      applicableModules: ["work", "digital_workforce", "people"],
      communicationPermissions: { customerFacingRequiresApproval: true },
      approvalRequirements: ["human_approval"],
      prohibitedActions: ["autonomous_customer_send"],
      readinessState: "needs_knowledge",
      connectionDependencies,
      honestyNote: null,
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
  if (normalized === "meta_lead_ads" || normalized === "facebook") return "Facebook Lead Ads";
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

