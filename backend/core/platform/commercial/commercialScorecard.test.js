/**
 * Commercial honesty scorecard — Done vs Not done only (no Partial).
 * Generated from live Offer Matrix + sell gates. Re-run after matrix changes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  listCommercialOffers,
  presentOfferMatrixSummary,
} from "./CommercialOfferMatrix.js";
import { canSellOffer } from "./CanSellOffer.js";
import { listSellableSalesPackagesForAdmin } from "../packages/SalesPackageCatalog.js";

test("scorecard: unfinished adapters are Not done / not sellable", () => {
  const notDone = [
    "AI Outbound Call Agent",
    "Social Media Content Automation",
    "Marketing Content Engine",
    "Sales Analytics Dashboard",
    "Document Processing Automation",
    "Reporting and Dashboard Automation",
    "CRM Integration",
    "Multi-System Integration",
    "Enterprise AI Deployment",
    "Professional",
    "Enterprise",
  ];
  for (const line of notDone) {
    const gate = canSellOffer({ sheetLine: line });
    assert.equal(gate.allowed, false, line);
  }
});

test("scorecard: beachhead + Wave A + Essential/Growth are Done / sellable", () => {
  const doneLines = [
    "Managed Revenue Follow-Through",
    "AI Receptionist",
    "Automated Lead Follow-Up",
    "Website Chatbot",
    "Internal Knowledge Base Assistant",
    "Basic System Integration",
    "Essential",
    "Growth",
    "Technology Stack Assessment",
    "Custom AI Application",
  ];
  for (const line of doneLines) {
    const gate = canSellOffer({ sheetLine: line });
    assert.equal(gate.allowed, true, `${line}: ${gate.reason}`);
  }
  const sellable = new Set(listSellableSalesPackagesForAdmin().map((r) => r.id));
  for (const id of [
    "managed_revenue_follow_through",
    "ai_receptionist",
    "lead_follow_up",
    "website_chatbot",
    "knowledge_assistant",
    "basic_integration",
    "essential_managed",
    "growth_managed",
  ]) {
    assert.ok(sellable.has(id), id);
  }
});

test("scorecard: matrix summary has both complete and building rows", () => {
  const summary = presentOfferMatrixSummary();
  assert.equal(summary.complete + summary.building, summary.total);
  assert.ok(summary.building >= 10, `expected building adapters, got ${summary.building}`);
  assert.ok(summary.complete >= 30, `expected operable lines, got ${summary.complete}`);
  // Every row is Done or Not done — never partial statuses.
  for (const row of listCommercialOffers()) {
    assert.ok(
      row.implementationStatus === "complete" || row.implementationStatus === "building",
      row.sheetLine,
    );
  }
});
