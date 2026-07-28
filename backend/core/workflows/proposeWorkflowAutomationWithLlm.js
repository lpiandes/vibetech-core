/**
 * LLM-backed Zapier-style workflow proposer with deterministic fallback.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createLlmProvider, llmIsLiveAvailable } from "../providers/createLlmProvider.js";
import {
  TRIGGER_TYPES,
  ACTION_TYPES,
  CONDITION_FIELDS,
  CONDITION_OPS,
  normalizeWorkflow,
} from "./WorkflowAutomationStore.js";
import { proposeWorkflowAutomationChange } from "./proposeWorkflowAutomationChange.js";

export async function proposeWorkflowAutomationWithLlm({
  instruction = "",
  currentWorkflow = null,
  pipelines = [],
  workflows = [],
  llmProvider = null,
  forceDeterministic = false,
} = {}) {
  const text = String(instruction ?? "").trim();
  if (!text) {
    return deepFreeze({ ok: false, reason: "instruction_required" });
  }

  if (!forceDeterministic && (llmProvider || llmIsLiveAvailable())) {
    try {
      const provider = llmProvider || createLlmProvider({ preferLive: true });
      const llmResult = await proposeViaLlm({
        provider,
        instruction: text,
        currentWorkflow,
        pipelines,
        workflows,
      });
      if (llmResult.ok) return deepFreeze(llmResult);
    } catch {
      /* fall through */
    }
  }

  return deepFreeze(
    proposeWorkflowAutomationChange({
      instruction: text,
      currentWorkflow,
      pipelines,
      workflows,
    }),
  );
}

async function proposeViaLlm({
  provider,
  instruction,
  currentWorkflow,
  pipelines,
  workflows,
}) {
  const prompt = [
    "You edit Zapier/HighLevel-style business automations.",
    "Return ONLY valid JSON with keys: summary (string), proposedWorkflow (object).",
    "proposedWorkflow shape:",
    JSON.stringify({
      id: "keep existing id if provided",
      name: "string",
      status: "live|off",
      description: "string",
      trigger: {
        type: TRIGGER_TYPES.map((t) => t.id),
        config: { pipelineId: "optional", stageId: "optional" },
      },
      steps: [
        {
          type: "action",
          action: ACTION_TYPES.map((a) => a.id),
          params: {},
        },
        {
          type: "condition",
          logic: "and|or",
          rules: [{ field: CONDITION_FIELDS.map((f) => f.id), op: CONDITION_OPS.map((o) => o.id), value: "" }],
          thenSteps: [],
          elseSteps: [],
        },
      ],
    }),
    "Pipelines:",
    JSON.stringify(pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      stages: (p.stages || []).map((s) => ({ id: s.id, label: s.label })),
    }))),
    "Other automations (for run_workflow):",
    JSON.stringify((workflows || []).map((w) => ({ id: w.id, name: w.name }))),
    "Current automation (edit this; keep id):",
    JSON.stringify(currentWorkflow || null),
    `Owner instruction: ${instruction}`,
  ].join("\n");

  const raw = await provider.generate(prompt, { json: true, temperature: 0.15 });
  const rawStr = String(raw);
  if (rawStr.includes("LIVE MODE REQUESTED") || rawStr.includes("DEMO DRAFT") || rawStr.includes("demo_placeholder")) {
    return { ok: false, reason: "llm_unavailable" };
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJsonObject(rawStr));
  } catch {
    return { ok: false, reason: "invalid_llm_json" };
  }

  if (!parsed?.proposedWorkflow) {
    return { ok: false, reason: "missing_proposed_workflow" };
  }

  const proposed = normalizeWorkflow({
    ...parsed.proposedWorkflow,
    id: currentWorkflow?.id || parsed.proposedWorkflow.id,
  });

  return {
    ok: true,
    source: "llm",
    summary: String(parsed.summary || "Updated automation from your instruction."),
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
    proposedWorkflow: proposed,
  };
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  return text.slice(start, end + 1);
}
