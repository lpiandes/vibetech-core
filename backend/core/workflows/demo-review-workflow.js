/**
 * demo-review-workflow.js
 *
 * Demonstrates the complete local journey:
 * Runtime → Generation → ReviewWorkViewAdapter → Approval → Completion
 *
 * No frontend. No APIs. No networking.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { ActionPlanner } from "../runtime/ActionPlanner.js";
import { DecisionResolver } from "../runtime/DecisionResolver.js";
import { SituationEvaluator } from "../runtime/SituationEvaluator.js";
import { RuntimePipeline } from "../runtime/RuntimePipeline.js";

import { PromptLoader } from "../runtime/PromptLoader.js";
import { PromptBuilder } from "../runtime/PromptBuilder.js";

import { OpenAIProvider } from "../providers/OpenAIProvider.js";
import { DraftGenerator } from "../generation/DraftGenerator.js";

import { ReviewWorkViewAdapter } from "../views/ReviewWorkViewAdapter.js";
import { ReviewWorkflow } from "./ReviewWorkflow.js";

function getRepoRootFromThisFile() {
  // This file lives at: backend/core/workflows/demo-review-workflow.js
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  // scriptDir -> backend/core/workflows -> backend/core -> backend -> repoRoot
  return path.resolve(scriptDir, "..", "..", "..");
}

async function buildWorkflow() {
  const repoRoot = getRepoRootFromThisFile();
  const employeeFolderPath = path.join(repoRoot, "employees", "legal");

  const runtimePipeline = new RuntimePipeline({
    situationEvaluator: new SituationEvaluator(),
    decisionResolver: new DecisionResolver(),
    actionPlanner: new ActionPlanner(),
  });

  const promptLoader = new PromptLoader();
  const promptBuilder = new PromptBuilder();

  // Demo mode keeps draft generation deterministic for local development.
  const llmProvider = new OpenAIProvider({ mode: "demo" });

  const draftGenerator = new DraftGenerator({
    runtimePipeline,
    promptLoader,
    promptBuilder,
    llmProvider,
  });

  const adapter = new ReviewWorkViewAdapter({ DraftGenerator: draftGenerator });
  return new ReviewWorkflow({ ReviewWorkViewAdapter: adapter });
}

async function runScenario({ decision }) {
  const workflow = await buildWorkflow();

  const repoRoot = getRepoRootFromThisFile();
  const employeeFolderPath = path.join(repoRoot, "employees", "legal");

  const attorneyNote =
    "Attorney note (demo): The matter is governed by attorney instructions. Wait for approval before any client-facing communication.";
  const clientName = "Demo Client";

  const runtimeInput = {
    attorneyNote,
    caseEvent: null,
    daysSinceLastClientUpdate: 21,
    clientRequestedUpdate: false,
    isUrgent: false,
    confidence: 0.8,
  };

  // 1) Create review task (Runtime → Generation → Adapter)
  const reviewResponse = await workflow.createReviewTask({
    runtimeInput,
    employeeFolderPath,
    attorneyNote,
    clientName,
  });

  console.log(`\n=== Scenario: ${decision} ===`);
  console.log("Initial ReviewWorkResponse:");
  console.log(JSON.stringify(reviewResponse, null, 2));

  // 2) Apply approval decision (in-memory only) and mark completion
  const updated = workflow.applyApprovalDecision({
    workItemId: reviewResponse?.approval?.workItemId,
    decision,
  });

  console.log("Updated ReviewWorkResponse (completed):");
  console.log(JSON.stringify(updated, null, 2));
}

async function main() {
  await runScenario({ decision: "APPROVE" });
  await runScenario({ decision: "REJECT" });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

