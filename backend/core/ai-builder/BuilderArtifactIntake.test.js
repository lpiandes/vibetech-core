import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyBuilderArtifact,
  extractBuilderArtifactEvidence,
  createBuilderArtifactMappingProposal,
  ARTIFACT_CLASSIFICATIONS,
} from "./BuilderArtifactClassifier.js";

test("artifact classifications cover required intake types", () => {
  for (const kind of [
    "SOP",
    "policy",
    "service_catalog",
    "price_list",
    "team_roster",
    "CRM_export",
    "customer_list",
    "property_item_inventory",
    "workflow_description",
    "integration_export",
    "knowledge_document",
    "unknown",
  ]) {
    assert.ok(ARTIFACT_CLASSIFICATIONS.includes(kind), kind);
  }
});

test("mapping proposals stay non-mutating until confirmed", () => {
  const evidence = extractBuilderArtifactEvidence({
    artifactId: "art_crm",
    filename: "patients-crm.csv",
    notes: "customer list",
    textPreview: "name,email\nAda,ada@example.com",
  });
  assert.equal(evidence.classification, "CRM_export");
  const proposal = createBuilderArtifactMappingProposal(evidence, { confirmed: true });
  assert.equal(proposal.mutatesCanonicalData, false);
  assert.equal(proposal.mapping.destination, "import_pipeline");
  assert.equal(classifyBuilderArtifact({ filename: "mystery.bin" }), "unknown");
});
