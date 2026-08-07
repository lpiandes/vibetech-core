import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMMERCIAL_OFFER_MATRIX,
  canOfferLine,
  getCommercialOffer,
  listCommercialOffers,
  listOfferableOffers,
  listOffersByClass,
  presentOfferMatrixSummary,
} from "./CommercialOfferMatrix.js";
import { listMissingPlaybooksForMatrix, assertPlaybookComplete } from "./DeliveryPlaybookRegistry.js";
import { canSellOffer, requiresA2pApproval } from "./CanSellOffer.js";
import {
  advanceCustomBuild,
  createCustomBuildRecord,
  isCustomBuildComplete,
  presentCustomBuild,
} from "./CustomBuildFactory.js";

test("commercial matrix covers all sheet sections", () => {
  const sections = new Set(listCommercialOffers().map((r) => r.sheetSection));
  for (const s of ["discovery", "voice", "sales", "ops", "integration", "managed", "addon", "usage"]) {
    assert.ok(sections.has(s), `missing section ${s}`);
  }
  assert.ok(COMMERCIAL_OFFER_MATRIX.length >= 50);
});

test("Managed RFT is ready and offerable", () => {
  const rft = getCommercialOffer("Managed Revenue Follow-Through");
  assert.equal(rft.offerClass, "ready");
  assert.equal(rft.implementationStatus, "complete");
  assert.equal(rft.packageId, "managed_revenue_follow_through");
  assert.equal(canOfferLine(rft.id), true);
  const gate = canSellOffer({ sheetLine: "Managed Revenue Follow-Through" });
  assert.equal(gate.allowed, true);
});

test("consulting lines are offerable", () => {
  const consulting = listOffersByClass("consulting");
  assert.ok(consulting.length >= 7);
  assert.ok(consulting.every((r) => r.implementationStatus === "complete"));
  const gate = canSellOffer({ sheetLine: "Technology Stack Assessment" });
  assert.equal(gate.allowed, true);
  assert.equal(gate.offerClass, "consulting");
});

test("every matrix row has a complete playbook", () => {
  const missing = listMissingPlaybooksForMatrix(listCommercialOffers());
  assert.deepEqual(missing, []);
  assert.equal(assertPlaybookComplete("custom_build_factory").ok, true);
});

test("listOfferableOffers excludes building rows", () => {
  const offerable = listOfferableOffers();
  assert.ok(offerable.every((r) => r.implementationStatus === "complete"));
  const summary = presentOfferMatrixSummary();
  assert.equal(summary.total, COMMERCIAL_OFFER_MATRIX.length);
  assert.equal(summary.complete + summary.building, summary.total);
});

test("canSellOffer allows complete Wave A ready lines", () => {
  const gate = canSellOffer({ sheetLine: "Automated Lead Follow-Up" });
  assert.equal(gate.allowed, true);
  assert.equal(gate.offerClass, "ready");
});

test("A2P gate is a soft, informational check by default", () => {
  const offer = getCommercialOffer("Automated Lead Follow-Up");
  assert.equal(requiresA2pApproval(offer), true);
  const previous = process.env.TWILIO_A2P_ENFORCE;
  delete process.env.TWILIO_A2P_ENFORCE;
  try {
    const gate = canSellOffer({ sheetLine: "Automated Lead Follow-Up" });
    assert.equal(gate.allowed, true);
    assert.equal(gate.requiresA2p, true);
  } finally {
    if (previous === undefined) delete process.env.TWILIO_A2P_ENFORCE;
    else process.env.TWILIO_A2P_ENFORCE = previous;
  }
});

test("A2P gate hard-blocks SMS offers when TWILIO_A2P_ENFORCE=1 and unapproved", () => {
  const previous = process.env.TWILIO_A2P_ENFORCE;
  process.env.TWILIO_A2P_ENFORCE = "1";
  try {
    const blocked = canSellOffer({ sheetLine: "Automated Lead Follow-Up" });
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.blockers.some((b) => /A2P/i.test(b)));

    const approved = canSellOffer({
      sheetLine: "Automated Lead Follow-Up",
      a2pRegistrationStatus: "approved",
    });
    assert.equal(approved.allowed, true);
  } finally {
    if (previous === undefined) delete process.env.TWILIO_A2P_ENFORCE;
    else process.env.TWILIO_A2P_ENFORCE = previous;
  }
});

test("non-SMS offers never require A2P approval", () => {
  const offer = getCommercialOffer("Managed Revenue Follow-Through");
  assert.equal(requiresA2pApproval(offer), false);
});

test("Custom Build Factory advances in order and blocks go_live without acceptance", () => {
  let record = createCustomBuildRecord({
    businessId: "biz_test",
    sheetLine: "Custom AI Application",
    brief: { industry: "services" },
  });
  assert.equal(isCustomBuildComplete(record), false);
  for (const step of ["intake", "scope", "architect", "install", "prove", "acceptance"]) {
    record = advanceCustomBuild(record, step, { evidence: { ok: true } });
  }
  assert.throws(() => advanceCustomBuild(
    createCustomBuildRecord({ businessId: "biz_test", sheetLine: "Custom AI Application" }),
    "go_live",
  ));
  record = advanceCustomBuild(record, "go_live");
  record = advanceCustomBuild(record, "handoff");
  assert.equal(isCustomBuildComplete(record), true);
  const view = presentCustomBuild(record);
  assert.equal(view.summary.complete, true);
  assert.equal(view.summary.completeCount, 8);
});
