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
    const presented = presentRftServiceStandard(employee?.operatingContract?.rft ?? null);
    return {
      employeeId: String(employee?.employeeId ?? employee?.id ?? ""),
      label: String(employee?.label ?? employee?.displayName ?? "Revenue Follow-Through"),
      contractVersion: presented.contractVersion,
      slaSummary: presented.slaSummary,
      approvalSummary: presented.approvalSummary,
      proofSummary: presented.proofSummary,
      contentHash: presented.contentHash,
    };
  });
}

function collectRftEmployees(installation = null) {
  return asArray(installation?.configuration?.employees).filter((employee) => {
    const schemaId = String(employee?.operatingContract?.schemaId ?? "");
    const label = String(employee?.label ?? employee?.displayName ?? "");
    return schemaId === RFT_SCHEMA_ID
      || /revenue\s*follow/i.test(label)
      || Boolean(employee?.operatingContract?.rft);
  });
}

export function presentBusinessMemory(installation = null) {
  const cfg = installation?.configuration ?? {};
  const employees = collectRftEmployees(installation);
  const contracts = presentContracts(employees);
  const primaryEmployee = employees[0] ?? null;
  const rft = primaryEmployee
    ? normalizeRftServiceStandard(primaryEmployee?.operatingContract?.rft ?? null)
    : null;
  const presented = rft ? presentRftServiceStandard(rft) : null;
  const learning = readGovernedLearning(installation);
  const activeRules = asArray(learning.ruleVersions).filter((rule) => rule?.status === "active");

  const services = uniqueStrings(
    asArray(cfg.services).map((service) => String(service?.name ?? service?.label ?? service)),
  );
  const customerTypes = uniqueStrings(
    asArray(cfg.customerTypes).map((customerType) => String(customerType?.name ?? customerType?.label ?? customerType)),
  );

  const memoryValues = {};
  if (services.length) memoryValues.Services = services.join(", ");
  if (customerTypes.length) memoryValues["Customer types"] = customerTypes.join(", ");

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
      memoryValues["Known exceptions"] = rft.failureConditions.map(humanizeToken).join(", ");
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
