/**
 * demo-communication.js
 *
 * Full business flow (no real providers):
 * 1) Create inquiry (website intake)
 * 2) Generate review task + draft communication
 * 3) Approve review (creates APPROVED Communication)
 * 4) Transition communication through Sent → Delivered → Opened → Replied
 *
 * Prints each transition and updated runtime communication state.
 */

import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { WebsiteInquiryAdapter } from "../intake/WebsiteInquiryAdapter.js";

import { CommunicationEngine } from "./CommunicationEngine.js";

import { ReviewWorkViewAdapter } from "../views/ReviewWorkViewAdapter.js";
import { ReviewWorkflow } from "../workflows/ReviewWorkflow.js";

import { ActionPlanner } from "../runtime/ActionPlanner.js";
import { DecisionResolver } from "../runtime/DecisionResolver.js";
import { SituationEvaluator } from "../runtime/SituationEvaluator.js";
import { RuntimePipeline } from "../runtime/RuntimePipeline.js";

import { PromptLoader } from "../runtime/PromptLoader.js";
import { PromptBuilder } from "../runtime/PromptBuilder.js";
import { OpenAIProvider } from "../providers/OpenAIProvider.js";
import { DraftGenerator } from "../generation/DraftGenerator.js";

import path from "node:path";
import { fileURLToPath } from "node:url";

function repoRootFromThisFile() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  // demo-communication.js lives at: backend/core/communication/...
  // so we go up 3 directories to reach repo root.
  return path.resolve(scriptDir, "..", "..", "..");
}

function printSection(title, value) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(value, null, 2));
}

async function buildReviewWorkflow() {
  const repoRoot = repoRootFromThisFile();
  // employeeFolderPath is provided later when creating a review task.

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

  const viewAdapter = new ReviewWorkViewAdapter({ DraftGenerator: draftGenerator });
  return new ReviewWorkflow({ ReviewWorkViewAdapter: viewAdapter });
}

async function main() {
  const runtime = new CompanyWorkspaceRuntime();
  const communicationEngine = new CommunicationEngine({ runtime });
  const reviewWorkflow = await buildReviewWorkflow();

  // 1) Create inquiry in runtime.
  const websiteAdapter = new WebsiteInquiryAdapter();
  const websitePayload = {
    runtime,
    inquiry: {
      name: "Rachael Nguyen",
      email: "rachael.nguyen@example.com",
      phone: "(555) 019-2219",
      message:
        "Hi! I’m interested in the property and would like to discuss next steps today. Can you share a good walkthrough window?",
      submittedAt: new Date().toISOString(),
      priority: "High",
    },
    property: { propertyId: "prop_68_mystic" },
    companyContext: {
      companyName: runtime.getCompany().companyName,
      officeName: runtime.getCompany().officeName,
      responsePolicy:
        runtime.getKnowledge().responsePreferences?.[0] ??
        "Respond with clear next steps and keep communications governance-ready.",
    },
  };

  const intakeResult = await websiteAdapter.intake(websitePayload);
  printSection("Intake Result", intakeResult);

  // 2) Generate a review task (and draft communication).
  const latestQueueItem = runtime.getWorkQueue().at(0);
  if (!latestQueueItem) throw new Error("Expected work queue item after intake.");

  const runtimeInput = {
    attorneyNote: "Prepare governance-ready buyer communication for approval.",
    caseEvent: null,
    daysSinceLastClientUpdate: 0,
    clientRequestedUpdate: true,
    isUrgent: true,
    confidence: 0.8,
  };

  const reviewResponse = await reviewWorkflow.createReviewTask({
    runtimeInput,
    employeeFolderPath: path.join(repoRootFromThisFile(), "employees", "legal"),
    attorneyNote: runtimeInput.attorneyNote,
    clientName: latestQueueItem.clientName,
    // New/required fields for communication linkage.
    workItemId: latestQueueItem.workItemId,
    companyRuntime: runtime,
    communicationChannel: "email",
  });
  printSection("ReviewWorkResponse (with communication draft)", reviewResponse);

  const communicationId = `comm_${latestQueueItem.workItemId}`;
  const commDraft = runtime.getCommunications().find((c) => c.communicationId === communicationId);
  printSection("Initial Communication", commDraft);

  // 3) Approve review -> APPROVED Communication
  const approved = await reviewWorkflow.applyApprovalDecision({
    workItemId: latestQueueItem.workItemId,
    decision: "APPROVE",
    companyRuntime: runtime,
    approvedBy: "Governance Reviewer",
  });
  printSection("After APPROVE (review workflow)", approved);

  const commApproved = runtime
    .getCommunications()
    .find((c) => c.communicationId === communicationId);
  printSection("Communication after approval", commApproved);

  // 4) Transition via simulated provider steps.
  const sent = communicationEngine.markSent({ communicationId });
  printSection("Communication after SENT", sent);

  const delivered = communicationEngine.markDelivered({ communicationId });
  printSection("Communication after DELIVERED", delivered);

  const opened = communicationEngine.markOpened({ communicationId });
  printSection("Communication after OPENED", opened);

  const replied = communicationEngine.markReplied({ communicationId });
  printSection("Communication after REPLIED", replied);

  console.log("\n=== Final runtime communications ===");
  console.log(JSON.stringify(runtime.getCommunications(), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

