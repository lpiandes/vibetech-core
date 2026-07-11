import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBusinessOSSpecification } from "../business-os/BusinessOSSpecification.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";
import { createHockeyTravelClubSpecification } from "../business-os/fixtures/HockeyTravelClubSpecification.js";
import { discoveryProgress } from "./BusinessDiscoveryQuestionEngine.js";
import { BusinessCapabilityGapAnalyzer } from "./BusinessCapabilityGapAnalyzer.js";

function answerMap(answers = []) {
  const map = new Map();
  for (const entry of answers) map.set(entry.questionId, entry.answer);
  return map;
}

function asList(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value == null || value === "") return [];
  return String(value).split(/[,;]/).map((part) => part.trim()).filter(Boolean);
}

/**
 * Builds a first Business OS proposal from discovery answers + evidence.
 * Progressive: does not require every question.
 */
export class BusinessOSProposalService {
  constructor({ gapAnalyzer = new BusinessCapabilityGapAnalyzer() } = {}) {
    this.gapAnalyzer = gapAnalyzer;
  }

  proposeFromSession(session, { nowISO = new Date().toISOString() } = {}) {
    const progress = discoveryProgress({ answers: session.answers });
    const answers = answerMap(session.answers);
    const industry = String(answers.get("industry") ?? "").toLowerCase();
    const businessName = String(answers.get("company_name") ?? session.businessName ?? "New Business");

    // Reuse gold / fixture blueprints when discovery clearly matches.
    if (/property|real estate|leasing|mcbride/.test(industry) || /property|leasing/.test(String(answers.get("services") ?? ""))) {
      const spec = exportMcBrideBusinessOSSpecification({
        businessId: session.businessId,
        generatedAt: nowISO,
      });
      return this.#wrap(session, {
        ...spec,
        businessProfile: {
          ...spec.businessProfile,
          businessName,
        },
        status: "proposed",
        generatedAt: nowISO,
        updatedAt: nowISO,
      }, progress, nowISO);
    }

    if (/hockey|sports|travel club/.test(industry) || /hockey|drill|scouting/.test(String(answers.get("important_records") ?? ""))) {
      const spec = createHockeyTravelClubSpecification({
        businessId: session.businessId,
        generatedAt: nowISO,
      });
      return this.#wrap(session, {
        ...spec,
        businessProfile: {
          ...spec.businessProfile,
          businessName,
        },
        status: "proposed",
      }, progress, nowISO);
    }

    const records = asList(answers.get("important_records"));
    const customerTypes = asList(answers.get("customer_types"));
    const services = asList(answers.get("services"));
    const channels = asList(answers.get("channels"));
    const gaps = this.gapAnalyzer.analyzeNeeds([
      ...asList(answers.get("digital_workforce")).map((label) => ({ requestedOutcome: label, archetypeId: guessArchetype(label) })),
      ...asList(answers.get("launch_priorities")).map((label) => ({ requestedOutcome: label })),
    ]);

    const modules = [
      mod("home", "Home", "operations", 1),
      mod("people", terminologyLabel(answers, "Party", "People"), "records", 2),
      ...records.slice(0, 5).map((label, index) => mod(slug(label), label, "records", 3 + index, {
        subjectTypes: [slug(label)],
      })),
      mod("work", "Work Queue", "operations", 20),
      mod("inbox", "Inbox", "communications", 21),
      mod("digital_workforce", "Digital Workforce", "workforce", 22),
      mod("knowledge", "Knowledge", "knowledge", 23),
      mod("reports", "Reports", "analytics", 24),
      mod("settings", "Settings", "configuration", 25, { primaryNavigationEligible: false }),
    ];

    const spec = createBusinessOSSpecification({
      specificationId: `bos_builder_${session.sessionId}`,
      businessId: session.businessId,
      status: "proposed",
      generatedAt: nowISO,
      businessProfile: {
        businessName,
        industry: industry || "general",
        services,
        customerTypes,
        channels,
        goals: asList(answers.get("launch_priorities")),
        painPoints: asList(answers.get("pain_points")),
        currentSystems: asList(answers.get("current_systems")),
        terminologyPreferences: parseTerminology(answers.get("terminology")),
      },
      terminology: {
        operatingSystemTitle: `${businessName} Operating System`,
        presentation: {
          BusinessSubject: terminologyLabel(answers, "BusinessSubject", "Record"),
          Party: terminologyLabel(answers, "Party", "Person"),
          Work: terminologyLabel(answers, "Work", "Work"),
        },
      },
      modules,
      navigation: {
        primaryItems: modules.filter((module) => module.primaryNavigationEligible !== false).map((module) => ({
          moduleId: module.moduleId,
          label: module.label,
        })),
        maximumPrimaryItems: 8,
        overflowBehavior: "more",
        secondaryItemsByModule: {},
        utilityItems: [],
        roleOverrides: {},
      },
      subjectDefinitions: records.map((label) => ({
        subjectType: slug(label),
        label,
        keyAttributes: ["displayName"],
      })),
      relationshipDefinitions: customerTypes.map((label) => ({
        relationshipType: slug(label).toUpperCase(),
        label,
      })),
      requestDefinitions: asList(answers.get("incoming_requests")).map((label) => ({
        requestType: slug(label).toUpperCase(),
        label,
      })),
      workDefinitions: [
        { workType: "follow_up", label: "Follow-up" },
        { workType: "review", label: "Review" },
      ],
      employeeDefinitions: gaps.resolutions
        .filter((entry) => entry.availability === "supported" || entry.capabilityId)
        .slice(0, 0)
        .concat(defaultEmployeesFromAnswers(answers)),
      dashboardDefinitions: [
        {
          dashboardId: "home",
          label: "Home",
          widgets: [
            { id: "w_attention", componentType: "attention_queue", dataSource: "attention", label: "Needs attention" },
            { id: "w_work", componentType: "work_queue", dataSource: "work", label: "Work" },
            { id: "w_workforce", componentType: "digital_workforce", dataSource: "workforce", label: "Digital workforce" },
          ],
        },
      ],
      campaignDefinitions: /yes|newsletter|campaign/i.test(String(answers.get("marketing") ?? ""))
        ? [{ campaignTemplateId: "general_newsletter", label: "Newsletter", channel: "email", approvalRequired: true }]
        : [],
      knowledgeRequirements: asList(answers.get("knowledge")).map((label) => ({ categoryId: slug(label).toUpperCase(), required: true })),
      integrationRequirements: [
        { integrationId: "business_email", label: "Business email", status: channels.includes("email") || channels.length === 0 ? "required" : "optional" },
        ...(/sms/i.test(String(answers.get("channels") ?? "")) ? [{ integrationId: "sms", label: "SMS", status: "deferred" }] : []),
      ],
      governancePolicies: [
        { policyId: "human_approval_customer_comms", label: "Customer-facing communications require approval", enforced: true },
      ],
      capabilityRequirements: [
        { capabilityId: "work_queue" },
        { capabilityId: "digital_workforce" },
        { capabilityId: "approved_knowledge" },
        { capabilityId: "communications_inbox" },
        ...(/sms/i.test(String(answers.get("channels") ?? "")) ? [{ capabilityId: "sms_messaging" }] : []),
      ],
      unresolvedRequirements: [
        ...progress.readyForInitialProposal ? [] : [{ id: "more_discovery", question: "Continue discovery to raise confidence." }],
        ...gaps.proposals.map((proposal) => ({
          id: proposal.proposalId,
          question: `Platform capability needed: ${proposal.requestedOutcome}`,
        })),
      ],
      sourceEvidence: (session.evidence ?? []).map((entry) => ({
        evidenceId: entry.evidenceId,
        kind: entry.kind,
        ref: entry.label,
      })),
      metadata: {
        builderSessionId: session.sessionId,
        capabilityProposals: gaps.proposals,
      },
    });

    return this.#wrap(session, spec, progress, nowISO, gaps.proposals);
  }

  #wrap(session, spec, progress, nowISO, proposals = []) {
    const specification = createBusinessOSSpecification({
      ...spec,
      status: "proposed",
      generatedAt: nowISO,
      updatedAt: nowISO,
    });
    return deepFreeze({
      ok: true,
      sessionId: session.sessionId,
      progress,
      specification,
      capabilityProposals: proposals.length ? proposals : (specification.metadata?.capabilityProposals ?? []),
    });
  }
}

function mod(moduleId, label, moduleType, navigationPriority, extra = {}) {
  return {
    moduleId,
    label,
    description: label,
    moduleType,
    capabilityIds: [],
    primaryNavigationEligible: extra.primaryNavigationEligible !== false,
    navigationPriority,
    roleVisibility: [],
    emptyState: `No ${label.toLowerCase()} yet.`,
    ...extra,
  };
}

function slug(value) {
  return String(value ?? "item").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "item";
}

function terminologyLabel(answers, concept, fallback) {
  const parsed = parseTerminology(answers.get("terminology"));
  return parsed[concept] ?? fallback;
}

function parseTerminology(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  const out = {};
  for (const part of String(value).split(/[,;]/)) {
    const [key, label] = part.split(/[:=]/).map((entry) => entry.trim());
    if (key && label) out[key] = label;
  }
  return out;
}

function guessArchetype(label) {
  const blob = String(label).toLowerCase();
  if (blob.includes("schedul")) return "scheduler";
  if (blob.includes("follow")) return "follow_up_specialist";
  if (blob.includes("campaign")) return "campaign_coordinator";
  if (blob.includes("research") || blob.includes("scout")) return "researcher";
  if (blob.includes("analy")) return "analyst";
  return "coordinator";
}

function defaultEmployeesFromAnswers(answers) {
  const requested = asList(answers.get("digital_workforce"));
  if (!requested.length) {
    return [{
      employeeId: "ops_coordinator",
      label: "Operations Coordinator",
      archetypeId: "coordinator",
      purpose: "Coordinate incoming work and follow-ups.",
      applicableModules: ["work", "people", "inbox"],
      communicationPermissions: { customerFacingRequiresApproval: true },
      approvalRequirements: ["human_approval"],
    }];
  }
  return requested.slice(0, 4).map((label) => ({
    employeeId: `emp_${slug(label)}`,
    label,
    archetypeId: guessArchetype(label),
    purpose: `${label} support`,
    applicableModules: ["work", "digital_workforce"],
    communicationPermissions: { customerFacingRequiresApproval: true },
    approvalRequirements: ["human_approval"],
  }));
}
