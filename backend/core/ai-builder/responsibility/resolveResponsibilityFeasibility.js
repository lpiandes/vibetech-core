import { IMPLEMENTATION_MODES, patchResponsibilityRequest } from "./ResponsibilityRequest.js";
import { createResponsibilityConstraint } from "./ResponsibilityConstraint.js";

/**
 * Classify each responsibility into one of six implementation modes and
 * attach structured constraints + fallbacks. Honest — never hides unsupported.
 */

function textOf(request) {
  return [
    request?.title,
    request?.rawRequest,
    request?.requestedOutcome,
    request?.triggerDescription,
    request?.actionDescription,
  ].map((v) => String(v ?? "")).join(" ").toLowerCase();
}

export function resolveResponsibilityFeasibility(request, { connectedSystems = [] } = {}) {
  const text = textOf(request);
  const connected = new Set(
    (Array.isArray(connectedSystems) ? connectedSystems : []).map((s) => String(s).toLowerCase()),
  );
  const constraints = [];
  let mode = "ready_after_business_rules";
  let summary = "VIBETech can operate this after a few operating rules are confirmed.";

  // Unsafe / unsupported personal phone monitoring
  if (/personal\s+(iphone|phone|cellular)|silently\s+monitor.*personal/i.test(text)) {
    mode = "unsupported_or_unsafe";
    summary = "Personal cellular call history is not a dependable business event source.";
    constraints.push(createResponsibilityConstraint({
      responsibilityId: request.responsibilityId,
      type: "UNSUPPORTED_TRIGGER",
      description: "Cannot silently monitor personal cellular call history.",
      owner: "Customer",
      resolutionAction: "Use or port a business number that forwards to the personal phone.",
      blockingScope: "responsibility",
      evidenceNeeded: "Business phone route configured",
      fallback: {
        preferred: "Managed business number with forwarding",
        temporary: "Carrier/business-line forwarding",
      },
    }));
    return finalize(request, mode, summary, constraints);
  }

  // MLS / listing feed
  if (/\bmls\b|active\s+listing|listing\s+newsletter/i.test(text)) {
    mode = "requires_reusable_capability";
    summary = "Newsletter capability exists; authorized MLS connector may still be required.";
    constraints.push(createResponsibilityConstraint({
      responsibilityId: request.responsibilityId,
      type: "AUTHORIZED_DATA_SOURCE_REQUIRED",
      description: "Authorized listing source required.",
      owner: "Customer",
      resolutionAction: "Connect approved MLS/CRM feed, authorize a vendor, or upload a recurring listing export.",
      blockingScope: "action",
      evidenceNeeded: "Listing source connected or CSV upload scheduled",
      fallback: {
        preferred: "Authorized MLS feed",
        temporary: "Recurring CSV upload",
      },
    }));
    constraints.push(createResponsibilityConstraint({
      responsibilityId: request.responsibilityId,
      type: "ACCOUNT_CONNECTION_REQUIRED",
      description: "Business email required to send newsletters.",
      owner: "Customer",
      resolutionAction: "Connect business email (OAuth).",
      blockingScope: "outbound",
      evidenceNeeded: "Business email CONNECTED",
    }));
    constraints.push(createResponsibilityConstraint({
      responsibilityId: request.responsibilityId,
      type: "CONSENT_POLICY_REQUIRED",
      description: "Marketing eligibility policy required for prospective clients.",
      owner: "Customer",
      resolutionAction: "Confirm who may receive marketing email.",
      blockingScope: "outbound",
      evidenceNeeded: "Eligibility policy confirmed",
    }));
    return finalize(request, mode, summary, constraints);
  }

  // Missed call / SMS
  if (/missed\s+call|text\s+the\s+caller|sms/i.test(text)) {
    const hasSms = [...connected].some((c) => c.includes("sms") || c.includes("twilio"));
    const hasPhone = [...connected].some((c) => c.includes("voice") || c.includes("phone"));
    mode = hasSms && hasPhone ? "ready_existing_capabilities" : "ready_after_customer_access";
    summary = hasSms && hasPhone
      ? "Capabilities exist; configure and test missed-call response."
      : "VIBETech supports this once business phone and SMS are connected.";
    if (!hasPhone) {
      constraints.push(createResponsibilityConstraint({
        responsibilityId: request.responsibilityId,
        type: "ACCOUNT_CONNECTION_REQUIRED",
        description: "Choose how business calls reach VIBETech.",
        owner: "Customer",
        resolutionAction: "Get a VIBETech number, port an existing number, or forward the business line.",
        blockingScope: "responsibility",
        evidenceNeeded: "Phone route configured",
      }));
    }
    if (!hasSms) {
      constraints.push(createResponsibilityConstraint({
        responsibilityId: request.responsibilityId,
        type: "ACCOUNT_CONNECTION_REQUIRED",
        description: "SMS provider required.",
        owner: "Customer",
        resolutionAction: "Connect SMS (Twilio) via Integrations.",
        blockingScope: "outbound",
        evidenceNeeded: "SMS CONNECTED",
      }));
    }
    return finalize(request, mode, summary, constraints);
  }

  // Appointment reminders
  if (/appointment|remind/i.test(text)) {
    const hasCal = [...connected].some((c) => c.includes("calendar"));
    mode = hasCal ? "ready_existing_capabilities" : "ready_after_customer_access";
    summary = hasCal
      ? "Calendar reminders can run once message policy is confirmed."
      : "Connect calendar, then confirm reminder policy.";
    if (!hasCal) {
      constraints.push(createResponsibilityConstraint({
        responsibilityId: request.responsibilityId,
        type: "ACCOUNT_CONNECTION_REQUIRED",
        description: "Calendar connection required.",
        owner: "Customer",
        resolutionAction: "Connect Google Calendar via Integrations.",
        blockingScope: "responsibility",
        evidenceNeeded: "Calendar CONNECTED",
      }));
    }
    constraints.push(createResponsibilityConstraint({
      responsibilityId: request.responsibilityId,
      type: "BUSINESS_RULE_REQUIRED",
      description: "Confirm reminder timing and approval boundaries.",
      owner: "Customer",
      resolutionAction: "Answer reminder timing / approval questions.",
      blockingScope: "responsibility",
      evidenceNeeded: "Reminder rules confirmed",
    }));
    return finalize(request, mode, summary, constraints);
  }

  // Judgment-heavy selection
  if (/unusual|best\s+investment|select\s+the\s+best|review\s+unusual/i.test(text)) {
    mode = "operator_assisted";
    summary = "Deterministic filtering can automate; human judgment may be required at launch.";
    constraints.push(createResponsibilityConstraint({
      responsibilityId: request.responsibilityId,
      type: "HUMAN_OWNER_REQUIRED",
      description: "Operator review required for selection judgment until evidence supports more automation.",
      owner: "VIBETech",
      resolutionAction: "Operator reviews selections before customer approval.",
      blockingScope: "action",
      evidenceNeeded: "Operator playbook accepted",
    }));
    return finalize(request, mode, summary, constraints);
  }

  // Generic follow-up / lead — needs rules
  if (/follow\s*up|proposal|lead|qualify|past\s+client|old\s+client/i.test(text)) {
    mode = "ready_after_business_rules";
    summary = "VIBETech can perform this after inactive definitions, schedules, and message policy are confirmed.";
    constraints.push(createResponsibilityConstraint({
      responsibilityId: request.responsibilityId,
      type: "BUSINESS_RULE_REQUIRED",
      description: "Operating rules remain (eligibility, schedule, message policy, owner).",
      owner: "Customer",
      resolutionAction: "Answer clarification questions for this responsibility.",
      blockingScope: "responsibility",
      evidenceNeeded: "Rules confirmed",
    }));
    const hasEmail = [...connected].some((c) => c.includes("email") || c.includes("gmail"));
    if (!hasEmail && /email|contact|follow/i.test(text)) {
      constraints.push(createResponsibilityConstraint({
        responsibilityId: request.responsibilityId,
        type: "ACCOUNT_CONNECTION_REQUIRED",
        description: "Business email required for outbound follow-up.",
        owner: "Customer",
        resolutionAction: "Connect business email via Integrations.",
        blockingScope: "outbound",
        evidenceNeeded: "Business email CONNECTED",
      }));
    }
    return finalize(request, mode, summary, constraints);
  }

  // Default: form → contact/work is usually ready
  if (/form|contact|create\s+work|follow-up\s+work/i.test(text)) {
    mode = "ready_existing_capabilities";
    summary = "Existing intake capabilities can be configured and tested.";
    return finalize(request, mode, summary, constraints);
  }

  mode = "ready_after_business_rules";
  constraints.push(createResponsibilityConstraint({
    responsibilityId: request.responsibilityId,
    type: "BUSINESS_RULE_REQUIRED",
    description: "Confirm trigger, actions, approvals, and success proof.",
    owner: "Customer",
    resolutionAction: "Complete clarification questions.",
    blockingScope: "responsibility",
    evidenceNeeded: "Contract fields complete",
  }));
  return finalize(request, mode, summary, constraints);
}

function finalize(request, mode, summary, constraints) {
  if (!IMPLEMENTATION_MODES.includes(mode)) {
    throw new Error(`Unknown implementation mode: ${mode}`);
  }
  const patched = patchResponsibilityRequest(request, {
    implementationMode: mode,
    constraints,
    status: request.status === "draft" || request.status === "pending_review"
      ? request.status
      : request.status,
  });
  return {
    request: patched,
    implementationMode: mode,
    summary,
    constraints,
    readinessLabel: readinessLabelFor(mode),
  };
}

export function readinessLabelFor(mode) {
  switch (mode) {
    case "ready_existing_capabilities":
      return "Ready to configure";
    case "ready_after_customer_access":
      return "Needs your action";
    case "ready_after_business_rules":
      return "Needs clarification";
    case "operator_assisted":
      return "VIBETech-operated";
    case "requires_reusable_capability":
      return "VIBETech capability required";
    case "unsupported_or_unsafe":
      return "Cannot be installed as requested";
    default:
      return "Under review";
  }
}

export function assessResponsibilityInventory(requests, options = {}) {
  return (Array.isArray(requests) ? requests : []).map((r) => resolveResponsibilityFeasibility(r, options));
}
