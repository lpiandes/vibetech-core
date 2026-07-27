/**
 * Deterministic plain-English → automation path patch.
 * Production-safe without requiring an LLM; improves path copy/steps from instructions.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  normalizeAutomationPath,
  normalizePathStep,
  PATH_STEP_TYPES,
  PATH_AUDIENCES,
} from "../operating-contract/automationPath.js";
import { compileWorkflowChainToPath } from "../compileDesiredWorkflows.js";

export function proposeAutomationPathChange({
  instruction = "",
  contract = {},
  schema = null,
} = {}) {
  const text = String(instruction ?? "").trim();
  if (!text) {
    return deepFreeze({ ok: false, reason: "instruction_required" });
  }

  // Prefer explicit process chains: "FB lead → email → SMS → pipeline"
  if (/\s*(?:→|->|=>)\s*|\s+then\s+/i.test(text)) {
    const chain = compileWorkflowChainToPath(text, { contract, schema });
    if (chain?.ok) return chain;
  }

  const path = normalizeAutomationPath(contract.automationPath, { contract, schema });
  let steps = path.steps.map((s) => ({ ...s }));
  const lower = text.toLowerCase();
  const notes = [];

  // Add email step
  if (/add (an )?email|send (an )?email|email (to|the)/.test(lower)) {
    const audience = /team|staff|coach/.test(lower)
      ? PATH_AUDIENCES.TEAM
      : /submitter|who submitted|lead/.test(lower)
        ? PATH_AUDIENCES.SUBMITTER
        : PATH_AUDIENCES.SCOPE_WHO;
    const subjectMatch = text.match(/subject[:\s]+["']?([^"'\n.]+)["']?/i);
    const bodyMatch = text.match(/(?:body|say|message)[:\s]+["']?([^"']+)["']?/i);
    steps.push(normalizePathStep({
      id: `step_email_${Date.now().toString(36)}`,
      type: PATH_STEP_TYPES.SEND_EMAIL,
      label: audience === PATH_AUDIENCES.TEAM ? "Email → team" : audience === PATH_AUDIENCES.SUBMITTER ? "Email → submitter" : "Email → audience",
      audience,
      subject: subjectMatch?.[1]?.trim() || extractQuoted(text) || "Update",
      body: bodyMatch?.[1]?.trim() || "",
      requiresApproval: true,
      order: steps.length,
    }, steps.length));
    notes.push("Added send_email step");
  }

  // Add SMS step
  if (/add (an )?sms|send (an? )?(sms|text)/.test(lower)) {
    const audience = /team|staff/.test(lower) ? PATH_AUDIENCES.TEAM : PATH_AUDIENCES.SCOPE_WHO;
    steps.push(normalizePathStep({
      id: `step_sms_${Date.now().toString(36)}`,
      type: PATH_STEP_TYPES.SEND_SMS,
      label: audience === PATH_AUDIENCES.TEAM ? "SMS → team" : "SMS → audience",
      audience,
      body: extractQuoted(text) || text.slice(0, 160),
      requiresApproval: true,
      order: steps.length,
    }, steps.length));
    notes.push("Added send_sms step");
  }

  // Add pipeline step
  if (/pipeline|add to (the )?board|new lead/.test(lower)) {
    const pipeMatch = text.match(/pipeline[:\s]+["']?([^"'\n.]+)["']?/i);
    steps.push(normalizePathStep({
      id: `step_pipe_${Date.now().toString(36)}`,
      type: PATH_STEP_TYPES.ADD_TO_PIPELINE,
      label: "Add to pipeline",
      pipelineLabel: pipeMatch?.[1]?.trim() || "New leads",
      order: steps.length,
    }, steps.length));
    notes.push("Added pipeline step");
  }

  // Update existing email/SMS bodies when user pastes replacement copy
  if (/change (the )?(email|subject|sms|text)|update (the )?(email|sms)|rewrite/.test(lower)) {
    const quoted = extractQuoted(text);
    if (quoted) {
      if (/sms|text/.test(lower)) {
        const idx = steps.findIndex((s) => s.type === PATH_STEP_TYPES.SEND_SMS && s.enabled !== false);
        if (idx >= 0) {
          steps[idx] = { ...steps[idx], body: quoted };
          notes.push("Updated SMS body");
        }
      } else {
        const idx = steps.findIndex((s) => s.type === PATH_STEP_TYPES.SEND_EMAIL && s.enabled !== false);
        if (idx >= 0) {
          steps[idx] = {
            ...steps[idx],
            subject: /subject/.test(lower) ? quoted : steps[idx].subject,
            body: /subject/.test(lower) ? steps[idx].body : quoted,
          };
          notes.push("Updated email copy");
        }
      }
    }
  }

  // Disable notify/pipeline if asked to simplify
  if (/remove team notify|no team email|disable notify/.test(lower)) {
    steps = steps.map((s) =>
      s.type === PATH_STEP_TYPES.NOTIFY_TEAM ? { ...s, enabled: false } : s,
    );
    notes.push("Disabled team notify");
  }

  if (!notes.length) {
    // Fallback: set draft hint from instruction
    const draftIdx = steps.findIndex((s) => s.type === PATH_STEP_TYPES.CREATE_DRAFT);
    if (draftIdx >= 0) {
      steps[draftIdx] = { ...steps[draftIdx], briefHint: text.slice(0, 240), label: "Draft from your instruction" };
      notes.push("Applied instruction to draft step");
    } else {
      return deepFreeze({
        ok: false,
        reason: "could_not_interpret",
        hint: "Try: “Add an email to the team with subject Welcome” or “Change the SMS to say Practice cancelled”.",
      });
    }
  }

  const proposed = normalizeAutomationPath(
    { version: 1, customized: true, steps },
    { contract, schema },
  );

  return deepFreeze({
    ok: true,
    notes,
    proposedPath: proposed,
    summary: notes.join(" · "),
  });
}

function extractQuoted(text) {
  const m = String(text).match(/["“]([^"”]+)["”]/)
    || String(text).match(/'([^']+)'/);
  return m?.[1]?.trim() || "";
}
