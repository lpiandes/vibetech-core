import test from "node:test";
import assert from "node:assert/strict";
import {
  OPS_STATUS,
  resolveWhiteGloveOwnerPhase,
  whiteGloveBlocksConnectComplete,
  buildPendingOpsRequest,
  markOpsRequestReady,
} from "./whiteGloveOpsState.js";
import {
  isWhiteGloveConnection,
  resolveWhiteGloveNeedsForPackages,
  normalizeConnectionId,
} from "./WhiteGloveConnectionRegistry.js";
import { resolveWhiteGloveNeeds, inferWhiteGloveIdsFromConfiguration } from "./resolveWhiteGloveNeeds.js";
import { evaluateOwnerSetupSteps } from "../../platform/commercial/resolveOwnerSetupPath.js";
import { proveActionForConnectionId } from "../connectionProveRegistry.js";
import { markWhiteGloveReady } from "./requestWhiteGloveSetup.js";

test("voice/sms/hubspot are white-glove; email is self-serve", () => {
  assert.equal(isWhiteGloveConnection("voice_channel"), true);
  assert.equal(isWhiteGloveConnection("phone"), true);
  assert.equal(normalizeConnectionId("phone"), "voice_channel");
  assert.equal(isWhiteGloveConnection("business_email"), false);
});

test("owner phase: request → pending → connected wins over ops_ready", () => {
  assert.equal(resolveWhiteGloveOwnerPhase({
    connectionId: "voice_channel",
    connectionStatus: "NOT_CONNECTED",
    pendingOpsRequests: {},
  }), "request");

  const pending = buildPendingOpsRequest({ connectionId: "voice_channel" });
  assert.equal(resolveWhiteGloveOwnerPhase({
    connectionId: "voice_channel",
    connectionStatus: "NOT_CONNECTED",
    pendingOpsRequests: { voice_channel: pending },
  }), "pending");

  const ready = markOpsRequestReady(pending, { actorId: "admin" });
  assert.equal(resolveWhiteGloveOwnerPhase({
    connectionId: "voice_channel",
    connectionStatus: "NOT_CONNECTED",
    pendingOpsRequests: { voice_channel: ready },
  }), "good_to_go");

  assert.equal(resolveWhiteGloveOwnerPhase({
    connectionId: "voice_channel",
    connectionStatus: "CONNECTED",
    pendingOpsRequests: { voice_channel: ready },
  }), "connected");
});

test("OR connect: HubSpot connected does not block on HighLevel request", () => {
  assert.equal(whiteGloveBlocksConnectComplete({
    connectionIds: ["hubspot", "highlevel"],
    connectionStatuses: { hubspot: "CONNECTED" },
    pendingOpsRequests: {},
  }), false);
});

test("checklist connect stays incomplete while pending_ops", () => {
  const pending = buildPendingOpsRequest({ connectionId: "voice_channel" });
  const evalPending = evaluateOwnerSetupSteps({
    packageId: "ai_receptionist",
    connectionStatuses: {},
    pendingOpsRequests: { voice_channel: pending },
    proofRecords: {},
    knowledgeCount: 0,
  });
  const phone = evalPending.steps.find((s) => s.id === "connect_phone");
  assert.equal(phone?.complete, false);
  assert.match(String(phone?.detail ?? ""), /Hold on|VIBETech/i);
});

test("lead follow-up does not auto-need SMS; CRM anyOf HubSpot|HighLevel|Salesforce", () => {
  const lead = resolveWhiteGloveNeedsForPackages(["lead_follow_up"]);
  assert.equal(lead.length, 0);
  const crm = resolveWhiteGloveNeedsForPackages(["crm_external_integration"]);
  const ids = crm.map((c) => c.connectionId).sort();
  assert.deepEqual(ids, ["highlevel", "hubspot", "salesforce"]);
});

test("Salesforce attestation satisfies CRM connect without vault Connected", () => {
  const ready = markOpsRequestReady(
    buildPendingOpsRequest({ connectionId: "salesforce" }),
    { actorId: "admin" },
  );
  assert.equal(whiteGloveBlocksConnectComplete({
    connectionIds: ["hubspot", "highlevel", "salesforce"],
    connectionStatuses: {},
    pendingOpsRequests: { salesforce: ready },
  }), false);

  const evaluated = evaluateOwnerSetupSteps({
    packageId: "crm_external_integration",
    connectionStatuses: {},
    pendingOpsRequests: { salesforce: ready },
    proofRecords: {},
    knowledgeCount: 0,
  });
  const connect = evaluated.steps.find((s) => s.kind === "connect");
  const testStep = evaluated.steps.find((s) => s.kind === "test");
  assert.equal(connect?.complete, true);
  assert.equal(testStep?.complete, true);
  assert.equal(evaluated.summary.canGoLive, true);
});

test("SMS connect step stays incomplete until A2P approved", () => {
  const pending = evaluateOwnerSetupSteps({
    packageId: "essential_managed",
    connectionStatuses: {
      business_email: "CONNECTED",
      sms_channel: { status: "CONNECTED", a2pRegistrationStatus: "pending" },
    },
    proofRecords: { customer_email_send: { ok: true }, sms_send: { ok: true } },
    knowledgeCount: 1,
  });
  assert.equal(pending.steps.find((s) => s.id === "connect_sms")?.complete, false);
  assert.match(String(pending.steps.find((s) => s.id === "connect_sms")?.detail ?? ""), /carrier/i);
  assert.equal(pending.summary.canGoLive, false);

  const approved = evaluateOwnerSetupSteps({
    packageId: "essential_managed",
    connectionStatuses: {
      business_email: "CONNECTED",
      sms_channel: { status: "CONNECTED", a2pRegistrationStatus: "approved" },
    },
    proofRecords: { customer_email_send: { ok: true }, sms_send: { ok: true } },
    knowledgeCount: 1,
  });
  assert.equal(approved.steps.find((s) => s.id === "connect_sms")?.complete, true);
  assert.equal(approved.summary.canGoLive, true);
});

test("growth managed requires voice Test before go-live", () => {
  const blocked = evaluateOwnerSetupSteps({
    packageId: "growth_managed",
    connectionStatuses: { business_email: "CONNECTED", voice_channel: "CONNECTED" },
    proofRecords: { customer_email_send: { ok: true } },
    knowledgeCount: 1,
  });
  assert.equal(blocked.steps.find((s) => s.id === "test_call")?.complete, false);
  assert.equal(blocked.summary.canGoLive, false);
});

test("custom build config infers white-glove channels", () => {
  const ids = inferWhiteGloveIdsFromConfiguration({
    businessSummary: { integrationNeeds: ["phone", "hubspot"] },
    builderInputs: { communications: "We need Meta lead forms and texting" },
  });
  assert.ok(ids.includes("voice_channel"));
  assert.ok(ids.includes("hubspot"));
  assert.ok(ids.includes("meta_lead_ads"));
  assert.ok(ids.includes("sms_channel"));
});

test("resolveWhiteGloveNeeds merges packages + OS config", () => {
  const needs = resolveWhiteGloveNeeds({
    purchasedPackages: ["ai_receptionist"],
    configuration: { integrationNeeds: ["meta_lead_ads"] },
  });
  const ids = needs.map((n) => n.connectionId);
  assert.ok(ids.includes("voice_channel"));
  assert.ok(ids.includes("meta_lead_ads"));
});

test("voice channel exposes prove action", () => {
  const prove = proveActionForConnectionId("voice_channel");
  assert.equal(prove?.action, "place_test_call");
  assert.equal(prove?.capabilityId, "voice_calls");
});

test("markWhiteGloveReady requires Connected by default", async () => {
  const store = {
    async getBusinessById() {
      return { id: "b1", packageConfiguration: {} };
    },
    async getBusinessOSInstallation() {
      return { id: "i1", configuration: {} };
    },
    async listIntegrationCredentialsForWorkspace() {
      return [];
    },
    async updateBusinessPackageConfiguration() {},
    async upsertBusinessOSInstallation() {},
  };
  const blocked = await markWhiteGloveReady({
    platformStore: store,
    businessId: "b1",
    connectionId: "voice_channel",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "not_connected");

  const writes = [];
  const salesforceStore = {
    ...store,
    async updateBusinessPackageConfiguration(payload) {
      writes.push(payload);
    },
  };
  const attested = await markWhiteGloveReady({
    platformStore: salesforceStore,
    businessId: "b1",
    connectionId: "salesforce",
  });
  assert.equal(attested.ok, true);
  assert.ok(writes.length);
});