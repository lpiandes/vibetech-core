import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveOperatingContractSchema } from "../OperatingContractSchemas.js";
import {
  applyOperatingContractPatch,
  buildOperatingContract,
} from "../buildOperatingContract.js";
import {
  RFT_SCHEMA_ID,
  applyRftTransition,
  canTransition,
  createRevenueFollowThroughBlueprint,
  buildDefaultRevenueFollowThroughEmployee,
  hashRftServiceStandard,
  normalizeRftServiceStandard,
  seedRftOpportunity,
  progressRftOpportunity,
  getRftOpportunityTrace,
  assertVerifiedAllowed,
  evaluateRftLaunch,
  applyRftLaunchPatch,
  readRftLaunch,
  attachProveEvidenceToRftOpportunity,
  mapProveActionToEvidenceKind,
  extractProveProviderId,
  resolveExecutionModeFromInstallation,
  readRftResponsibility,
  assertRftResponsibilityComplete,
} from "./index.js";
import {
  createBlueprintRegistry,
  resetDefaultBlueprintRegistryForTests,
} from "../../../blueprints/BlueprintRegistry.js";
import { hashBusinessOSSpecification } from "../../../business-os/BusinessOSSpecificationHasher.js";
import { createBusinessOSSpecification } from "../../../business-os/BusinessOSSpecification.js";

function createMemoryPlatformStore(seedInstallation) {
  let installation = structuredClone(seedInstallation);
  return {
    async getBusinessOSInstallation() {
      return structuredClone(installation);
    },
    async upsertBusinessOSInstallation(next) {
      installation = {
        ...installation,
        ...next,
        configuration: next.configuration ?? installation.configuration,
      };
      return structuredClone(installation);
    },
  };
}

test("RFT schema resolves for revenue_follow_through role", () => {
  const schema = resolveOperatingContractSchema({
    employee: {
      roleId: "revenue_follow_through",
      label: "Revenue Follow-Through",
      archetypeId: "follow_up_specialist",
    },
    industry: "professional_services",
  });
  assert.equal(schema.schemaId, RFT_SCHEMA_ID);
});

test("lead follow-up label does not steal RFT schema", () => {
  const schema = resolveOperatingContractSchema({
    employee: {
      label: "Lead Follow-up",
      archetypeId: "intake_specialist",
    },
    industry: "universal",
  });
  assert.notEqual(schema.schemaId, RFT_SCHEMA_ID);
});

test("buildOperatingContract attaches versioned hashed rft block", () => {
  const { contract, completeness } = buildOperatingContract({
    employee: {
      employeeId: "emp_rft",
      roleId: "revenue_follow_through",
      label: "Revenue Follow-Through",
    },
    industry: "professional_services",
  });
  assert.equal(contract.schemaId, RFT_SCHEMA_ID);
  assert.ok(contract.rft);
  assert.equal(contract.rft.kind, "revenue_follow_through");
  assert.ok(String(contract.rft.contentHash).length === 64);
  assert.equal(completeness.complete, false);
});

test("rft content hash is stable and changes when SLA changes", () => {
  const a = normalizeRftServiceStandard(null);
  const b = normalizeRftServiceStandard(null);
  assert.equal(a.contentHash, b.contentHash);
  assert.equal(hashRftServiceStandard(a), a.contentHash);

  const changed = normalizeRftServiceStandard({
    sla: { ...a.sla, acknowledgeWithinMinutes: 15 },
  });
  assert.notEqual(changed.contentHash, a.contentHash);
});

test("state machine allows happy path and blocks illegal jumps", () => {
  assert.equal(canTransition("Detected", "ContextReady"), true);
  assert.equal(canTransition("Detected", "Verified"), false);
  assert.equal(canTransition("Executing", "Verified"), true);

  const bad = applyRftTransition({
    fromState: "Detected",
    toState: "Verified",
    evidence: [{ kind: "gmail_message_id", providerId: "msg_1" }],
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "illegal_transition");
});

test("Verified requires provider-backed proof", () => {
  const gate = assertVerifiedAllowed({
    toState: "Verified",
    evidence: [{ kind: "work_item_id", providerId: "work_1" }],
  });
  assert.equal(gate.ok, false);

  const okGate = assertVerifiedAllowed({
    toState: "Verified",
    evidence: [{ kind: "gmail_message_id", providerId: "gmail_abc" }],
  });
  assert.equal(okGate.ok, true);

  const blocked = applyRftTransition({
    fromState: "Executing",
    toState: "Verified",
    evidence: [{ kind: "approval_id", providerId: "appr_1" }],
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "missing_provider_proof");

  const allowed = applyRftTransition({
    fromState: "Executing",
    toState: "Verified",
    evidence: [{ kind: "hubspot_record_id", providerId: "hs_99" }],
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.toState, "Verified");
});

test("seed and progress opportunity through states with evidence and contract version", async () => {
  const employee = buildDefaultRevenueFollowThroughEmployee();
  assert.equal(employee.operatingContract.schemaId, RFT_SCHEMA_ID);
  assert.ok(employee.operatingContract.rft.contentHash);

  const installation = {
    id: "install_test_rft",
    businessId: "biz_rft_test",
    specificationId: "spec_rft",
    specificationVersion: 1,
    specificationContentHash: "abc",
    planId: "plan_rft",
    status: "installed",
    configuration: {
      employees: [employee],
      crm: { version: 1, contacts: [], pipelines: [], calendarEvents: [], ownerColors: {} },
    },
  };
  const store = createMemoryPlatformStore(installation);

  const seeded = await seedRftOpportunity({
    platformStore: store,
    installation: await store.getBusinessOSInstallation(),
    contact: { name: "Acme Manufacturing", email: "ops@acme.test" },
    title: "Acme pricing inquiry",
    triggerEvent: "WEBSITE_INQUIRY",
    actorId: "owner_1",
  });
  assert.equal(seeded.ok, true);
  assert.equal(seeded.state, "Detected");
  assert.equal(seeded.contractVersion, employee.operatingContract.rft.contractVersion);
  assert.equal(seeded.contentHash, employee.operatingContract.rft.contentHash);

  let install = await store.getBusinessOSInstallation();
  let step = await progressRftOpportunity({
    platformStore: store,
    installation: install,
    cardId: seeded.cardId,
    toState: "ContextReady",
    eventType: "CONTEXT_ENRICHED",
    actorId: "system",
  });
  assert.equal(step.ok, true);
  assert.equal(step.toState, "ContextReady");

  install = await store.getBusinessOSInstallation();
  step = await progressRftOpportunity({
    platformStore: store,
    installation: install,
    cardId: seeded.cardId,
    toState: "ActionProposed",
    actorId: "system",
  });
  assert.equal(step.ok, true);

  install = await store.getBusinessOSInstallation();
  step = await progressRftOpportunity({
    platformStore: store,
    installation: install,
    cardId: seeded.cardId,
    toState: "ApprovalRequired",
    actorId: "system",
  });
  assert.equal(step.ok, true);

  install = await store.getBusinessOSInstallation();
  step = await progressRftOpportunity({
    platformStore: store,
    installation: install,
    cardId: seeded.cardId,
    toState: "Executing",
    eventType: "APPROVAL_GRANTED",
    actorId: "owner_1",
  });
  assert.equal(step.ok, true);

  install = await store.getBusinessOSInstallation();
  const noProof = await progressRftOpportunity({
    platformStore: store,
    installation: install,
    cardId: seeded.cardId,
    toState: "Verified",
    actorId: "system",
  });
  assert.equal(noProof.ok, false);
  assert.equal(noProof.code, "missing_provider_proof");

  install = await store.getBusinessOSInstallation();
  step = await progressRftOpportunity({
    platformStore: store,
    installation: install,
    cardId: seeded.cardId,
    toState: "Verified",
    evidence: [{ kind: "gmail_message_id", providerId: "msg_prove_1", source: "gmail" }],
    actorId: "system",
    note: "Ack delivered",
  });
  assert.equal(step.ok, true);
  assert.equal(step.toState, "Verified");
  assert.ok(step.evidence.some((e) => e.kind === "gmail_message_id"));

  install = await store.getBusinessOSInstallation();
  step = await progressRftOpportunity({
    platformStore: store,
    installation: install,
    cardId: seeded.cardId,
    toState: "OutcomeRecorded",
    outcomeType: "Acknowledged",
    actorId: "system",
  });
  assert.equal(step.ok, true);
  assert.equal(step.outcomeType, "Acknowledged");

  install = await store.getBusinessOSInstallation();
  const trace = getRftOpportunityTrace(install, seeded.cardId);
  assert.ok(trace);
  assert.equal(trace.rft.state, "OutcomeRecorded");
  assert.ok(trace.rft.history.length >= 5);
  assert.equal(trace.rft.contentHash, employee.operatingContract.rft.contentHash);
});

test("RFT blueprint registers and employee recipe has hashed contract", () => {
  resetDefaultBlueprintRegistryForTests();
  const registry = createBlueprintRegistry({ includeDefaults: true });
  const bp = registry.get("bp_rft_b2b_services");
  assert.ok(bp);
  assert.equal(bp.dependencies[0], "bp_platform_universal_core");
  assert.ok(bp.employeeRecipes?.length >= 1);
  assert.equal(bp.employeeRecipes[0].operatingContract.schemaId, RFT_SCHEMA_ID);
  assert.ok(bp.employeeRecipes[0].operatingContract.rft.contentHash);

  const fromFactory = createRevenueFollowThroughBlueprint();
  assert.equal(fromFactory.blueprintId, "bp_rft_b2b_services");
});

test("RFT employee on Business OS spec is content-hashed", () => {
  const employee = buildDefaultRevenueFollowThroughEmployee();
  const spec = createBusinessOSSpecification({
    specificationId: "spec_rft_hash",
    businessId: "biz_rft_hash",
    businessProfile: { businessName: "Northline Partners", industry: "professional_services" },
    employeeDefinitions: [employee],
  });
  const hash1 = hashBusinessOSSpecification(spec);
  const hash2 = hashBusinessOSSpecification(spec);
  assert.equal(hash1, hash2);
  assert.ok(hash1.length === 64);

  const patched = applyOperatingContractPatch({
    employee,
    industry: "professional_services",
    patch: {
      rft: {
        sla: {
          acknowledgeWithinMinutes: 1,
        },
      },
    },
  });
  const tweaked = createBusinessOSSpecification({
    specificationId: "spec_rft_hash",
    businessId: "biz_rft_hash",
    businessProfile: { businessName: "Northline Partners", industry: "professional_services" },
    employeeDefinitions: [
      {
        ...employee,
        operatingContract: patched.contract,
      },
    ],
  });
  const hash3 = hashBusinessOSSpecification(tweaked);
  assert.notEqual(hash3, hash1);
});

test("upsertPipelineCard preserves rft metadata", async () => {
  const { emptyCrmState, upsertPipelineCard } = await import("../../../crm/CrmStore.js");
  let crm = emptyCrmState();
  const pipeId = crm.pipelines[0].id;
  const stageId = crm.pipelines[0].stages[0].id;
  crm = upsertPipelineCard(crm, {
    pipelineId: pipeId,
    card: {
      title: "Opp",
      stageId,
      rft: { state: "Detected", evidence: [{ kind: "form_submission_id", providerId: "f1" }] },
    },
  }).crm;
  const cardId = crm.pipelines[0].cards[0].id;
  assert.equal(crm.pipelines[0].cards[0].rft.state, "Detected");
  crm = upsertPipelineCard(crm, {
    pipelineId: pipeId,
    card: { id: cardId, title: "Opp updated", stageId },
  }).crm;
  assert.equal(crm.pipelines[0].cards[0].rft.state, "Detected");
  assert.equal(crm.pipelines[0].cards[0].title, "Opp updated");
});

test("launch observe/replay/shadow unlock from real artifacts; go-live gated", () => {
  const employee = buildDefaultRevenueFollowThroughEmployee();
  const installation = {
    configuration: {
      employees: [employee],
      rftLaunch: {
        confirmedContentHash: employee.operatingContract.rft.contentHash,
        proveCardId: "card_x",
      },
      rftObservation: {
        importedAt: "2026-08-05T12:00:00.000Z",
        events: [{ id: "email_1", kind: "inbound_email", evidence: [{ kind: "gmail_message_id", providerId: "m1" }] }],
        baseline: { metrics: {} },
      },
      rftReplay: {
        lastReplay: { passed: true, ranAt: "2026-08-05T12:30:00.000Z", passDetail: "ok" },
        shadow: { enabled: true, passed: true, proposals: [{ id: "p1" }], corrections: [] },
      },
    },
  };
  const evaluated = evaluateRftLaunch({
    installation,
    connectionStatuses: {
      business_email: { status: "CONNECTED" },
      calendar: { status: "CONNECTED" },
    },
    proofRecords: {
      customer_email_send: { ok: true, verified: true, detail: { externalReference: "msg_1" } },
      calendar_scheduling: { ok: true, verified: true, detail: { externalReference: "evt_1" } },
    },
  });
  assert.equal(evaluated.steps.observe.status, "complete");
  assert.equal(evaluated.steps.replay.status, "complete");
  assert.equal(evaluated.steps.shadow.status, "complete");
  assert.equal(evaluated.summary.canGoLive, true);

  const blockedGoLive = applyRftLaunchPatch(readRftLaunch(null), {
    confirmedContentHash: "abc",
    proveCardId: "c1",
    goLive: true,
  });
  assert.equal(blockedGoLive.ok, false);
  assert.equal(blockedGoLive.code, "go_live_gate");
});

test("confirm + prove alone no longer unlock go-live without observe/replay/shadow", () => {
  const employee = buildDefaultRevenueFollowThroughEmployee();
  let launch = readRftLaunch(null);
  const confirmed = applyRftLaunchPatch(launch, {
    confirmedContentHash: employee.operatingContract.rft.contentHash,
    confirmedContractVersion: employee.operatingContract.rft.contractVersion,
  });
  assert.equal(confirmed.ok, true);
  const withProve = applyRftLaunchPatch(confirmed.launch, { proveCardId: "card_prove_1" });
  assert.equal(withProve.ok, true);

  const evaluated = evaluateRftLaunch({
    installation: {
      configuration: {
        employees: [employee],
        rftLaunch: withProve.launch,
      },
    },
    connectionStatuses: {
      gmail: { status: "CONNECTED" },
      google_calendar: { status: "CONNECTED" },
    },
    proofRecords: {
      customer_email_send: { ok: true, verified: true },
      website_forms: { ok: true, verified: true, detail: { externalReference: "form_1" } },
    },
  });
  assert.equal(evaluated.summary.canGoLive, false);
  assert.equal(evaluated.steps.observe.status, "ready");
});

test("baseline marks calendar metrics not_observable when calendar disconnected", async () => {
  const { composeBaselineReport, buildObservationEventsFromInstallation } = await import("./rftObservation.js");
  const observation = buildObservationEventsFromInstallation({
    installation: {
      configuration: {
        gmailInbox: {
          messages: [{
            gmailMessageId: "m1",
            receivedAt: new Date().toISOString(),
            subject: "Hello",
            from: { email: "a@b.test" },
          }],
        },
        crm: { contacts: [], pipelines: [], calendarEvents: [] },
      },
    },
    connectionStatuses: { business_email: { status: "CONNECTED" } },
    windowDays: 30,
  });
  const baseline = composeBaselineReport({
    observation,
    connectionStatuses: { business_email: { status: "CONNECTED" } },
  });
  assert.equal(baseline.metrics.meetingsWithoutNextStep.status, "not_observable");
  assert.equal(baseline.metrics.opportunitiesDetected.status, "observable");
  assert.equal(baseline.metrics.opportunitiesDetected.count, 1);
  assert.ok(baseline.metrics.opportunitiesDetected.evidence[0].providerId);
});

test("historical replay classifies approval vs escalate and never claims outbound", async () => {
  const { runHistoricalReplay, classifyReplayOpportunity } = await import("./rftReplay.js");
  const employee = buildDefaultRevenueFollowThroughEmployee();
  const classified = classifyReplayOpportunity({
    event: {
      id: "e1",
      kind: "inbound_email",
      from: { email: "lead@x.test" },
      evidence: [{ kind: "gmail_message_id", providerId: "m1" }],
    },
    contract: employee.operatingContract,
  });
  assert.equal(classified.needsApproval, true);

  const missing = classifyReplayOpportunity({
    event: { id: "e2", kind: "form_lead", evidence: [] },
    contract: employee.operatingContract,
  });
  assert.equal(missing.wouldEscalate, true);

  const replay = runHistoricalReplay({
    installation: {
      configuration: {
        rftObservation: {
          events: [
            {
              id: "e1",
              kind: "inbound_email",
              from: { email: "lead@x.test" },
              evidence: [{ kind: "gmail_message_id", providerId: "m1" }],
            },
          ],
        },
      },
    },
    contract: employee.operatingContract,
  });
  assert.equal(replay.honesty.message.includes("No email"), true);
  assert.equal(replay.summary.wouldNeedApproval, 1);
  assert.equal(replay.passed, true);
});

test("empty historical replay is not a green pass", async () => {
  const { runHistoricalReplay } = await import("./rftReplay.js");
  const replay = runHistoricalReplay({
    installation: {
      configuration: {
        rftObservation: { events: [] },
      },
    },
  });
  assert.equal(replay.emptyWindow, true);
  assert.equal(replay.passed, false);
  assert.match(String(replay.passDetail), /Empty window/i);
});

test("shadow mode blocks outbound in executeSpecialtyPathSteps", async () => {
  const { executeSpecialtyPathSteps } = await import("../../specialty/executeSpecialtyPathSteps.js");
  const { PATH_STEP_TYPES, PATH_RUN_MODES } = await import("../automationPath.js");
  let sent = 0;
  const result = await executeSpecialtyPathSteps({
    employee: {
      operatingContract: {
        automationPath: {
          steps: [{
            id: "s1",
            type: PATH_STEP_TYPES.SEND_EMAIL,
            enabled: true,
            order: 1,
            label: "Ack",
            runMode: PATH_RUN_MODES.AUTO,
            subject: "Hi",
            body: "Hello",
          }],
        },
      },
    },
    eventPayload: { email: "lead@example.com", name: "Lead" },
    executionMode: "shadow",
    sendEmail: async () => {
      sent += 1;
      return { ok: true };
    },
  });
  assert.equal(sent, 0);
  assert.ok(result.notes.some((n) => String(n.reason).includes("shadow_proposed_no_outbound")));
});

test("applyRftLaunchPatch refuses fake-complete of blocked steps", () => {
  const launch = readRftLaunch(null);
  const blocked = applyRftLaunchPatch(launch, {
    steps: { observe: { status: "complete" } },
  });
  // Direct steps patch is ignored — only observeCompleted/replayPassed/shadowPassed mark complete
  assert.equal(blocked.ok, true);
  assert.notEqual(blocked.launch.steps.observe.status, "complete");
});

test("prove action maps to evidence kinds and extracts provider ids", () => {
  assert.equal(mapProveActionToEvidenceKind("send_test_email"), "gmail_message_id");
  assert.equal(mapProveActionToEvidenceKind("create_test_event"), "calendar_event_id");
  assert.equal(mapProveActionToEvidenceKind("submit_test_form"), "form_submission_id");
  assert.equal(mapProveActionToEvidenceKind("send_test_sms"), "twilio_message_sid");
  assert.equal(mapProveActionToEvidenceKind("sync_test_crm_contact"), "hubspot_record_id");
  assert.equal(
    mapProveActionToEvidenceKind("sync_test_crm_contact", {
      detail: { providerKind: "highlevel_record_id" },
    }),
    "highlevel_record_id",
  );
  assert.equal(
    extractProveProviderId({ detail: { externalReference: "msg_abc" } }),
    "msg_abc",
  );
  assert.equal(
    extractProveProviderId({ detail: { providerId: "hs_99" } }),
    "hs_99",
  );
  assert.equal(
    extractProveProviderId({ detail: { contactId: "contact_1", cardId: "card_1" } }),
    null,
  );
});

test("resolveExecutionModeFromInstallation stays shadow until goLiveAt exists", () => {
  assert.equal(resolveExecutionModeFromInstallation(null), "shadow");
  assert.equal(resolveExecutionModeFromInstallation({ configuration: { rftLaunch: {} } }), "shadow");
  assert.equal(
    resolveExecutionModeFromInstallation({
      configuration: { rftLaunch: { goLiveAt: "2026-08-05T12:00:00.000Z" } },
    }),
    "live",
  );
});

test("responsibility gate requires all design-partner fields", () => {
  const responsibility = readRftResponsibility({
    configuration: {
      employees: [buildDefaultRevenueFollowThroughEmployee()],
      rftResponsibility: {
        eligibleLeadSources: "Website inquiries and inbound email",
        responseSla: "5 minutes",
      },
    },
  });
  const gate = assertRftResponsibilityComplete(responsibility);
  assert.equal(gate.ok, false);
  assert.ok(gate.missing.some((entry) => entry.field === "qualificationBoundaries"));

  const completed = assertRftResponsibilityComplete({
    eligibleLeadSources: "Website inquiries and inbound email",
    operatingHours: "Weekdays 8am-6pm Eastern",
    responseSla: "5 minutes",
    qualificationBoundaries: "Qualified only when scope, budget, and timing are confirmed.",
    assignmentRules: "Assign to the account owner for the matching territory.",
    approvedActions: "Draft acknowledgement\nUpdate CRM\nSchedule existing customer follow-up",
    approvalRequiredActions: "Pricing exceptions\nNew outbound promises",
    escalationOwner: "Sales manager",
    successDefinition: "Acknowledged with provider-backed evidence and next step recorded.",
    lostDisqualifiedDefinition: "Lost when no-fit reason is recorded or the buyer declines.",
    proposalFollowUpSchedule: "Review every 3 days until resolved.",
    wonWorkHandoffRequirements: "Won opportunities require a handoff note before close.",
  });
  assert.equal(completed.ok, true);
});

test("attachProveEvidenceToRftOpportunity reaches Verified with provider id", async () => {
  const employee = buildDefaultRevenueFollowThroughEmployee();
  const installation = {
    id: "install_prove_rft",
    businessId: "biz_prove_rft",
    specificationId: "spec_prove",
    specificationVersion: 1,
    specificationContentHash: "abc",
    planId: "plan_prove",
    status: "installed",
    configuration: {
      employees: [employee],
      crm: { version: 1, contacts: [], pipelines: [], calendarEvents: [], ownerColors: {} },
      rftLaunch: {
        confirmedContentHash: employee.operatingContract.rft.contentHash,
        proveCardId: null,
      },
    },
  };
  const store = createMemoryPlatformStore(installation);

  const attached = await attachProveEvidenceToRftOpportunity({
    platformStore: store,
    installation: await store.getBusinessOSInstallation(),
    businessId: "biz_prove_rft",
    action: "send_test_email",
    proveResult: {
      ok: true,
      verified: true,
      message: "Sent",
      detail: { externalReference: "gmail_msg_prove_99" },
    },
    actorId: "test",
  });
  assert.equal(attached.ok, true);
  assert.ok(attached.cardId);
  assert.equal(attached.evidence[0].kind, "gmail_message_id");
  assert.equal(attached.evidence[0].providerId, "gmail_msg_prove_99");
  assert.equal(attached.state, "Verified");

  const install = await store.getBusinessOSInstallation();
  const launch = readRftLaunch(install);
  assert.equal(launch.proveCardId, attached.cardId);
  const trace = getRftOpportunityTrace(install, attached.cardId);
  assert.equal(trace.rft.state, "Verified");
  assert.ok(trace.rft.evidence.some((e) => e.providerId === "gmail_msg_prove_99"));
});
