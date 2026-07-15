import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessWebsiteResearchService } from "./BusinessWebsiteResearchService.js";
import { validateWebsiteUrl } from "./WebsiteFetchPolicy.js";
import { extractWebsiteEvidence } from "./WebsiteEvidenceExtractor.js";
import {
  classifyBuilderArtifact,
  extractBuilderArtifactEvidence,
  createBuilderArtifactMappingProposal,
} from "./BuilderArtifactClassifier.js";

test("website policy rejects authenticated and unapproved URLs", () => {
  assert.equal(validateWebsiteUrl("https://user:pass@example.com").ok, false);
  assert.equal(validateWebsiteUrl("https://example.com", { approvedUrls: ["https://other.com"] }).ok, false);
  assert.equal(validateWebsiteUrl("https://example.com", { approvedUrls: ["https://example.com"] }).ok, true);
});

test("website policy accepts bare domains like www.magna-mare.com", () => {
  const result = validateWebsiteUrl("www.magna-mare.com");
  assert.equal(result.ok, true);
  assert.match(String(result.url), /^https:\/\/www\.magna-mare\.com\/?$/);
  const approved = validateWebsiteUrl("www.magna-mare.com", {
    approvedUrls: ["www.magna-mare.com"],
  });
  assert.equal(approved.ok, true);
});

test("website research uses fixtures and never installs capabilities", async () => {
  const fixtures = new Map([
    ["https://northline.hockey.example", {
      text: "Northline Travel Hockey Club\nPractices and tournaments\nContact parents and coaches\nServing Boston",
    }],
  ]);
  const service = new BusinessWebsiteResearchService({ fixtures });
  const result = await service.research({
    websiteUrl: "https://northline.hockey.example",
    nowISO: "2026-07-11T12:30:00.000Z",
  });
  assert.equal(result.ok, true);
  assert.equal(result.report.canInstallCapabilities, false);
  assert.ok(result.report.findings.industrySignals.includes("sports"));
  assert.equal(result.evidence.mutatesCanonicalData, false);
});

test("website research falls back when fetch unavailable", async () => {
  const service = new BusinessWebsiteResearchService();
  const failed = await service.research({ websiteUrl: "https://example.com" });
  assert.equal(failed.ok, false);
  assert.equal(failed.fallbackAvailable, true);

  const manual = await service.research({
    websiteUrl: "https://example.com",
    manualFallbackText: "Bright Smile Dental — cleanings and treatment plans for patients.",
  });
  assert.equal(manual.ok, true);
  assert.equal(manual.usedManualFallback, true);
  assert.ok(manual.report.findings.industrySignals.includes("dental"));
});

test("artifact intake classifies without canonical mutation and requires confirmation", () => {
  assert.equal(classifyBuilderArtifact({ filename: "crm-export.csv" }), "CRM_export");
  assert.equal(classifyBuilderArtifact({ filename: "employee-handbook.pdf", notes: "policy" }), "policy");

  const evidence = extractBuilderArtifactEvidence({
    artifactId: "art_1",
    filename: "properties.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    textPreview: "address,city,beds\n1 Main,Austin,3",
  });
  assert.equal(evidence.classification, "property_item_inventory");
  assert.equal(evidence.mutatesCanonicalData, false);
  assert.equal(evidence.requiresUserConfirmation, true);

  const proposal = createBuilderArtifactMappingProposal(evidence, { confirmed: false });
  assert.equal(proposal.confirmed, false);
  assert.match(proposal.explanation, /Confirm/);
  assert.equal(proposal.mapping.action, "propose_subject_import_dry_run");
});

test("extractor labels uncertainty honestly", () => {
  const extraction = extractWebsiteEvidence({
    url: "https://blank.example",
    text: "Hello world",
  });
  assert.ok(extraction.uncertainFields.includes("services"));
  assert.equal(extraction.canInstallCapabilities, false);
});
