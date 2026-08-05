import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MIN_SAMPLE,
  computeClassMetrics,
  evaluateClassEligibility,
  delegateClass,
  revokeClass,
  resolveAutonomyDisposition,
  readEarnedAutonomy,
} from "./earnedAutonomy.js";
import { classifyReplayOpportunity } from "../ai-builder/operating-contract/rft/rftReplay.js";
import { normalizeRftServiceStandard } from "../ai-builder/operating-contract/rft/rftContract.js";

function plan7Ok() {
  return {
    rftLaunch: {
      replayPassedAt: "2026-08-01T00:00:00.000Z",
      shadowPassedAt: "2026-08-02T00:00:00.000Z",
      goLiveAt: "2026-08-03T00:00:00.000Z",
    },
    rftReplay: {
      lastReplay: { passed: true },
      shadow: { passed: true, corrections: [] },
    },
  };
}

function correctionsForClass(classId, { approvals = 0, edits = 0, critical = 0 } = {}) {
  const rows = [];
  for (let i = 0; i < approvals; i += 1) {
    rows.push({
      correctionId: `${classId}_a_${i}`,
      actionClass: classId,
      reasonCode: "approved_as_proposed",
      decision: "GRANTED",
      original: { kind: classId === "existing_customer_scheduling" ? "meeting" : "inbound_email" },
      approved: {},
    });
  }
  for (let i = 0; i < edits; i += 1) {
    rows.push({
      correctionId: `${classId}_e_${i}`,
      actionClass: classId,
      reasonCode: "tone_edit",
      decision: "GRANTED",
      original: {},
      approved: { edited: true },
    });
  }
  for (let i = 0; i < critical; i += 1) {
    rows.push({
      correctionId: `${classId}_c_${i}`,
      actionClass: classId,
      reasonCode: "ai_quality_failure",
      decision: "REJECTED",
      original: {},
      approved: {},
    });
  }
  return rows;
}

function installationWith({ classId, approvals, edits, critical = 0, autonomy = null } = {}) {
  const rft = normalizeRftServiceStandard({
    contractVersion: "1.0.0",
    approvalRules: {
      customerFacingRequiresApproval: true,
      newProspectOutboundRequiresApproval: true,
      existingCustomerSchedulingMayAuto: false,
      pricingOutsidePolicyRequiresApproval: true,
    },
  });
  return {
    businessId: "biz_1",
    configuration: {
      ...plan7Ok(),
      governedLearning: {
        corrections: correctionsForClass(classId, { approvals, edits, critical }),
      },
      rftAutonomy: autonomy,
      employees: [{ employeeId: "emp_rft", operatingContract: { rft, schemaId: "rft" } }],
    },
  };
}

test("computeClassMetrics: high edit rate stays visible", () => {
  const metrics = computeClassMetrics({
    classId: "new_prospect_outbound",
    corrections: correctionsForClass("new_prospect_outbound", { approvals: 2, edits: 8 }),
  });
  assert.equal(metrics.sampleSize, 10);
  assert.ok(metrics.editRate > 0.1);
  assert.ok(metrics.approvalRate < 0.9);
});

test("scheduling class can become eligible; high-edit outbound stays ineligible", () => {
  const schedulingInstall = installationWith({
    classId: "existing_customer_scheduling",
    approvals: MIN_SAMPLE,
    edits: 0,
  });
  const scheduling = evaluateClassEligibility({
    classId: "existing_customer_scheduling",
    installation: schedulingInstall,
    contract: schedulingInstall.configuration.employees[0].operatingContract,
  });
  assert.equal(scheduling.status, "eligible_pending_delegation");
  assert.equal(scheduling.autoEligible, false);

  const outboundInstall = installationWith({
    classId: "new_prospect_outbound",
    approvals: 2,
    edits: 8,
  });
  const outbound = evaluateClassEligibility({
    classId: "new_prospect_outbound",
    installation: outboundInstall,
    contract: outboundInstall.configuration.employees[0].operatingContract,
  });
  assert.equal(outbound.status, "ineligible");
  assert.equal(outbound.autoEligible, false);
  assert.ok(outbound.reasons.some((r) => r.startsWith("edit_rate_above_threshold")));
});

test("delegate + matching policy → AutoEligible; revoke returns ApprovalRequired", () => {
  let installation = installationWith({
    classId: "existing_customer_scheduling",
    approvals: MIN_SAMPLE,
    edits: 0,
  });
  const contract = installation.configuration.employees[0].operatingContract;
  const policyHash = contract.rft.contentHash;
  let evaluation = evaluateClassEligibility({
    classId: "existing_customer_scheduling",
    installation,
    contract,
  });
  const delegated = delegateClass(readEarnedAutonomy(installation), {
    classId: "existing_customer_scheduling",
    actorId: "owner",
    policyHash,
    evaluation,
  });
  assert.equal(delegated.ok, true);

  installation = {
    ...installation,
    configuration: {
      ...installation.configuration,
      rftAutonomy: delegated.state,
    },
  };
  evaluation = evaluateClassEligibility({
    classId: "existing_customer_scheduling",
    installation,
    contract,
  });
  assert.equal(evaluation.status, "auto_eligible");
  assert.equal(evaluation.autoEligible, true);

  const disposition = resolveAutonomyDisposition({
    event: {
      kind: "meeting",
      title: "Schedule follow-up",
      email: "a@b.com",
      evidence: [{ providerId: "cal_1" }],
    },
    installation,
    contract,
  });
  assert.equal(disposition.proposedNextState, "AutoEligible");

  const revoked = revokeClass(delegated.state, { classId: "existing_customer_scheduling" });
  installation = {
    ...installation,
    configuration: { ...installation.configuration, rftAutonomy: revoked.state },
  };
  const afterRevoke = resolveAutonomyDisposition({
    event: {
      kind: "meeting",
      title: "Schedule follow-up",
      email: "a@b.com",
      evidence: [{ providerId: "cal_1" }],
    },
    installation,
    contract,
  });
  assert.equal(afterRevoke.proposedNextState, "ApprovalRequired");
});

test("policy version bump clears auto until re-earned", () => {
  let installation = installationWith({
    classId: "existing_customer_scheduling",
    approvals: MIN_SAMPLE,
    edits: 0,
  });
  const contract = installation.configuration.employees[0].operatingContract;
  const evaluation = evaluateClassEligibility({
    classId: "existing_customer_scheduling",
    installation,
    contract,
  });
  const delegated = delegateClass(readEarnedAutonomy(installation), {
    classId: "existing_customer_scheduling",
    policyHash: contract.rft.contentHash,
    evaluation,
  });
  // bump policy by changing approvalRules → new content hash
  const bumpedRft = normalizeRftServiceStandard({
    ...contract.rft,
    approvalRules: {
      ...contract.rft.approvalRules,
      customerFacingRequiresApproval: false,
    },
  });
  const bumpedContract = { ...contract, rft: bumpedRft };
  installation = {
    ...installation,
    configuration: {
      ...installation.configuration,
      rftAutonomy: delegated.state,
      employees: [{ ...installation.configuration.employees[0], operatingContract: bumpedContract }],
    },
  };
  const afterBump = evaluateClassEligibility({
    classId: "existing_customer_scheduling",
    installation,
    contract: bumpedContract,
  });
  assert.equal(afterBump.autoEligible, false);
  assert.ok(afterBump.reasons.includes("policy_version_changed_reearn_required"));
});

test("classifyReplayOpportunity uses earned autonomy for AutoEligible", () => {
  let installation = installationWith({
    classId: "existing_customer_scheduling",
    approvals: MIN_SAMPLE,
    edits: 0,
  });
  const contract = installation.configuration.employees[0].operatingContract;
  const evaluation = evaluateClassEligibility({
    classId: "existing_customer_scheduling",
    installation,
    contract,
  });
  const delegated = delegateClass(readEarnedAutonomy(installation), {
    classId: "existing_customer_scheduling",
    policyHash: contract.rft.contentHash,
    evaluation,
  });
  installation = {
    ...installation,
    configuration: { ...installation.configuration, rftAutonomy: delegated.state },
  };

  const classified = classifyReplayOpportunity({
    event: {
      kind: "meeting",
      title: "Book next consult",
      email: "c@d.com",
      evidence: [{ providerId: "evt_1" }],
    },
    contract,
    installation,
  });
  assert.equal(classified.wouldAuto, true);
  assert.equal(classified.proposedNextState, "AutoEligible");
  assert.equal(classified.actionClassId, "existing_customer_scheduling");
});

test("without Plan 7 gates, class cannot fabricate eligibility", () => {
  const installation = installationWith({
    classId: "existing_customer_scheduling",
    approvals: MIN_SAMPLE,
    edits: 0,
  });
  delete installation.configuration.rftLaunch;
  delete installation.configuration.rftReplay;
  const evaluation = evaluateClassEligibility({
    classId: "existing_customer_scheduling",
    installation,
    contract: installation.configuration.employees[0].operatingContract,
  });
  assert.equal(evaluation.autoEligible, false);
  assert.equal(evaluation.status, "ineligible");
  assert.ok(evaluation.reasons.includes("replay_not_passed"));
});
