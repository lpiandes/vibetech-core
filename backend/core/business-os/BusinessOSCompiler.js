import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { validateBusinessOSSpecification } from "./BusinessOSSpecificationValidator.js";
import { getDefaultBusinessOSCapabilityRegistry } from "./BusinessOSCapabilityRegistry.js";
import {
  createBusinessOSInstallationPlan,
  createInstallAction,
} from "./BusinessOSInstallationPlan.js";
import { buildBusinessOSNavigation } from "./BusinessOSNavigationBuilder.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clientExplanation(text) {
  return String(text)
    .replace(/BusinessSubject/g, "business record")
    .replace(/BusinessGraph/g, "relationship map")
    .replace(/capabilityId/g, "capability")
    .replace(/INSTALL_/g, "")
    .replace(/_/g, " ");
}

/**
 * Compiles a BusinessOSSpecification into a deterministic installation plan.
 * Never mutates canonical business state.
 */
export class BusinessOSCompiler {
  constructor({ capabilityRegistry = getDefaultBusinessOSCapabilityRegistry() } = {}) {
    this.capabilityRegistry = capabilityRegistry;
  }

  compile(specification, { nowISO = new Date().toISOString(), existingInstallation = null } = {}) {
    const validation = validateBusinessOSSpecification(specification, {
      capabilityRegistry: this.capabilityRegistry,
      allowUnresolved: true,
    });
    if (!validation.ok) {
      const prohibited = validation.errors.find((entry) => entry.code === "prohibited_capability");
      return deepFreeze({
        ok: false,
        reason: prohibited ? "prohibited_capability" : "validation_failed",
        validation,
        prohibited: prohibited ?? null,
        plan: null,
      });
    }

    const actions = [];
    const capabilityResolutions = [];
    const warnings = [...validation.warnings];
    const risks = [];
    const unresolvedQuestions = asArray(specification.unresolvedRequirements).map((entry) => ({
      id: entry.id ?? entry.requirementId,
      question: entry.question ?? entry.label ?? String(entry.id),
    }));

    const packageId = specification.metadata?.packageId ?? null;
    if (packageId) {
      actions.push(createInstallAction({
        specification,
        type: "INSTALL_INDUSTRY_PACKAGE",
        targetId: packageId,
        label: "Install industry foundation",
        explanation: clientExplanation(`Use the reusable ${packageId} foundation for this business.`),
        payload: { packageId, clientTemplateId: specification.metadata?.clientTemplateId ?? null },
      }));
    }

    for (const requirement of asArray(specification.capabilityRequirements)) {
      const classified = this.capabilityRegistry.classifyRequirement(requirement);
      capabilityResolutions.push(classified);

      if (classified.prohibited) {
        return deepFreeze({
          ok: false,
          reason: "prohibited_capability",
          validation,
          prohibited: classified,
          plan: null,
        });
      }

      if (classified.deferred) {
        actions.push(createInstallAction({
          specification,
          type: "RECORD_DEFERRED_CAPABILITY",
          targetId: classified.capabilityId,
          label: `Defer ${classified.label}`,
          explanation: clientExplanation(`${classified.label} is not available for this launch and will stay marked as deferred.`),
          deferred: true,
          payload: { capabilityId: classified.capabilityId },
        }));
        continue;
      }

      if (classified.availability === "missing_reusable_capability") {
        actions.push(createInstallAction({
          specification,
          type: "REQUIRE_PLATFORM_CAPABILITY",
          targetId: classified.capabilityId || requirement.capabilityId || "unknown",
          label: "Needs a reusable platform capability",
          explanation: clientExplanation(`VIBETech cannot safely support "${classified.label}" yet. This becomes a platform capability proposal.`),
          risk: "high",
          payload: {
            requestedOutcome: classified.label,
            capabilityId: classified.capabilityId,
            proposalRequired: true,
          },
        }));
        continue;
      }

      if (classified.availability === "missing_setup" || classified.availability === "supported_with_configuration") {
        for (const setupId of classified.setupRequirements ?? []) {
          actions.push(createInstallAction({
            specification,
            type: "REQUIRE_SETUP",
            targetId: `${classified.capabilityId}:${setupId}`,
            label: `Setup required: ${setupId}`,
            explanation: clientExplanation(`${classified.label} needs ${setupId.replace(/_/g, " ")} before it can run.`),
            requiresSetup: true,
            payload: { capabilityId: classified.capabilityId, setupId },
          }));
        }
      }

      actions.push(createInstallAction({
        specification,
        type: "ENABLE_CAPABILITY",
        targetId: classified.capabilityId,
        label: `Enable ${classified.label}`,
        explanation: clientExplanation(`Turn on ${classified.label} using existing platform components.`),
        requiresSetup: classified.availability === "supported_with_configuration",
        payload: {
          capabilityId: classified.capabilityId,
          packageFeatureIds: classified.packageFeatureIds,
        },
      }));
    }

    for (const module of asArray(specification.modules)) {
      actions.push(createInstallAction({
        specification,
        type: "CONFIGURE_MODULE",
        targetId: module.moduleId,
        label: `Configure ${module.label}`,
        explanation: clientExplanation(`Add the ${module.label} workspace for day-to-day work.`),
        payload: {
          moduleId: module.moduleId,
          label: module.label,
          moduleType: module.moduleType,
          capabilityIds: module.capabilityIds ?? [],
        },
      }));
    }

    const navigation = buildBusinessOSNavigation({
      modules: specification.modules,
      navigation: specification.navigation,
    });
    actions.push(createInstallAction({
      specification,
      type: "CONFIGURE_NAVIGATION",
      targetId: "primary_navigation",
      label: "Configure navigation",
      explanation: clientExplanation("Set primary workspaces with overflow into More when needed. Digital employees stay under Team."),
      payload: { navigation },
    }));

    for (const subject of asArray(specification.subjectDefinitions)) {
      actions.push(createInstallAction({
        specification,
        type: "REGISTER_SUBJECT_TYPE",
        targetId: subject.subjectType,
        label: `Track ${subject.label}`,
        explanation: clientExplanation(`Record ${subject.label} using the universal business record model.`),
        payload: subject,
      }));
    }

    for (const relationship of asArray(specification.relationshipDefinitions)) {
      actions.push(createInstallAction({
        specification,
        type: "REGISTER_RELATIONSHIP_TYPE",
        targetId: relationship.relationshipType,
        label: `Recognize ${relationship.label}`,
        explanation: clientExplanation(`Classify people as ${relationship.label} when evidence supports it.`),
        payload: relationship,
      }));
    }

    for (const request of asArray(specification.requestDefinitions)) {
      actions.push(createInstallAction({
        specification,
        type: "REGISTER_REQUEST_TYPE",
        targetId: request.requestType,
        label: `Accept ${request.label}`,
        explanation: clientExplanation(`Route ${request.label} into the request queue.`),
        payload: request,
      }));
    }

    for (const work of asArray(specification.workDefinitions)) {
      actions.push(createInstallAction({
        specification,
        type: "REGISTER_WORK_TYPE",
        targetId: work.workType,
        label: `Support ${work.label}`,
        explanation: clientExplanation(`Create ${work.label} items in the work queue.`),
        payload: work,
      }));
    }

    for (const employee of asArray(specification.employeeDefinitions)) {
      actions.push(createInstallAction({
        specification,
        type: "INSTALL_EMPLOYEE",
        targetId: employee.employeeId,
        label: `Add ${employee.label}`,
        explanation: clientExplanation(`${employee.label} joins Digital Workforce and works inside related modules.`),
        payload: employee,
      }));
    }

    if (Object.keys(specification.teamAndAssignmentRules ?? {}).length) {
      actions.push(createInstallAction({
        specification,
        type: "CONFIGURE_ASSIGNMENT_RULE",
        targetId: "assignment_rules",
        label: "Configure assignment rules",
        explanation: clientExplanation("Set how work is owned and when human approval is required."),
        payload: specification.teamAndAssignmentRules,
      }));
    }

    for (const dashboard of asArray(specification.dashboardDefinitions)) {
      actions.push(createInstallAction({
        specification,
        type: "INSTALL_DASHBOARD",
        targetId: dashboard.dashboardId,
        label: `Install ${dashboard.label}`,
        explanation: clientExplanation(`Show ${dashboard.label} using approved dashboard widgets only.`),
        payload: dashboard,
      }));
    }

    for (const campaign of asArray(specification.campaignDefinitions)) {
      actions.push(createInstallAction({
        specification,
        type: "INSTALL_CAMPAIGN_TEMPLATE",
        targetId: campaign.campaignTemplateId,
        label: `Install ${campaign.label}`,
        explanation: clientExplanation(`Prepare ${campaign.label} for review and approval before any send.`),
        payload: campaign,
      }));
    }

    for (const knowledge of asArray(specification.knowledgeRequirements)) {
      actions.push(createInstallAction({
        specification,
        type: "REGISTER_KNOWLEDGE_REQUIREMENT",
        targetId: knowledge.categoryId,
        label: `Require knowledge: ${knowledge.categoryId}`,
        explanation: clientExplanation("Approved knowledge is required before guided drafts can use it."),
        payload: knowledge,
      }));
    }

    for (const integration of asArray(specification.integrationRequirements)) {
      const deferred = String(integration.status) === "deferred";
      actions.push(createInstallAction({
        specification,
        type: deferred ? "RECORD_DEFERRED_CAPABILITY" : "REGISTER_INTEGRATION_REQUIREMENT",
        targetId: integration.integrationId,
        label: deferred ? `Defer ${integration.label}` : `Connect ${integration.label}`,
        explanation: clientExplanation(deferred
          ? `${integration.label} stays deferred for this launch.`
          : `${integration.label} must be connected before related features can run.`),
        deferred,
        requiresSetup: !deferred,
        payload: integration,
      }));
    }

    for (const permission of asArray(specification.permissions)) {
      actions.push(createInstallAction({
        specification,
        type: "CONFIGURE_PERMISSION",
        targetId: permission.permissionId,
        label: `Permission: ${permission.label}`,
        explanation: clientExplanation(`Control access with ${permission.label}.`),
        payload: permission,
      }));
    }

    if (unresolvedQuestions.length) {
      actions.push(createInstallAction({
        specification,
        type: "REVIEW",
        targetId: "unresolved_questions",
        label: "Review open questions",
        explanation: clientExplanation("Some questions still need answers before the operating system is complete."),
        risk: "medium",
        payload: { unresolvedQuestions },
      }));
    }

    if (existingInstallation?.specificationContentHash === specification.contentHash) {
      warnings.push({
        code: "no_destructive_change",
        message: "Specification matches the installed version. Install actions are idempotent no-ops.",
      });
    }

    const plan = createBusinessOSInstallationPlan({
      planId: `plan_${specification.specificationId}_v${specification.specificationVersion}`,
      specification,
      actions,
      capabilityResolutions,
      warnings,
      risks,
      unresolvedQuestions,
      dryRun: true,
      createdAt: nowISO,
    });

    return deepFreeze({
      ok: true,
      validation,
      plan,
    });
  }
}
