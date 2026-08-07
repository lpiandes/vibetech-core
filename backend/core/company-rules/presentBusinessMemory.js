import { RFT_SCHEMA_ID } from "../ai-builder/operating-contract/rft/rftCatalog.js";
import {
  normalizeRftServiceStandard,
  presentRftServiceStandard,
} from "../ai-builder/operating-contract/rft/rftContract.js";
import { readGovernedLearning } from "./governedLearning.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = cleanText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function humanizeToken(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinSentences(parts = []) {
  return uniqueStrings(parts)
    .map((part) => {
      const trimmed = String(part).trim();
      if (!trimmed) return null;
      return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    })
    .filter(Boolean)
    .join(" ");
}

function formatCountLabel(label, count) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function summarizeBooleanRule(value, yesText, noText) {
  if (value === true) return yesText;
  if (value === false) return noText;
  return null;
}

function flattenText(value) {
  if (typeof value === "string") return [value];
  if (typeof value === "number") return [String(value)];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((entry) => flattenText(entry));
  return Object.values(value).flatMap((entry) => flattenText(entry));
}

function readAssignmentNotes(employee = null) {
  const notes = [
    ...flattenText(employee?.assignmentRules),
    ...flattenText(employee?.operatingContract?.assignmentRules),
  ].filter((text) => /assign|owner|route/i.test(String(text)));
  return uniqueStrings(notes);
}

function presentContracts(employees = []) {
  return employees.map((employee) => {
    const rft = employee?.operatingContract?.rft ?? null;
    const presented = rft ? presentRftServiceStandard(rft) : null;
    const oc = employee?.operatingContract ?? {};
    const responsibilityId = oc.responsibilityId ?? employee?.responsibilityId ?? null;
    return {
      employeeId: String(employee?.employeeId ?? employee?.id ?? ""),
      responsibilityId: responsibilityId ? String(responsibilityId) : null,
      label: String(employee?.label ?? employee?.displayName ?? "Operating contract"),
      contractVersion: String(presented?.contractVersion ?? oc.version ?? oc.contractVersion ?? "1"),
      slaSummary: presented?.slaSummary
        ?? (oc.slaSummary ? String(oc.slaSummary) : "Service standard recorded on this responsibility."),
      approvalSummary: presented?.approvalSummary
        ?? (oc.approvalSummary ? String(oc.approvalSummary) : "Approvals follow installed policy."),
      proofSummary: presented?.proofSummary
        ?? (oc.proofSummary ? String(oc.proofSummary) : "Proof requires provider evidence."),
      contentHash: presented?.contentHash ?? oc.contentHash ?? null,
      kind: rft ? "revenue_follow_through" : (responsibilityId ? "responsibility" : "operating_contract"),
    };
  });
}

function collectContractEmployees(installation = null) {
  return asArray(installation?.configuration?.employees).filter((employee) => {
    const oc = employee?.operatingContract;
    if (!oc || typeof oc !== "object") return false;
    const schemaId = String(oc.schemaId ?? "");
    const label = String(employee?.label ?? employee?.displayName ?? "");
    return schemaId === RFT_SCHEMA_ID
      || Boolean(oc.rft)
      || Boolean(oc.responsibilityId)
      || schemaId === "responsibility_operator"
      || /revenue\s*follow|responsibility/i.test(label);
  });
}

export function presentBusinessMemory(installation = null) {
  const cfg = installation?.configuration ?? {};
  const employees = collectContractEmployees(installation);
  const contracts = presentContracts(employees);
  const primaryEmployee = employees.find((e) => e?.operatingContract?.rft) ?? employees[0] ?? null;
  // normalizeRftServiceStandard(null) invents a default RFT doc — only normalize when raw rft exists.
  const rftRaw = primaryEmployee?.operatingContract?.rft ?? null;
  const rft = rftRaw ? normalizeRftServiceStandard(rftRaw) : null;
  const presented = rft ? presentRftServiceStandard(rft) : null;
  const learning = readGovernedLearning(installation);
  const activeRules = asArray(learning.ruleVersions).filter((rule) => rule?.status === "active");

  const services = uniqueStrings([
    ...asArray(cfg.services).map((service) => String(service?.name ?? service?.label ?? service)),
    ...asArray(cfg.discovery?.services).map((service) => String(service?.name ?? service?.label ?? service)),
    ...asArray(cfg.businessProfile?.services).map((service) => String(service?.name ?? service?.label ?? service)),
  ]);
  const customerTypes = uniqueStrings([
    ...asArray(cfg.customerTypes).map((customerType) => String(customerType?.name ?? customerType?.label ?? customerType)),
    ...asArray(cfg.discovery?.customerTypes).map((customerType) => String(customerType?.name ?? customerType?.label ?? customerType)),
    cleanText(cfg.discoveryAnswers?.customerTypes),
    cleanText(cfg.discoveryAnswers?.whoYouServe),
  ]);

  // Ask-confirmed responsibility facts (consent, rules, knowledge) feed Business Memory.
  const askConfirmed = [];
  for (const request of asArray(cfg.responsibilityRequests)) {
    const consent = cleanText(request?.consentPolicy?.text) ?? cleanText(request?.consentPolicy);
    if (consent) askConfirmed.push(consent);
    for (const rule of asArray(request?.confirmedRules ?? request?.operatingContract?.confirmedRules)) {
      const text = cleanText(rule?.text ?? rule?.body ?? rule);
      if (text) askConfirmed.push(text);
    }
    for (const constraint of asArray(request?.constraints)) {
      if (String(constraint?.status ?? "") !== "resolved") continue;
      const answer = cleanText(constraint?.answer ?? constraint?.resolvedAnswer ?? constraint?.proofReference);
      if (answer && !/^ask:|^prove:/i.test(answer)) askConfirmed.push(answer);
    }
  }
  for (const employee of asArray(cfg.employees)) {
    for (const rule of asArray(employee?.operatingContract?.confirmedRules)) {
      const text = cleanText(rule?.text ?? rule?.body ?? rule);
      if (text) askConfirmed.push(text);
    }
  }

  const memoryValues = {};
  if (services.length) memoryValues.Services = services.join(", ");
  if (customerTypes.length) memoryValues["Customer types"] = customerTypes.join(", ");
  if (askConfirmed.length) {
    const exceptionBits = askConfirmed.filter((text) => /exception|never|do not|don't|avoid/i.test(text));
    if (exceptionBits.length) {
      memoryValues["Known exceptions"] = uniqueStrings(exceptionBits).join(" · ");
    }
    const consentBits = askConfirmed.filter((text) => /consent|opt[- ]?in|contact/i.test(text));
    if (consentBits.length) {
      memoryValues["Customer types"] = joinSentences([
        memoryValues["Customer types"] ?? null,
        ...consentBits,
      ]);
    }
    const ruleBits = askConfirmed.filter((text) => /rule|remind|approv|before|within/i.test(text));
    if (ruleBits.length && !memoryValues["Assignment rules"]) {
      memoryValues["Assignment rules"] = joinSentences(ruleBits.slice(0, 3));
    }
  }

  const brandVoice = cleanText(cfg.brandVoice) ?? cleanText(cfg.tone);
  if (brandVoice) {
    memoryValues["Tone & communication"] = brandVoice;
  }

  if (rft) {
    memoryValues["Response-time promises"] = joinSentences([
      `Acknowledge within ${rft.sla.acknowledgeWithinMinutes} minutes${rft.sla.operatingHoursOnly ? " during operating hours" : ""}`,
    ]);

    memoryValues["Approval policies"] = joinSentences([
      presented?.approvalSummary ?? null,
      summarizeBooleanRule(
        rft.approvalRules.newProspectOutboundRequiresApproval,
        "New prospect outbound requires approval",
        "New prospect outbound may auto-execute when eligible",
      ),
      summarizeBooleanRule(
        rft.approvalRules.customerFacingRequiresApproval,
        null,
        "Customer-facing actions may auto-execute when eligible",
      ),
    ]);

    memoryValues["Assignment rules"] = joinSentences([
      summarizeBooleanRule(
        rft.sla.assignmentRequired,
        "Every Revenue Follow-Through opportunity requires an assigned owner",
        "The current contract does not require assignment before progress",
      ),
      ...readAssignmentNotes(primaryEmployee),
    ]);

    memoryValues["Escalation rules"] = joinSentences([
      rft.failureConditions.length
        ? `Escalate on ${rft.failureConditions.map(humanizeToken).join(", ")}`
        : null,
      cleanText(rft.exceptionOwner)
        ? `Exception owner: ${humanizeToken(rft.exceptionOwner)}`
        : null,
    ]);

    memoryValues["Scheduling rules"] = joinSentences([
      summarizeBooleanRule(
        rft.approvalRules.existingCustomerSchedulingMayAuto,
        "Existing-customer scheduling may auto-execute when eligible",
        "Existing-customer scheduling stays approval-gated",
      ),
      summarizeBooleanRule(
        rft.sla.meetingNextStepRequired,
        "Every meeting needs a recorded next step",
        null,
      ),
      Number.isFinite(Number(rft.sla.proposalReviewCadenceDays))
        ? `Review open proposals every ${rft.sla.proposalReviewCadenceDays} day${Number(rft.sla.proposalReviewCadenceDays) === 1 ? "" : "s"}`
        : null,
    ]);

    if (rft.failureConditions.length) {
      memoryValues["Known exceptions"] = uniqueStrings([
        memoryValues["Known exceptions"],
        ...rft.failureConditions.map(humanizeToken),
      ]).join(", ");
    }

    if (rft.approvalRules.pricingOutsidePolicyRequiresApproval) {
      const pricingNote = cleanText(primaryEmployee?.operatingContract?.scope?.answers?.constraints);
      memoryValues["Approved pricing boundaries"] = joinSentences([
        "Pricing outside approved policy requires approval",
        pricingNote && /pricing|quote|rate|fee/i.test(pricingNote) ? pricingNote : null,
      ]);
    }
  }

  if (activeRules.length) {
    memoryValues["Learned preferences"] = activeRules
      .map((rule) => joinSentences([
        cleanText(rule?.title),
        cleanText(rule?.body),
      ]))
      .filter(Boolean)
      .join(" ");
  }

  // Fill remaining empty domains with honest contract-derived placeholders (never invent facts).
  // RFT-specific service copy only when an RFT contract is installed.
  if (rft) {
    const derived = `Derived from installed operating contract v${presented?.contractVersion ?? contracts[0]?.contractVersion ?? "1"} — confirm via Ask if this should change.`;
    const fillIfEmpty = (key, value) => {
      if (!memoryValues[key] && value) memoryValues[key] = value;
    };
    fillIfEmpty("Services", services.length ? null : "Managed Revenue Follow-Through owns acknowledge → assign → next step → chase → handoff.");
    fillIfEmpty("Customer types", "Eligible inbound opportunities from connected email, forms, or CRM — confirm who may be contacted.");
    fillIfEmpty("Approved pricing boundaries", rft?.approvalRules?.pricingOutsidePolicyRequiresApproval
      ? "Pricing outside approved policy requires approval — confirm boundaries via Ask."
      : derived);
    fillIfEmpty("Tone & communication", brandVoice ?? "Professional, concise, customer-facing tone — confirm brand voice via Ask.");
    fillIfEmpty("Response-time promises", derived);
    fillIfEmpty("Assignment rules", derived);
    fillIfEmpty("Escalation rules", derived);
    fillIfEmpty("Approval policies", derived);
    fillIfEmpty("Scheduling rules", derived);
    fillIfEmpty("Known exceptions", "No confirmed exceptions yet — add via Ask or after repeated corrections.");
    fillIfEmpty("Learned preferences", "No repeating corrections yet — preferences appear after governed learning proposals are approved.");
  } else if (contracts.length) {
    const derived = `Derived from installed operating contract v${contracts[0]?.contractVersion ?? "1"} — confirm via Ask if this should change.`;
    if (!memoryValues["Learned preferences"]) {
      memoryValues["Learned preferences"] = "No repeating corrections yet — preferences appear after governed learning proposals are approved.";
    }
    if (!memoryValues["Approval policies"]) memoryValues["Approval policies"] = derived;
  }

  return {
    contracts,
    memoryValues,
    summary: {
      contractCount: contracts.length,
      activeRuleCount: activeRules.length,
      labels: [
        contracts.length ? formatCountLabel("contract", contracts.length) : null,
        activeRules.length ? formatCountLabel("active rule", activeRules.length) : null,
      ].filter(Boolean),
    },
  };
}
