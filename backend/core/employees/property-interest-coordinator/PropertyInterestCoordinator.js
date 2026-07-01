/**
 * PropertyInterestCoordinator
 *
 * Local-only Digital Employee capability:
 * - Recognizes a new property inquiry
 * - Summarizes property highlights and buyer considerations (business language)
 * - Generates a workforce-facing recommendation and creates a review task
 *
 * IMPORTANT:
 * - No providers, no networking, no CRM/email integration here.
 * - Draft generation and review-task construction are handled by existing
 *   stable orchestration primitives: DraftGenerator + ReviewWorkViewAdapter.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { ActionPlanner } from "../../runtime/ActionPlanner.js";
import { DecisionResolver } from "../../runtime/DecisionResolver.js";
import { SituationEvaluator } from "../../runtime/SituationEvaluator.js";
import { RuntimePipeline } from "../../runtime/RuntimePipeline.js";

import { PromptLoader } from "../../runtime/PromptLoader.js";
import { PromptBuilder } from "../../runtime/PromptBuilder.js";

import { OpenAIProvider } from "../../providers/OpenAIProvider.js";
import { DraftGenerator } from "../../generation/DraftGenerator.js";

import { ReviewWorkViewAdapter } from "../../views/ReviewWorkViewAdapter.js";

import { PropertyResearchCapability } from "../../capabilities/property/PropertyResearchCapability.js";

import { CompanyBrain } from "../../company/brain/CompanyBrain.js";

function repoRootFromThisFile() {
  // This file lives at:
  // backend/core/employees/property-interest-coordinator/PropertyInterestCoordinator.js
  // Repo root is: ../../../../
  const filePath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(filePath);
  return path.resolve(scriptDir, "..", "..", "..", "..");
}

function safeString(v) {
  return v === undefined || v === null ? "" : String(v);
}

function formatBuyerName(inquiry) {
  const name = safeString(inquiry?.name).trim();
  return name || "Buyer";
}

function computeDaysSince(submittedAtISO) {
  const submitted = new Date(submittedAtISO);
  if (Number.isNaN(submitted.getTime())) return 0;
  const diffMs = Date.now() - submitted.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function buildEmployeeThinkingFromCapability({
  buyerName,
  capabilityOutput,
  responsePolicy,
}) {
  const propertySummary = capabilityOutput?.propertySummary ?? "";
  const buyerFit = capabilityOutput?.buyerFit ?? "";
  const sellingPoints = Array.isArray(capabilityOutput?.sellingPoints)
    ? capabilityOutput.sellingPoints
    : [];
  const buyerConsiderations = Array.isArray(capabilityOutput?.buyerConsiderations)
    ? capabilityOutput.buyerConsiderations
    : [];
  const reasoning = capabilityOutput?.reasoning ?? "";

  const sellingPointsLine = sellingPoints.length
    ? `Key strengths: ${sellingPoints.slice(0, 3).join("; ")}.`
    : "";
  const buyerConsiderationsLine = buyerConsiderations.length
    ? `Items to confirm next: ${buyerConsiderations.slice(0, 2).join("; ")}.`
    : "";

  const responseCue = responsePolicy
    ? `Response policy: ${responsePolicy}`
    : "Response policy: prompt, professional, governance-aware guidance.";

  return [
    `${buyerName} submitted a property inquiry.`,
    propertySummary ? `Property summary: ${propertySummary}` : "",
    buyerFit ? `Buyer fit: ${buyerFit}.` : "",
    sellingPointsLine,
    buyerConsiderationsLine,
    reasoning,
    responseCue,
  ]
    .filter(Boolean)
    .join(" ");
}

export class PropertyInterestCoordinator {
  /**
   * @param {object} params
   */
  constructor() {
    // No state; deterministic local employee.
  }

  /**
   * @param {object} input
   * @param {object} input.inquiry
   * @param {object} input.property
   * @param {object} input.companyContext
   * @returns {Promise<{ reviewWork: any, employeeSummary: any }>}
   */
  async run({ inquiry, property, companyContext, runtime }) {
    const buyerName = formatBuyerName(inquiry);
    const responsePolicy = safeString(companyContext?.responsePolicy);

    // 1) Research the property + buyer intent via a reusable capability.
    const daysSince = computeDaysSince(safeString(inquiry?.submittedAt));
    const urgentFromMessage = /urgent|asap|today|immediately/i.test(safeString(inquiry?.message));
    const isUrgent = urgentFromMessage || daysSince <= 1;

    // Request business context from CompanyBrain (v1) instead of hand-assembling.
    const companyBrain = runtime ? new CompanyBrain({ runtime }) : null;
    const businessContext = companyBrain
      ? companyBrain.buildBusinessContext({
          employeeId: "emp_prop_interest",
          task: "PROPERTY_RESEARCH",
          companyId: safeString(companyContext?.companyName),
          relatedEntities: {
            property,
            buyerInquiry: inquiry,
          },
        })
      : null;

    const companyKnowledge = {
      responsePreferences: businessContext?.operationalRules?.responsePreferences ?? [responsePolicy].filter(Boolean),
      propertyShowingRules:
        businessContext?.operationalRules?.propertyShowingRules ??
        ["Confirm preferred walkthrough windows before proposing times."],
    };

    const capability = new PropertyResearchCapability();
    const capabilityOutput = capability.run({
      property,
      buyerInquiry: inquiry,
      companyKnowledge,
    });

    const employeeThinking = buildEmployeeThinkingFromCapability({
      buyerName,
      capabilityOutput,
      responsePolicy,
    });

    // 3) Create a draft request using the existing DraftGenerator.
    // Runtime inputs drive governance classification; everything stays deterministic.
    const runtimeInput = {
      attorneyNote: employeeThinking, // fed into DraftGenerator/PromptBuilder
      caseEvent: null,
      daysSinceLastClientUpdate: daysSince,
      clientRequestedUpdate: true,
      isUrgent,
      confidence: 0.78,
    };

    const repoRoot = repoRootFromThisFile();

    // Use an existing employee artifact folder for demo-only draft generation.
    // This folder must contain: prompt.md, TRAINING.md, rules.json, employee.json.
    // (The Property Interest Coordinator capability remains isolated as the orchestration/mapping layer.)
    const employeeFolderPath = path.join(repoRoot, "employees", "legal");

    const attorneyNote = [
      `Property Highlights:`,
      Array.isArray(capabilityOutput?.sellingPoints) && capabilityOutput.sellingPoints.length
        ? capabilityOutput.sellingPoints.map((p) => `- ${safeString(p)}`).join("\n")
        : "- Not specified yet.",
      ``,
      `Buyer Considerations:`,
      Array.isArray(capabilityOutput?.buyerConsiderations) && capabilityOutput.buyerConsiderations.length
        ? capabilityOutput.buyerConsiderations.map((c) => `- ${safeString(c)}`).join("\n")
        : "- Not specified yet.",
      ``,
      `Response Policy: ${responsePolicy || "Prompt, professional, governance-aware."}`,
      ``,
      `Recommended Talking Points:`,
      Array.isArray(capabilityOutput?.recommendedTalkingPoints) &&
      capabilityOutput.recommendedTalkingPoints.length
        ? capabilityOutput.recommendedTalkingPoints.map((t) => `- ${safeString(t)}`).join("\n")
        : "- Not specified yet.",
      ``,
      `Recommendation: ${employeeThinking}`,
    ].join("\n");

    const clientName = buyerName;

    const runtimePipeline = new RuntimePipeline({
      situationEvaluator: new SituationEvaluator(),
      decisionResolver: new DecisionResolver(),
      actionPlanner: new ActionPlanner(),
    });

    const promptLoader = new PromptLoader();
    const promptBuilder = new PromptBuilder();

    const llmProvider = new OpenAIProvider({ mode: "demo" });

    const draftGenerator = new DraftGenerator({
      runtimePipeline,
      promptLoader,
      promptBuilder,
      llmProvider,
    });

    const adapter = new ReviewWorkViewAdapter({ DraftGenerator: draftGenerator });

    // 4) Create the ReviewWorkResponse via the existing adapter.
    const reviewWork = await adapter.toReviewWorkResponse({
      runtimeInput,
      employeeFolderPath,
      attorneyNote,
      clientName,
    });

    // 5) Return employee summary (workforce-facing) + contract-shaped review work.
    const recommendedAction = isUrgent
      ? "Respond today with a structured buyer reply and clear next-step guidance for governance."
      : "Respond promptly with a professional reply, confirming key property details and inviting buyer preferences.";

    const confidence = Array.isArray(property?.highlights) && property.highlights.length
      ? capabilityOutput?.confidence === "High"
        ? 0.92
        : capabilityOutput?.confidence === "Medium"
          ? 0.78
          : 0.68
      : 0.68;

    return {
      reviewWork,
      employeeSummary: {
        employeeName: "Property Interest Coordinator",
        mission:
          "Recognize property inquiries, understand the property, prepare a recommendation, draft a response, and create a governance review task.",
        recommendedAction: recommendedAction,
        confidence,
      },
    };
  }
}

