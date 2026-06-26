/**
 * DemoRunner
 *
 * Sprint 7B / Runtime MVP demo runner.
 * - Instantiates runtime + prompt pipeline components via dependency injection.
 * - Uses the demo mode of OpenAIProvider (deterministic placeholder draft).
 * - Calls DraftGenerator to produce a demo draft.
 * - Prints ONLY:
 *   - Situation
 *   - Decision
 *   - Action
 *   - Draft
 */

import path from "node:path";

import { ActionPlanner } from "../runtime/ActionPlanner.js";
import { DecisionResolver } from "../runtime/DecisionResolver.js";
import { SituationEvaluator } from "../runtime/SituationEvaluator.js";
import { RuntimePipeline } from "../runtime/RuntimePipeline.js";

import { PromptLoader } from "../runtime/PromptLoader.js";
import { PromptBuilder } from "../runtime/PromptBuilder.js";

import { OpenAIProvider } from "../providers/OpenAIProvider.js";

import { DraftGenerator } from "../generation/DraftGenerator.js";

function getRepoRootFromBackendCwd() {
  // When running `npm run demo` inside `backend/`, CWD == backend/.
  return path.resolve(process.cwd(), "..");
}

async function main() {
  const repoRoot = getRepoRootFromBackendCwd();

  const employeeFolderPath = path.join(repoRoot, "employees", "legal");

  const attorneyNote =
    "Attorney note (demo): The matter is governed by attorney instructions. Wait for approval before any client-facing communication.";

  const runtimeInput = {
    attorneyNote,
    caseEvent: null,
    daysSinceLastClientUpdate: 21,
    clientRequestedUpdate: false,
    isUrgent: false,
    confidence: 0.8,
  };

  // Runtime MVP components (already deterministic, no AI/providers).
  const runtimePipeline = new RuntimePipeline({
    situationEvaluator: new SituationEvaluator(),
    decisionResolver: new DecisionResolver(),
    actionPlanner: new ActionPlanner(),
  });

  const promptLoader = new PromptLoader();
  const promptBuilder = new PromptBuilder();

  // Provider (demo mode by default).
  const llmProvider = new OpenAIProvider({ mode: "demo" });

  const draftGenerator = new DraftGenerator({
    runtimePipeline,
    promptLoader,
    promptBuilder,
    llmProvider,
  });

  const result = await draftGenerator.generate({
    runtimeInput,
    employeeFolderPath,
    attorneyNote,
    clientName: "Demo Client",
  });

  console.log(`Situation: ${result.runtime.situation}`);
  console.log(`Decision: ${result.runtime.decision}`);
  console.log(`Action: ${result.runtime.action}`);
  console.log(`Draft: ${result.draft}`);
}

main().catch((err) => {
  // Keep demo output limited; still fail loudly for developers.
  console.error(err);
  process.exitCode = 1;
});

