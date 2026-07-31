/**
 * Curated Launch Center missions for design partners.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCuratedLaunchMissions,
  resolveLaunchVertical,
} from "./buildCuratedLaunchMissions.js";

test("launch vertical uses industry/pack only — never business-name sniffing", () => {
  assert.equal(
    resolveLaunchVertical({ businessName: "Top Gun Hockey Club" }),
    "*",
  );
  assert.equal(
    resolveLaunchVertical({ businessName: "Bright Smile Dental", industry: "dental" }),
    "dental",
  );
  assert.equal(
    resolveLaunchVertical({ businessName: "Whalers", industry: "sports" }),
    "sports",
  );
});

test("sports launch is curated — not a checklist dump", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "sports",
    businessId: "biz_1",
    businessName: "Top Gun Hockey Club",
    connectionStatuses: {},
    proofRecords: {},
    checklist: [
      { id: "team", title: "Invite", complete: true },
      { id: "knowledge", title: "Knowledge", complete: false },
      { id: "email", title: "Email", complete: false },
      { id: "extra_1", title: "Extra", complete: true },
      { id: "extra_2", title: "Extra2", complete: true },
    ],
  });

  assert.equal(launch.vertical, "sports");
  assert.ok(launch.missions.length <= 10, `expected <=10 missions, got ${launch.missions.length}`);
  assert.ok(launch.missions.some((m) => m.id === "sports_registration_golden_path"));
  assert.ok(launch.missions.some((m) => m.id === "customer_email_send"));
  assert.ok(!launch.missions.some((m) => m.id === "team"), "checklist team must not inflate missions");
  assert.ok(!launch.missions.some((m) => m.id === "extra_1"));

  const voice = launch.missions.find((m) => m.id === "voice_calls");
  assert.ok(voice, "voice mission present");
  assert.equal(voice?.blocked, false);
  assert.equal(voice?.complete, false);
  assert.match(String(voice?.status ?? ""), /needs_setup|available|connected/);

  const forms = launch.missions.find((m) => m.id === "website_forms");
  assert.ok(forms, "website forms mission present");
  assert.equal(forms?.blocked, false);
  assert.match(String(forms?.href ?? ""), /\/intake/);

  const approvals = launch.missions.find((m) => m.id === "outbound_approvals");
  assert.equal(approvals?.canProveInline, true);
});

test("connected email unlocks prove on email mission", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "sports",
    businessId: "biz_1",
    connectionStatuses: { business_email: "CONNECTED" },
    proofRecords: {},
  });
  const email = launch.missions.find((m) => m.id === "customer_email_send");
  assert.equal(email?.status, "connected");
  assert.equal(email?.canProveInline, true);
  assert.equal(email?.complete, false);
});

test("proven email counts toward summary", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "sports",
    businessId: "biz_1",
    connectionStatuses: { business_email: "CONNECTED" },
    proofRecords: {
      customer_email_send: { ok: true, verified: true, at: "2026-07-18T12:00:00.000Z" },
    },
  });
  assert.ok(launch.summary.proven >= 1);
  const email = launch.missions.find((m) => m.id === "customer_email_send");
  assert.equal(email?.complete, true);
});

test("deferred knowledge moves to later without blocking next mission", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "dental",
    businessId: "biz_1",
    baseHref: "/b/biz_1",
    connectionStatuses: {
      business_email: "CONNECTED",
      calendar: "CONNECTED",
    },
    proofRecords: {
      customer_email_send: { ok: true, verified: true, at: "2026-07-18T12:00:00.000Z" },
      calendar_scheduling: { ok: true, verified: true, at: "2026-07-18T12:00:00.000Z" },
      knowledge_consult: { ok: false, deferredByOwner: true, detail: { deferredByOwner: true } },
    },
    knowledgeCount: 0,
  });
  const knowledge = launch.missions.find((m) => m.id === "knowledge_consult");
  assert.equal(knowledge?.blocked, false);
  assert.equal(knowledge?.status, "deferred");
  assert.equal(knowledge?.deferred, true);
  assert.match(String(knowledge?.href ?? ""), /\/knowledge/);
  assert.equal(launch.summary.nextId, "outbound_approvals");
});

test("live CONNECTED wins over stale ERROR snapshot row", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "sports",
    businessId: "biz_1",
    connectionStatuses: { sms_channel: "CONNECTED" },
    connections: [{ id: "sms_channel", status: "ERROR" }],
    proofRecords: {},
    smsSetup: { brandComplete: true },
  });
  const sms = launch.missions.find((m) => m.id === "sms_send");
  assert.equal(sms?.status, "connected");
  assert.notEqual(sms?.status, "failed");
});

test("connected SMS without brand stays on Set up (not Send test text)", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "dental",
    businessId: "biz_1",
    connectionStatuses: { sms_channel: "CONNECTED" },
    proofRecords: {},
    smsSetup: { brandComplete: false },
  });
  const sms = launch.missions.find((m) => m.id === "sms_send");
  assert.equal(sms?.needsBrandSetup, true);
  assert.equal(sms?.canProveInline, false);
  assert.equal(sms?.status, "needs_setup");
  assert.equal(sms?.actionLabel, "Set up");
  assert.match(String(sms?.detail ?? ""), /business|messaging|details/i);
});

test("connected SMS with brand unlocks Send test text", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "dental",
    businessId: "biz_1",
    connectionStatuses: { sms_channel: "CONNECTED" },
    proofRecords: {},
    smsSetup: { brandComplete: true },
  });
  const sms = launch.missions.find((m) => m.id === "sms_send");
  assert.equal(sms?.needsBrandSetup, false);
  assert.equal(sms?.canProveInline, true);
  assert.equal(sms?.actionLabel, "Send test text");
});

test("purchased packages scope sports launch away from Meta and golden path", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "sports",
    businessId: "biz_whalers",
    businessName: "Whalers Hockey Club",
    purchasedPackages: ["ai_receptionist", "crm_automation"],
  });
  const ids = launch.missions.map((m) => m.id);
  assert.ok(ids.includes("voice_calls"));
  assert.ok(ids.includes("knowledge_consult"));
  assert.ok(ids.includes("outbound_approvals"));
  assert.ok(!ids.includes("meta_lead_intake"), "Meta is lead-follow-up, not CRM");
  assert.ok(!ids.includes("sports_registration_golden_path"));
  assert.ok(!ids.includes("calendar_scheduling"));
  assert.ok(!ids.includes("sms_send"));
});

test("essential and growth managed launch missions all have prove actions", () => {
  for (const packageId of ["essential_managed", "growth_managed"]) {
    const launch = buildCuratedLaunchMissions({
      vertical: "sports",
      businessId: "biz_managed",
      businessName: "Managed Partner",
      purchasedPackages: [packageId],
    });
    assert.ok(launch.missions.length >= 1, packageId);
    for (const mission of launch.missions) {
      assert.ok(
        mission.proveAction,
        `${packageId} mission ${mission.id} missing proveAction`,
      );
    }
  }
});

test("basic_integration launch includes email calendar and SMS proves", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "*",
    businessId: "biz_basic",
    businessName: "Basic Integration Co",
    purchasedPackages: ["basic_integration"],
  });
  const ids = new Set(launch.missions.map((m) => m.id));
  assert.ok(ids.has("customer_email_send"));
  assert.ok(ids.has("calendar_scheduling"));
  assert.ok(ids.has("sms_send"));
});

test("meta setup pending flips Mission to Pending", () => {
  const launch = buildCuratedLaunchMissions({
    vertical: "sports",
    businessId: "biz_1",
    metaSetupPending: true,
  });
  const meta = launch.missions.find((m) => m.id === "meta_lead_intake");
  assert.ok(meta, "meta mission present");
  assert.equal(meta?.status, "pending_ops");
  assert.equal(meta?.actionLabel, "Pending");
  assert.equal(meta?.pendingOps, true);
  assert.equal(meta?.canProveInline, false);
});
