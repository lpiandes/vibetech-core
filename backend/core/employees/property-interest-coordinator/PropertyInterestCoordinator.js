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

function buildEmployeeThinking({
  buyerName,
  property,
  inquiry,
  responsePolicy,
}) {
  const address = safeString(property?.address).trim();
  const city = safeString(property?.city).trim();
  const state = safeString(property?.state).trim();
  const fullAddress = [address, city, state].filter(Boolean).join(", ");

  const price = property?.price !== undefined && property?.price !== null ? safeString(property.price) : "";
  const highl = Array.isArray(property?.highlights) ? property.highlights : [];
  const cons = Array.isArray(property?.considerations) ? property.considerations : [];

  const highlightsText = highl.length ? highl.join("; ") : "Key strengths are present, but details will be confirmed in the next step.";
  const considerationsText = cons.length ? cons.join("; ") : "There are a few points to clarify with the buyer and coordinate internally.";

  const urgencyCue = /urgent|asap|today|immediately/i.test(safeString(inquiry?.message));
  const responseCue = responsePolicy
    ? `The company response policy requires prompt, professional guidance.`
    : `The response should be prompt, professional, and governance-aware.`;

  return [
    `${buyerName} submitted a property inquiry for ${fullAddress || "a specified address"}.`,
    price ? `The listed price is ${price}.` : "",
    `Based on the inquiry and property details, I recommend responding today while interest is high.`,
    `Property highlights: ${highlightsText}`,
    `Buyer considerations: ${considerationsText}`,
    responseCue,
    urgencyCue
      ? `The buyer’s message suggests urgency; prioritize a clear, next-step response.`
      : `Provide a structured reply that sets expectations and invites the buyer’s preferences.`,
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
  async run({ inquiry, property, companyContext }) {
    const buyerName = formatBuyerName(inquiry);
    const responsePolicy = safeString(companyContext?.responsePolicy);

    // 1) Recognize a new inquiry (local deterministic decision point).
    const daysSince = computeDaysSince(safeString(inquiry?.submittedAt));
    const urgentFromMessage = /urgent|asap|today|immediately/i.test(safeString(inquiry?.message));
    const isUrgent = urgentFromMessage || daysSince <= 1;

    // 2) Summarize property (highlights + considerations) into business language.
    const employeeThinking = buildEmployeeThinking({
      buyerName,
      property,
      inquiry,
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
      Array.isArray(property?.highlights) && property.highlights.length
        ? property.highlights.map((h) => `- ${safeString(h)}`).join("\n")
        : "- Not specified yet.",
      ``,
      `Buyer Considerations:`,
      Array.isArray(property?.considerations) && property.considerations.length
        ? property.considerations.map((c) => `- ${safeString(c)}`).join("\n")
        : "- Not specified yet.",
      ``,
      `Response Policy: ${responsePolicy || "Prompt, professional, governance-aware."}`,
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
      ? 0.86
      : 0.72;

    return {
      reviewWork,
      employeeSummary: {
        employeeName: "Property Interest Coordinator",
        mission:
          "Recognize property inquiries, understand the property, prepare a recommendation, draft a response, and create a governance review task.",
        recommendedAction,
        confidence,
      },
    };
  }
}

