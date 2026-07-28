/**
 * Deterministic plain-English → Zapier-style workflow automation.
 * Works without LLM; LLM proposer wraps this as fallback.
 */
import crypto from "node:crypto";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  TRIGGER_TYPES,
  normalizeWorkflow,
  createBlankWorkflow,
} from "./WorkflowAutomationStore.js";

function sid(prefix = "step") {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function extractQuoted(text) {
  const m = String(text).match(/["“]([^"”]+)["”]|'([^']+)'/);
  return (m?.[1] || m?.[2] || "").trim();
}

function findTrigger(text) {
  const lower = text.toLowerCase();
  // Prefer explicit event phrases over action phrases like "add to pipeline"
  if (/\b(when|whenever|after|on)\b.{0,40}\b(form|website)\b|\bform\s+(is\s+)?submit|\bwebsite\s+form|\binquiry\b|\bintake\b/.test(lower)) {
    return TRIGGER_TYPES.find((t) => t.id === "form_submit");
  }
  if (/\b(when|whenever|after|on)\b.{0,40}\b(meta|facebook|fb)\b|\bmeta\s+lead|\bfacebook\s+lead|\bfb\s+lead|\binstagram\s+lead/.test(lower)) {
    return TRIGGER_TYPES.find((t) => t.id === "meta_lead");
  }
  if (/\b(when|whenever|after|on)\b.{0,40}\bimport|\blead\s+list|\bcsv\b|\buploaded\b/.test(lower)) {
    return TRIGGER_TYPES.find((t) => t.id === "contact_imported");
  }
  if (/\b(when|whenever|after|on)\b.{0,40}\b(new\s+)?contact|\bcontact\s+creat|\bperson\s+add|\badd(ed)?\s+(a\s+)?contact/.test(lower)) {
    return TRIGGER_TYPES.find((t) => t.id === "contact_created");
  }
  if (/\b(when|whenever|after|on)\b.{0,60}\b(pipeline|stage)\b|\bstage\s+(change|moved|enter)|\bmoves?\s+(to|into)\b|\bcard\s+moved/.test(lower)) {
    return TRIGGER_TYPES.find((t) => t.id === "pipeline_stage");
  }
  if (/\bmanual\b|\btest\s+run\b|\bwhen\s+i\s+run\b/.test(lower)) {
    return TRIGGER_TYPES.find((t) => t.id === "manual");
  }
  if (/\bform\b|\bwebsite\b|\bsubmitted\b/.test(lower) && !/\badd\s+to\s+(the\s+)?pipeline\b/.test(lower)) {
    return TRIGGER_TYPES.find((t) => t.id === "form_submit");
  }
  if (/\bmeta\b|\bfacebook\b|\bfb\s+lead\b/.test(lower)) {
    return TRIGGER_TYPES.find((t) => t.id === "meta_lead");
  }
  return null;
}

function findPipelineRef(text, pipelines = []) {
  const lower = text.toLowerCase();
  for (const p of pipelines) {
    const name = String(p.name || "").toLowerCase();
    if (name && lower.includes(name)) {
      let stageId = null;
      let stageLabel = null;
      for (const s of p.stages || []) {
        const label = String(s.label || "").toLowerCase();
        if (label && lower.includes(label)) {
          stageId = s.id;
          stageLabel = s.label;
          break;
        }
      }
      return { pipelineId: p.id, pipelineName: p.name, stageId, stageLabel };
    }
  }
  // Stage-only match across pipelines
  for (const p of pipelines) {
    for (const s of p.stages || []) {
      const label = String(s.label || "").toLowerCase();
      if (label && lower.includes(label)) {
        return { pipelineId: p.id, pipelineName: p.name, stageId: s.id, stageLabel: s.label };
      }
    }
  }
  return null;
}

function extractTags(text) {
  const tags = [];
  const tagMatch = text.match(/\btag(?:s|ged)?\s+(?:as\s+|with\s+)?["']?([a-z0-9_,\s-]+)["']?/i);
  if (tagMatch) {
    tags.push(...tagMatch[1].split(/[,/]| and /i).map((t) => t.trim().replace(/\s+/g, "_")).filter(Boolean));
  }
  const asMatch = text.match(/\bas\s+["']?([a-z0-9_-]+)["']?/i);
  if (asMatch && /tag|label|mark/.test(text.toLowerCase())) {
    tags.push(asMatch[1].replace(/\s+/g, "_"));
  }
  if (/vip/i.test(text)) tags.push("vip");
  if (/hot\s*lead/i.test(text)) tags.push("hot_lead");
  return [...new Set(tags.map((t) => t.toLowerCase()).filter((t) => t.length > 1 && t !== "them" && t !== "contact"))];
}

function actionStep(action, params = {}, label = "") {
  return {
    id: sid("step"),
    type: "action",
    action,
    params,
    label,
  };
}

function conditionStep({ rules, thenSteps, elseSteps = [], logic = "and" }) {
  return {
    id: sid("step"),
    type: "condition",
    logic,
    rules,
    thenSteps,
    elseSteps,
  };
}

/**
 * @param {object} params
 * @param {string} params.instruction
 * @param {object|null} [params.currentWorkflow]
 * @param {Array} [params.pipelines]
 * @param {Array} [params.workflows] - other workflows for chaining by name
 */
export function proposeWorkflowAutomationChange({
  instruction = "",
  currentWorkflow = null,
  pipelines = [],
  workflows = [],
} = {}) {
  const text = String(instruction ?? "").trim();
  if (!text) {
    return deepFreeze({ ok: false, reason: "instruction_required" });
  }

  const lower = text.toLowerCase();
  const notes = [];
  const base = currentWorkflow
    ? normalizeWorkflow(currentWorkflow)
    : createBlankWorkflow({ name: "New automation", triggerType: "form_submit" });

  let name = base.name;
  let status = base.status;
  let trigger = { ...base.trigger, config: { ...(base.trigger?.config || {}) } };
  let steps = Array.isArray(base.steps) ? base.steps.map((s) => ({ ...s })) : [];

  // Rename
  const rename = text.match(/(?:rename|call\s+it|name\s+it|title)\s+["']([^"']+)["']/i)
    || text.match(/(?:rename(?:d)?\s+to)\s+(.+)$/i);
  if (rename?.[1]) {
    name = rename[1].trim().slice(0, 80);
    notes.push(`Renamed to “${name}”`);
  }

  // Live / off
  if (/\b(go\s+)?live\b|turn\s+on|activate|enable/.test(lower) && !/preview|don't|dont|not/.test(lower)) {
    status = "live";
    notes.push("Set LIVE");
  }
  if (/\b(turn\s+off|deactivate|disable|pause)\b/.test(lower)) {
    status = "off";
    notes.push("Set OFF");
  }

  // Trigger
  const trig = findTrigger(text);
  if (trig) {
    trigger = {
      type: trig.id,
      eventType: trig.eventType,
      label: trig.label,
      config: { ...trigger.config },
    };
    notes.push(`Trigger: ${trig.label}`);
  }

  const pipeRef = findPipelineRef(text, pipelines);
  if (pipeRef && trigger.type === "pipeline_stage") {
    if (pipeRef.pipelineId) trigger.config.pipelineId = pipeRef.pipelineId;
    if (pipeRef.stageId) trigger.config.stageId = pipeRef.stageId;
    notes.push(`Limited to ${pipeRef.pipelineName || "pipeline"}${pipeRef.stageLabel ? ` / ${pipeRef.stageLabel}` : ""}`);
  }

  const builtActions = [];
  const tags = extractTags(text);
  if (tags.length || /add\s+tag|tag\s+(the\s+)?(contact|lead|them)/.test(lower)) {
    builtActions.push(actionStep("tag_contact", { tags: tags.length ? tags : ["automation"] }, "Add tags"));
    notes.push(`Tag: ${(tags.length ? tags : ["automation"]).join(", ")}`);
  }

  if (/add\s+to\s+(the\s+)?pipeline|put\s+(them|him|her|it)\s+on|create\s+(a\s+)?card|pipeline\s+card/.test(lower)
    || (pipeRef && /add|put|move|place/.test(lower))) {
    builtActions.push(actionStep("add_to_pipeline", {
      pipelineId: pipeRef?.pipelineId || "",
      stageId: pipeRef?.stageId || "",
      title: "",
    }, "Add to pipeline"));
    notes.push("Action: add to pipeline");
  }

  if (/create\s+(a\s+)?(work|task|follow[- ]?up)|follow\s+up|work\s+item/.test(lower)) {
    const title = extractQuoted(text) || "Follow up";
    builtActions.push(actionStep("create_work", { title, brief: text.slice(0, 200) }, "Create work"));
    notes.push("Action: create work");
  }

  if (/notify|alert\s+(the\s+)?team|tell\s+(the\s+)?team|ping\s+(the\s+)?team/.test(lower)) {
    builtActions.push(actionStep("notify_team", {
      title: "Automation alert",
      brief: text.slice(0, 200),
    }, "Notify team"));
    notes.push("Action: notify team");
  }

  if (/mark\s+as\s+client|change\s+(to\s+)?client|type\s+to\s+client/.test(lower)) {
    builtActions.push(actionStep("update_contact", { kind: "client" }, "Update contact"));
    notes.push("Action: mark as client");
  } else if (/mark\s+as\s+lead|change\s+(to\s+)?lead/.test(lower)) {
    builtActions.push(actionStep("update_contact", { kind: "lead" }, "Update contact"));
    notes.push("Action: mark as lead");
  }

  // Chain another workflow by name
  const chainMatch = text.match(/(?:run|start|chain|trigger)\s+(?:the\s+)?(?:automation|workflow)\s+["']([^"']+)["']/i)
    || text.match(/(?:then\s+)?run\s+["']([^"']+)["']/i);
  if (chainMatch?.[1]) {
    const targetName = chainMatch[1].trim().toLowerCase();
    const target = workflows.find((w) => String(w.name || "").toLowerCase() === targetName);
    if (target) {
      builtActions.push(actionStep("run_workflow", { workflowId: target.id }, `Run ${target.name}`));
      notes.push(`Chain: ${target.name}`);
    } else {
      notes.push(`Could not find automation named “${chainMatch[1]}” to chain`);
    }
  }

  // If / else from "if ... then ... else ..."
  const ifMatch = text.match(/\bif\s+(.+?)\s+then\s+(.+?)(?:\s+else\s+(.+))?$/i);
  if (ifMatch) {
    const condText = ifMatch[1].toLowerCase();
    const rules = [];
    if (/vip|tag/.test(condText)) {
      const tag = (condText.match(/tag(?:ged)?\s+(?:as\s+)?["']?([a-z0-9_-]+)/i)?.[1]
        || (condText.includes("vip") ? "vip" : "hot_lead"));
      rules.push({ field: "contact.tags", op: "contains", value: tag });
    } else if (/lead/.test(condText)) {
      rules.push({ field: "contact.kind", op: "equals", value: "lead" });
    } else if (/client/.test(condText)) {
      rules.push({ field: "contact.kind", op: "equals", value: "client" });
    } else if (/email/.test(condText)) {
      rules.push({ field: "contact.email", op: "exists", value: "" });
    } else {
      rules.push({ field: "contact.kind", op: "equals", value: "lead" });
    }

    // Re-parse then/else halves for actions lightly
    const thenActions = builtActions.length
      ? builtActions
      : [actionStep("create_work", { title: "If matched", brief: ifMatch[2].slice(0, 160) })];
    const elseActions = ifMatch[3]
      ? [actionStep("tag_contact", { tags: ["skipped"] }, "Else tag")]
      : [];

    steps = [
      conditionStep({
        rules,
        thenSteps: thenActions,
        elseSteps: elseActions,
      }),
    ];
    notes.push("Built If / Else branch");
  } else if (builtActions.length) {
    // Replace steps when instruction clearly builds a flow; otherwise append
    const replace = /^(when|whenever|if|create|build|make|set\s+up|new\s+automation)/i.test(text.trim())
      || !currentWorkflow
      || /replace|rebuild|start\s+over|reset\s+steps/.test(lower);
    steps = replace ? builtActions : [...steps, ...builtActions];
  }

  // Clear steps
  if (/clear\s+steps|remove\s+all\s+steps|empty\s+steps/.test(lower)) {
    steps = [];
    notes.push("Cleared steps");
  }

  if (!notes.length) {
    // Gentle fallback: create work from instruction as a new step
    steps = [
      ...steps,
      actionStep("create_work", {
        title: "Follow up",
        brief: text.slice(0, 240),
      }, "Follow up from instruction"),
    ];
    notes.push("Added follow-up work from your note");
  }

  // Auto name from trigger if still default
  if ((!currentWorkflow || name === "New automation" || name === "Untitled automation") && trigger.label) {
    if (!rename) {
      name = trigger.label.replace(/^Website /, "").slice(0, 48);
      if (!notes.some((n) => n.startsWith("Renamed"))) notes.push(`Named “${name}”`);
    }
  }

  const proposed = normalizeWorkflow({
    ...base,
    id: base.id,
    name,
    status,
    trigger,
    steps,
    description: base.description || text.slice(0, 160),
  });

  return deepFreeze({
    ok: true,
    source: "deterministic",
    summary: notes.join(" · "),
    notes,
    proposedWorkflow: proposed,
  });
}
