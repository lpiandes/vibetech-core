import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCapabilityStatusReport,
  capabilityReportToLaunchMissions,
  listCapabilitiesForVertical,
  resolveCapabilityStatus,
  PLATFORM_CAPABILITIES,
} from "./PlatformCapabilityStatusRegistry.js";

test("platform capabilities include sports and dental golden paths", () => {
  const ids = PLATFORM_CAPABILITIES.map((c) => c.id);
  assert.ok(ids.includes("sports_registration_golden_path"));
  assert.ok(ids.includes("dental_intake_golden_path"));
  assert.ok(ids.includes("customer_email_send"));
});

test("OAuth connected alone is never proven", () => {
  const cap = PLATFORM_CAPABILITIES.find((c) => c.id === "customer_email_send");
  const status = resolveCapabilityStatus({
    capability: cap,
    connectionStatuses: { business_email: "CONNECTED" },
    proofRecords: {},
  });
  assert.equal(status, "connected");
});

test("proven requires successful proveAction record", () => {
  const cap = PLATFORM_CAPABILITIES.find((c) => c.id === "customer_email_send");
  const status = resolveCapabilityStatus({
    capability: cap,
    connectionStatuses: { business_email: "CONNECTED" },
    proofRecords: { customer_email_send: { ok: true, at: "2026-07-18T00:00:00.000Z" } },
  });
  assert.equal(status, "proven");
});

test("sports vertical lists sports golden path and hides PM PMS by default", () => {
  const report = buildCapabilityStatusReport({
    vertical: "sports",
    connectionStatuses: {},
    workspaceGate: { industry: "sports", operatingPackId: "youth_sports_v1" },
  });
  assert.ok(report.items.some((i) => i.id === "sports_registration_golden_path"));
  assert.ok(!report.items.some((i) => i.id === "property_pms"));
  assert.match(report.rule, /never proven/i);
});

test("launch missions use honest email wording", () => {
  const report = buildCapabilityStatusReport({ vertical: "dental" });
  const missions = capabilityReportToLaunchMissions(report, { businessId: "biz_1" });
  const email = missions.find((m) => m.id === "customer_email_send");
  assert.ok(email);
  assert.match(email.title, /approved/i);
  assert.equal(email.complete, false);
});

test("listCapabilitiesForVertical normalizes youth sports aliases", () => {
  const caps = listCapabilitiesForVertical("youth_sports");
  assert.ok(caps.some((c) => c.id === "sports_registration_golden_path"));
});

test("knowledge is not proven without documents even if proof record exists", () => {
  const cap = PLATFORM_CAPABILITIES.find((c) => c.id === "knowledge_consult");
  const status = resolveCapabilityStatus({
    capability: cap,
    proofRecords: { knowledge_consult: { ok: true, at: "2026-07-18T00:00:00.000Z" } },
    knowledgeCount: 0,
  });
  assert.equal(status, "needs_setup");
});

test("calendar scheduling registers book_test_slot as an alternate deeper prove", () => {
  const cap = PLATFORM_CAPABILITIES.find((c) => c.id === "calendar_scheduling");
  assert.equal(cap.proveAction, "create_test_event");
  assert.equal(cap.alternateProveAction, "book_test_slot");
});

test("knowledge is proven only with docs + successful prove", () => {
  const cap = PLATFORM_CAPABILITIES.find((c) => c.id === "knowledge_consult");
  const status = resolveCapabilityStatus({
    capability: cap,
    proofRecords: { knowledge_consult: { ok: true, at: "2026-07-18T00:00:00.000Z" } },
    knowledgeCount: 2,
  });
  assert.equal(status, "proven");
});
