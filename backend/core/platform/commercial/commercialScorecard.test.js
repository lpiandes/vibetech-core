/**
 * Commercial honesty scorecard — Done vs Not done only (no Partial).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  listCommercialOffers,
  presentOfferMatrixSummary,
} from "./CommercialOfferMatrix.js";
import { canSellOffer } from "./CanSellOffer.js";
import { listSellableSalesPackagesForAdmin } from "../packages/SalesPackageCatalog.js";

test("scorecard: Wave B/C product lines are Done / sellable", () => {
  const doneLines = [
    "Managed Revenue Follow-Through",
    "AI Receptionist",
    "Automated Lead Follow-Up",
    "Website Chatbot",
    "Native Website Chatbot",
    "Internal Knowledge Base Assistant",
    "Basic System Integration",
    "AI Sales Assistant",
    "CRM Automation",
    "Scheduling Automation",
    "AI Outbound Call Agent",
    "Social Media Content Automation",
    "Marketing Content Engine",
    "Sales Analytics Dashboard",
    "Document Processing Automation",
    "Reporting and Dashboard Automation",
    "CRM Integration",
    "Multi-System Integration",
    "Essential",
    "Growth",
    "Professional",
    "Enterprise",
    "Additional AI Agent",
    "Custom AI Application",
    "Technology Stack Assessment",
  ];
  for (const line of doneLines) {
    const gate = canSellOffer({ sheetLine: line });
    assert.equal(gate.allowed, true, `${line}: ${gate.reason} ${JSON.stringify(gate.blockers)}`);
  }
});

test("scorecard: executive dashboard stays Not done until BI surface ships", () => {
  const gate = canSellOffer({ sheetLine: "Executive Dashboard" });
  assert.equal(gate.allowed, false);
});

test("scorecard: Create & invite includes Wave B products", () => {
  const sellable = new Set(listSellableSalesPackagesForAdmin().map((r) => r.id));
  for (const id of [
    "managed_revenue_follow_through",
    "sales_assistant",
    "crm_automation",
    "scheduling",
    "website_native_chat",
    "voice_outbound_agent",
    "social_content_automation",
    "crm_external_integration",
    "professional_managed",
    "essential_managed",
  ]) {
    assert.ok(sellable.has(id), id);
  }
});

test("scorecard: matrix summary mostly complete", () => {
  const summary = presentOfferMatrixSummary();
  assert.equal(summary.complete + summary.building, summary.total);
  assert.ok(summary.complete >= 50, `expected mostly complete, got ${summary.complete}`);
  assert.ok(summary.building <= 5, `expected few building, got ${summary.building}`);
  for (const row of listCommercialOffers()) {
    assert.ok(
      row.implementationStatus === "complete" || row.implementationStatus === "building",
      row.sheetLine,
    );
  }
});
