import assert from "node:assert/strict";
import { test } from "node:test";

import { ArchitectIntelligenceEngine } from "./ArchitectIntelligenceEngine.js";
import { ARCHITECT_PIPELINE_STAGES } from "./ArchitectPipeline.js";
import { validateArchitectStageResult } from "./ArchitectStageResult.js";
import { BusinessWebsiteResearchService } from "../ai-builder/BusinessWebsiteResearchService.js";
import { exportMcBrideBusinessOSSpecification } from "../business-os/McBrideBusinessOSAdapter.js";
import {
  BLUEPRINT_RESOLUTION_ORDER,
  assertResolutionOrderIntact,
  resolveReusePreference,
} from "../platform/constitution/BlueprintResolutionOrder.js";
import {
  validateBusinessDna,
} from "../platform/contracts/BusinessDna.js";
import {
  createBusinessIntelligenceGraph,
  validateBusinessIntelligenceGraph,
  createGraphNode,
  createGraphEdge,
} from "../platform/contracts/BusinessIntelligenceGraph.js";
import {
  assertAllRendererContractsRegistered,
} from "../platform/contracts/UniversalRendererContracts.js";
import {
  validateComponentRegistryContract,
  isRegisteredComponent,
} from "../platform/contracts/ComponentRegistryContract.js";
import {
  validateExclusiveLayerAssignment,
  classifyExtension,
} from "../platform/constitution/ExtensionRules.js";
import {
  requireGovernedInstallPath,
  validateLifecycleTransition,
} from "../platform/constitution/AiArchitectLifecycle.js";

const NOW = () => "2026-07-11T18:00:00.000Z";

function engineWithFixtures() {
  const fixtures = new Map([
    ["https://harbor.pm.example", {
      text: "Harbor Property Group\nLeasing and maintenance for residents and owners\nAustin and Dallas",
    }],
    ["https://smile.dental.example", {
      text: "Smile Dental\nCleanings and exams\nPatients welcome",
    }],
  ]);
  return new ArchitectIntelligenceEngine({
    researchService: new BusinessWebsiteResearchService({ fixtures }),
    nowISO: NOW,
  });
}

test("architect pipeline runs all stages with stage contracts", async () => {
  const engine = engineWithFixtures();
  const result = await engine.run({
    businessId: "biz_architect_pm",
    businessName: "Harbor Property Group",
    industry: "property_management",
    description: "Residential property management with leasing, maintenance, and owner communication.",
    websiteUrl: "https://harbor.pm.example",
    documents: [{
      filename: "leasing-sop.pdf",
      mimeType: "application/pdf",
      textPreview: "Leasing SOP for new residents",
    }],
  });

  assert.equal(result.role, "business_systems_architect");
  assert.deepEqual(result.pipeline, ARCHITECT_PIPELINE_STAGES);
  assert.equal(result.stages.length, ARCHITECT_PIPELINE_STAGES.length);
  for (const stage of result.stages) {
    assert.equal(validateArchitectStageResult(stage).ok, true);
    assert.ok(stage.inputs);
    assert.ok(stage.outputs);
    assert.ok(stage.confidence);
    assert.ok(Array.isArray(stage.evidence));
    assert.ok(Array.isArray(stage.unresolvedQuestions));
    assert.ok(Array.isArray(stage.recommendations));
  }
});

test("adaptive discovery and Business DNA generation", async () => {
  const engine = engineWithFixtures();
  const result = await engine.run({
    businessName: "Smile Dental",
    industry: "dental",
    description: "A dental practice with patients, hygienists, and recall work.",
    websiteUrl: "https://smile.dental.example",
  });

  const discovery = result.stages.find((entry) => entry.stageId === "business_discovery");
  assert.ok(discovery.outputs.nextQuestions);
  assert.equal(validateBusinessDna(result.businessDna).ok, true);
  assert.ok(result.businessDna.company.name);
  assert.notEqual(result.businessDna.contract, "BusinessOSSpecification");
  assert.equal(result.businessDna.contract, "BusinessDna/v1");
});

test("blueprint matching respects reuse order and prefers gold for PM", async () => {
  assertResolutionOrderIntact(BLUEPRINT_RESOLUTION_ORDER);
  const preference = resolveReusePreference({
    hasInstalledConfiguration: false,
    hasGoldBlueprint: true,
    hasIndustryBlueprint: true,
    hasReusableComponent: true,
  });
  assert.equal(preference.selected, "gold_blueprints");

  const engine = engineWithFixtures();
  const result = await engine.run({
    businessName: "Harbor",
    industry: "property_management",
    description: "property management leasing and maintenance",
  });
  const matching = result.stages.find((entry) => entry.stageId === "blueprint_matching");
  assert.deepEqual(matching.outputs.reuseOrder, BLUEPRINT_RESOLUTION_ORDER);
  assert.ok(/gold|property/i.test(matching.outputs.selectedBlueprint?.label ?? ""));
});

test("component reuse, employees, workflows, dashboards, and gaps", async () => {
  const engine = engineWithFixtures();
  const result = await engine.run({
    businessName: "Northline Hockey",
    industry: "sports",
    description: "Hockey travel club with teams, coaches, and parent communications. Considering payroll later.",
  });

  assert.ok(result.stages.find((entry) => entry.stageId === "component_matching").outputs.recommendations.length);
  assert.ok(result.stages.find((entry) => entry.stageId === "employee_generation").outputs.employees.length);
  assert.ok(result.stages.find((entry) => entry.stageId === "object_generation").outputs.objects.length);
  assert.ok(result.stages.find((entry) => entry.stageId === "workflow_generation").outputs.workflows.length);
  assert.ok(result.stages.find((entry) => entry.stageId === "workflow_generation").outputs.workflowModel);
  assert.ok(result.stages.find((entry) => entry.stageId === "integration_generation").outputs.integrations.length);
  assert.ok(result.stages.find((entry) => entry.stageId === "integration_generation").outputs.integrationModel);
  assert.ok(result.stages.find((entry) => entry.stageId === "dashboard_generation").outputs.dashboard.cards.length);
  assert.ok(result.stages.find((entry) => entry.stageId === "dashboard_generation").outputs.analyticsModel);
  const gaps = result.stages.find((entry) => entry.stageId === "gap_analysis").outputs.gaps;
  assert.ok(gaps.some((gap) => /payroll/i.test(gap.label) || gap.architectClass === "unsupported"));
  assert.ok(result.specification?.modules?.length);
  assert.ok(!/class HockeyRuntime|HockeyPlayerRuntime/.test(JSON.stringify(result.specification)));
  assert.ok(!result.specification.subjectDefinitions?.some((entry) => /Runtime$/i.test(entry.subjectType)));
});

test("continuous improvement modifies affected parts only", async () => {
  const engine = engineWithFixtures();
  const baseline = await engine.run({
    businessName: "Improve Co",
    industry: "property_management",
    description: "property management company",
  });
  const improvement = await engine.improve({
    prompt: "We opened another office and now offer rentals.",
    installedSpecification: baseline.specification,
    dna: baseline.businessDna,
  });
  assert.equal(improvement.stageId, "continuous_improvement_planning");
  assert.equal(improvement.outputs.regenerateEverything, false);
  assert.equal(improvement.outputs.requiresDryRun, true);
  assert.equal(improvement.outputs.requiresApproval, true);
  assert.ok(improvement.outputs.affectedAreas.includes("business_dna")
    || improvement.outputs.affectedAreas.includes("modules")
    || improvement.outputs.affectedAreas.length >= 1);
  assert.notEqual(
    improvement.outputs.nextSpecification.contentHash,
    baseline.specification.contentHash,
  );
});

test("multi-industry reasoning produces distinct DNA and OS", async () => {
  const engine = engineWithFixtures();
  const dental = await engine.run({
    businessName: "Dental Co",
    industry: "dental",
    description: "dental practice with patients and appointments",
  });
  const hockey = await engine.run({
    businessName: "Hockey Co",
    industry: "sports",
    description: "hockey travel club with teams and scouting",
  });
  assert.ok(dental.specification.modules.some((module) => module.label === "Patients" || module.moduleId === "appointments"));
  assert.ok(hockey.specification.modules.some((module) => module.moduleId === "teams" || /scout|team/i.test(module.label ?? "")));
  assert.notEqual(
    JSON.stringify(dental.businessDna.kpis),
    JSON.stringify(hockey.businessDna.kpis),
  );
});

test("tenant isolation: separate businessIds stay separate in outputs", async () => {
  const engine = engineWithFixtures();
  const a = await engine.run({
    businessId: "tenant_a",
    businessName: "A Co",
    industry: "dental",
    description: "dental practice",
  });
  const b = await engine.run({
    businessId: "tenant_b",
    businessName: "B Co",
    industry: "sports",
    description: "hockey club",
  });
  assert.equal(a.specification.businessId, "tenant_a");
  assert.equal(b.specification.businessId, "tenant_b");
  assert.notEqual(a.businessDna.dnaId, b.businessDna.dnaId);
});

test("confidence explanations are present on stages", async () => {
  const engine = engineWithFixtures();
  const result = await engine.run({
    description: "A small professional services firm",
  });
  for (const stage of result.stages) {
    assert.ok(["high", "medium", "low", "unknown"].includes(stage.confidence));
  }
  assert.ok(result.consultantNotes.length >= 1);
});

test("platform constitution contracts remain valid", () => {
  assert.equal(assertAllRendererContractsRegistered().ok, true);
  assert.equal(validateComponentRegistryContract().ok, true);
  assert.equal(isRegisteredComponent("dashboard_card", "evil_widget"), false);

  const extensions = [
    classifyExtension({ extensionId: "work_queue", layer: "platform" }),
    classifyExtension({ extensionId: "pm_gold", layer: "blueprint" }),
    classifyExtension({ extensionId: "acme_labels", layer: "configuration" }),
  ];
  assert.equal(validateExclusiveLayerAssignment(extensions).ok, true);

  assert.equal(validateLifecycleTransition({ from: "preview", to: "dry_run" }).ok, true);
  assert.equal(validateLifecycleTransition({ from: "discovery", to: "install" }).ok, false);
  assert.equal(requireGovernedInstallPath(["preview", "dry_run", "approval", "install"]).ok, true);

  const graph = createBusinessIntelligenceGraph({
    nodes: [
      createGraphNode({ nodeId: "n1", kind: "service", label: "Leasing" }),
      createGraphNode({ nodeId: "n2", kind: "workflow", label: "Follow-up" }),
    ],
    edges: [
      createGraphEdge({ edgeId: "e1", kind: "produces", fromNodeId: "n1", toNodeId: "n2" }),
    ],
  });
  assert.equal(validateBusinessIntelligenceGraph(graph).ok, true);

  // McBride still exports a valid Business OS — no regression of foundation.
  const mcbride = exportMcBrideBusinessOSSpecification();
  assert.ok(mcbride.modules.some((module) => module.moduleId === "properties"));
});
