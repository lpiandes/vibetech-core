/**
 * demo-review-view.js
 *
 * Tiny local demonstration:
 * - Instantiates the existing DraftGenerator
 * - Runs ReviewWorkViewAdapter
 * - Prints the final ReviewWorkResponse business contract
 *
 * No frontend. No API. No networking.
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

import { ReviewWorkViewAdapter } from "./ReviewWorkViewAdapter.js";

function getRepoRootFromBackendCwd() {
  // Derive repo root from this file location so it works regardless of CWD.
  // This file lives at: backend/core/views/demo-review-view.js
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  // scriptDir -> backend/core/views -> backend/core -> backend -> repoRoot
  return path.resolve(scriptDir, "..", "..", "..");
}

async function main() {
  const repoRoot = getRepoRootFromBackendCwd();

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

  const runtimePipeline = new RuntimePipeline({
    situationEvaluator: new SituationEvaluator(),
    decisionResolver: new DecisionResolver(),
    actionPlanner: new ActionPlanner(),
  });

  const promptLoader = new PromptLoader();
  const promptBuilder = new PromptBuilder();

  // Provider demo mode to keep output deterministic.
  const llmProvider = new OpenAIProvider({ mode: "demo" });

  const draftGenerator = new DraftGenerator({
    runtimePipeline,
    promptLoader,
    promptBuilder,
    llmProvider,
  });

  const adapter = new ReviewWorkViewAdapter({ DraftGenerator: draftGenerator });

  const reviewWorkResponse = await adapter.toReviewWorkResponse({
    runtimeInput,
    employeeFolderPath,
    attorneyNote,
    clientName,
    DraftGenerator: draftGenerator,
  });

  console.log(JSON.stringify(reviewWorkResponse, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

