/**
 * LLM-backed automation path + trigger proposer.
 * Falls back to deterministic regex proposer when LLM unavailable/invalid.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  normalizeAutomationPath,
  PATH_STEP_TYPES,
  PATH_AUDIENCES,
} from "../operating-contract/automationPath.js";
import { proposeAutomationPathChange } from "./proposeAutomationPathChange.js";
import { compileWorkflowChainToPath } from "../compileDesiredWorkflows.js";
import { SPECIALTY_EVENT_CATALOG } from "./specialtyEventCatalog.js";
import { createLlmProvider, llmIsLiveAvailable } from "../../providers/createLlmProvider.js";

const STEP_TYPE_IDS = Object.values(PATH_STEP_TYPES);
const AUDIENCE_IDS = Object.values(PATH_AUDIENCES);

/**
 * @param {object} params
 * @param {string} params.instruction
 * @param {object} [params.contract]
 * @param {object|null} [params.schema]
 * @param {string|null} [params.industry]
 * @param {Array<{id:string,name:string,stages?:Array<{id:string,label:string}>}>} [params.pipelines]
 * @param {object} [params.llmProvider]
 * @param {boolean} [params.forceDeterministic]
 */
export async function proposeAutomationWithLlm({
  instruction = "",
  contract = {},
  schema = null,
  industry = null,
  pipelines = [],
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
        contract,
        schema,
        industry,
        pipelines,
      });
      if (llmResult.ok) return deepFreeze(llmResult);
    } catch {
      /* fall through to deterministic */
    }
  }

  const fallback = proposeAutomationPathChange({ instruction: text, contract, schema });
  if (!fallback.ok) {
    const chain = compileWorkflowChainToPath(text, { contract, schema });
    if (chain?.ok) return deepFreeze(chain);
    return fallback;
  }
  return deepFreeze({
    ...fallback,
    source: "deterministic",
    proposedTrigger: fallback.proposedTrigger ?? null,
  });
}

async function proposeViaLlm({
  provider,
  instruction,
  contract,
  schema,
  industry,
  pipelines,
}) {
  const currentPath = normalizeAutomationPath(contract.automationPath, { contract, schema });
  const prompt = buildPrompt({
    instruction,
    contract,
    industry,
    pipelines,
    currentPath,
  });

  const raw = await provider.generate(prompt, { json: true, temperature: 0.15 });
  if (String(raw).includes("LIVE MODE REQUESTED") || String(raw).includes("DEMO DRAFT") || String(raw).includes("demo_placeholder")) {
    return { ok: false, reason: "llm_unavailable" };
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJsonObject(String(raw)));
  } catch {
    return { ok: false, reason: "invalid_llm_json" };
  }

  const stepsIn = Array.isArray(parsed.automationPath?.steps)
    ? parsed.automationPath.steps
    : Array.isArray(parsed.steps)
      ? parsed.steps
      : null;
  if (!stepsIn) {
    return { ok: false, reason: "missing_steps" };
  }

  const proposedPath = normalizeAutomationPath(
    { version: 1, customized: true, steps: stepsIn },
    { contract, schema },
  );

  let proposedTrigger = null;
  if (parsed.trigger && typeof parsed.trigger === "object") {
    const eventTypes = Array.isArray(parsed.trigger.eventTypes)
      ? parsed.trigger.eventTypes.map(String).filter((id) => SPECIALTY_EVENT_CATALOG.some((e) => e.id === id))
      : [];
    proposedTrigger = {
      mode: String(parsed.trigger.mode ?? contract?.trigger?.mode ?? "manual_or_events"),
      summary: String(parsed.trigger.summary ?? contract?.trigger?.summary ?? "").trim(),
      eventTypes: eventTypes.length
        ? eventTypes
        : (contract?.trigger?.eventTypes ?? ["SPECIALTY_JOB_REQUESTED"]),
      schedule: parsed.trigger.schedule !== undefined
        ? parsed.trigger.schedule
        : contract?.trigger?.schedule ?? null,
    };
  }

  const notes = Array.isArray(parsed.notes) ? parsed.notes.map(String) : ["llm_proposal"];
  const summary = String(parsed.summary ?? (notes.join(" · ") || "Path updated")).trim();

  return {
    ok: true,
    source: "llm",
    notes,
    summary,
    proposedPath,
    proposedTrigger,
  };
}

function buildPrompt({ instruction, contract, industry, pipelines, currentPath }) {
  const pipelineLines = (pipelines ?? []).map((p) => {
    const stages = (p.stages ?? []).map((s) => s.label || s.id).join(", ");
    return `- ${p.name || p.id}${stages ? ` [${stages}]` : ""}`;
  });

  return [
    "Build or edit a business automation path from the owner instruction.",
    "Return JSON only with keys: summary (string), notes (string[]), trigger ({ mode, eventTypes, summary, schedule? } | null), automationPath ({ steps: [...] }).",
    "Step types allowed: " + STEP_TYPE_IDS.join(", "),
    "Audiences allowed: " + AUDIENCE_IDS.join(", "),
    "Event types allowed: " + SPECIALTY_EVENT_CATALOG.map((e) => `${e.id} (${e.label})`).join(", "),
    "Rules:",
    "- Do not invent step types outside the allowlist.",
    "- Email/SMS steps must set requiresApproval true.",
    "- Prefer editing existing steps when the instruction is a change; add steps when asked to add.",
    "- If the owner mentions pipeline stage changes, calendar, schedule, form, inquiry, etc., set trigger.eventTypes accordingly.",
    "- Stay vertical-agnostic: use provided industry/pipelines only as context, never assume a sport or clinic.",
    "",
    `Industry context: ${industry || "general"}`,
    `Current trigger: ${JSON.stringify(contract?.trigger ?? {})}`,
    `Current path steps: ${JSON.stringify(currentPath.steps ?? [])}`,
    `Pipelines: ${pipelineLines.length ? pipelineLines.join("\n") : "(none)"}`,
    `Scope answers: ${JSON.stringify(contract?.scope?.answers ?? {})}`,
    "",
    `Owner instruction: ${instruction}`,
  ].join("\n");
}

function extractJsonObject(text) {
  const trimmed = String(text).trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
