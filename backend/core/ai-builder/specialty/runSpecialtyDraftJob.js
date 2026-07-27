import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CustomAiWorkerService } from "../custom-ai/CustomAiWorkerService.js";
import { compileCustomAiEmployee } from "../custom-ai/CustomAiWorkerCompiler.js";

/**
 * Shared specialty draft pipeline for manual Mission runs and automated triggers.
 * Always drafts Work for review — never sends outbound.
 */
export function buildSpecialtyBriefFromContract({
  brief = "",
  employee = {},
  triggerEventType = null,
  triggerLabel = null,
} = {}) {
  const contract = employee?.operatingContract ?? {};
  const answers = contract?.scope?.answers ?? {};
  const template = contract?.messageTemplate ?? {};
  const path = contract?.automationPath;
  const pathSteps = Array.isArray(path?.steps) ? path.steps.filter((s) => s?.enabled !== false) : [];
  const parts = [];

  const trigger = String(triggerLabel ?? triggerEventType ?? "").trim();
  if (trigger) parts.push(`Trigger: ${trigger}`);

  const ownerBrief = String(brief ?? "").trim();
  if (ownerBrief) parts.push(ownerBrief);

  const scopeLines = [];
  for (const [key, raw] of Object.entries(answers)) {
    const value = typeof raw === "object" && raw != null
      ? (raw.notApplicable ? `N/A${raw.reason ? ` — ${raw.reason}` : ""}` : String(raw.value ?? "").trim())
      : String(raw ?? "").trim();
    if (!value) continue;
    scopeLines.push(`${key}: ${value}`);
  }
  if (scopeLines.length) {
    parts.push(`Operating scope:\n${scopeLines.map((l) => `- ${l}`).join("\n")}`);
  }

  if (pathSteps.length) {
    parts.push(
      [
        "Automation path (execute in order; outbound steps need approval):",
        ...pathSteps.map((step, i) => {
          const type = String(step.type ?? "action");
          const label = String(step.label ?? type);
          const detail = type === "send_email"
            ? `email to ${step.audience || "audience"}${step.subject ? ` — ${step.subject}` : ""}`
            : type === "send_sms"
              ? `sms to ${step.audience || "audience"}`
              : type === "add_to_pipeline"
                ? `pipeline: ${step.pipelineLabel || "leads"}`
                : type === "notify_team"
                  ? "notify team"
                  : "create draft";
          return `${i + 1}. [${type}] ${label} — ${detail}`;
        }),
      ].join("\n"),
    );
  }

  const emailSubject = String(template.emailSubject ?? "").trim();
  const emailBody = String(template.emailBody ?? "").trim();
  const smsBody = String(template.smsBody ?? "").trim();
  if (emailSubject || emailBody || smsBody) {
    parts.push(
      [
        "Legacy message template:",
        emailSubject ? `Subject: ${emailSubject}` : null,
        emailBody ? `Email:\n${emailBody}` : null,
        smsBody ? `SMS:\n${smsBody}` : null,
      ].filter(Boolean).join("\n"),
    );
  }

  const executes = String(contract?.executes?.summary ?? employee?.purpose ?? "").trim();
  if (executes && !ownerBrief) {
    parts.push(executes);
  }

  return parts.join("\n\n").trim()
    || `Prepare the next deliverable for: ${String(employee.label ?? employee.purpose ?? "specialty teammate")}`;
}

/**
 * @param {{
 *   workRuntime: object,
 *   employee: object,
 *   brief?: string,
 *   actorId?: string,
 *   businessId?: string,
 *   knowledgeDocuments?: object[],
 *   triggerEventType?: string|null,
 *   triggerLabel?: string|null,
 *   nowISO?: (() => string)|string,
 *   fetchImpl?: typeof fetch|null,
 * }} params
 */
export async function runSpecialtyDraftJob({
  workRuntime,
  employee,
  brief = "",
  actorId = "owner",
  businessId = null,
  knowledgeDocuments = [],
  triggerEventType = null,
  triggerLabel = null,
  nowISO = () => new Date().toISOString(),
  fetchImpl = null,
} = {}) {
  if (!workRuntime) {
    return deepFreeze({ ok: false, reason: "work_runtime_required" });
  }
  const employeeId = String(employee?.employeeId ?? employee?.id ?? "").trim();
  if (!employeeId) {
    return deepFreeze({ ok: false, reason: "employee_required" });
  }

  const compiled = compileCustomAiEmployee(employee, { ownerAdded: true });
  const instruction = buildSpecialtyBriefFromContract({
    brief,
    employee: { ...employee, ...compiled, operatingContract: employee?.operatingContract ?? compiled.operatingContract },
    triggerEventType,
    triggerLabel,
  });

  const worker = new CustomAiWorkerService({ nowISO, fetchImpl });
  const result = await worker.runJob({
    workRuntime,
    employee: compiled,
    brief: instruction,
    actorId,
    businessId,
    knowledgeDocuments,
  });

  if (!result.ok) return result;

  const template = employee?.operatingContract?.messageTemplate ?? {};
  const path = employee?.operatingContract?.automationPath ?? null;
  const channels = Array.isArray(template.channels)
    ? template.channels.map(String)
    : inferChannelsFromScope(employee?.operatingContract?.scope?.answers?.where);

  return deepFreeze({
    ...result,
    triggerEventType: triggerEventType ? String(triggerEventType) : null,
    automationPath: path,
    messageTemplate: {
      emailSubject: String(template.emailSubject ?? ""),
      emailBody: String(template.emailBody ?? ""),
      smsBody: String(template.smsBody ?? ""),
      channels,
    },
  });
}

function inferChannelsFromScope(whereAnswer) {
  const text = typeof whereAnswer === "object" && whereAnswer != null
    ? String(whereAnswer.value ?? "")
    : String(whereAnswer ?? "");
  const lower = text.toLowerCase();
  const channels = [];
  if (/email|e-mail/.test(lower)) channels.push("email");
  if (/sms|text/.test(lower)) channels.push("sms");
  return channels.length ? channels : ["email"];
}
