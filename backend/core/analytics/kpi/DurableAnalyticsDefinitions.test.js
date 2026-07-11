import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? "postgresql://vibetech:vibetech@localhost:5432/vibetech_test";
process.env.VIBETECH_TEST_DB = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

import { runMigrations } from "../../platform/db/migrate.js";
import { closePool } from "../../platform/db/pool.js";
import { platformStore } from "../../platform/persistence/platformStore.js";
import { createMetricDefinition } from "./MetricDefinition.js";
import { AnalyticsEngine } from "./AnalyticsEngine.js";
import {
  loadAnalyticsEngineForBusiness,
  persistAnalyticsDefinitions,
  collectLiveAnalyticsEvidence,
} from "./DurableAnalyticsDefinitions.js";
import { calculateMetric } from "./CalculationEngine.js";
import { getMetricDefinition } from "./MetricCatalog.js";
import { isRegisteredDashboardComponent } from "../../business-os/BusinessOSDashboardComponentRegistry.js";
import { hashPassword } from "../../platform/services/AuthCredentialService.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../../workspace/activation/activateWorkspace.js";

function uid() {
  return randomUUID().slice(0, 8);
}

before(async () => {
  await runMigrations();
});

after(async () => {
  await closePool();
});

test("analytics definitions persist in Postgres across restart and multi-instance loads", async () => {
  const business = await platformStore.createBusiness({
    name: `Analytics Persist ${uid()}`,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: "Analytics" }),
  });
  const owner = await platformStore.createUser({
    email: `analytics-owner-${uid()}@test.vibetech.local`,
    name: "Owner",
    passwordHash: await hashPassword("password123"),
  });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });

  const engineA = await loadAnalyticsEngineForBusiness(platformStore, business.id);
  engineA.registerMetric(createMetricDefinition({
    metricId: "custom_ops_score",
    label: "Custom ops score",
    category: "operational",
    valueType: "quality",
    aggregation: "average",
    sourceRuntime: "work",
    sourceFields: ["opsScore"],
  }));
  engineA.setTarget("custom_ops_score", 0.85);
  engineA.saveReport({
    reportId: "ops_custom",
    label: "Custom ops",
    metricIds: ["custom_ops_score"],
    exportable: true,
  });
  engineA.store.setDashboardSelection("executive_home", ["kpis", "reports"]);
  engineA.store.setAlertPreference("overdue_work", true);
  await persistAnalyticsDefinitions(platformStore, business.id, engineA);

  // Simulate restart / second instance
  const engineB = await loadAnalyticsEngineForBusiness(platformStore, business.id);
  assert.equal(engineB.store.getMetricDefinition("custom_ops_score")?.label, "Custom ops score");
  assert.equal(engineB.store.getTarget("custom_ops_score")?.target, 0.85);
  assert.equal(engineB.listSavedReports().length, 1);
  assert.deepEqual(engineB.store.snapshot().dashboardSelections.executive_home.widgetIds, ["kpis", "reports"]);
  assert.equal(engineB.store.snapshot().alertPreferences.overdue_work, true);

  // Calculated values stay rederived — not in the persisted payload
  const row = await platformStore.getBusinessAnalyticsDefinitions(business.id);
  assert.equal(row.payload.results, undefined);
  assert.equal(row.payload.analyticsModel, undefined);

  // Cross-business isolation
  const other = await platformStore.createBusiness({
    name: `Analytics Other ${uid()}`,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: "Other" }),
  });
  const engineOther = await loadAnalyticsEngineForBusiness(platformStore, other.id);
  assert.equal(engineOther.store.getMetricDefinition("custom_ops_score"), null);
});

test("live evidence calculation uses approval work integration knowledge readiness bags", () => {
  const NOW = "2026-07-11T15:00:00.000Z";
  const evidence = collectLiveAnalyticsEvidence({
    loadWorkViewModel: () => ({
      items: [
        { id: "w1", title: "Open", status: "OPEN" },
        { id: "w2", title: "Done", status: "COMPLETED" },
      ],
      pendingApprovals: [{ id: "a1", title: "Campaign", status: "pending" }],
    }),
    loadConnectionCenterViewModel: () => ({
      systems: [
        { id: "i1", providerId: "gmail", label: "Gmail", health: "connected" },
        { id: "i2", providerId: "stripe", label: "Stripe", health: "error" },
      ],
    }),
    loadCommunicationViewModel: () => ({
      threads: [{ id: "t1", subject: "Hello", status: "open" }],
    }),
    loadSetupViewModel: () => ({
      readinessReport: { score: 0.7, status: "partial", blockers: [] },
    }),
  }, {
    knowledgeDocumentCount: 3,
    memberCount: 2,
    asOf: NOW,
  });

  assert.equal(evidence.workItems.length, 2);
  assert.equal(evidence.approvals.length, 1);
  assert.equal(evidence.integrations.length, 2);
  assert.equal(evidence.communications.length, 1);
  assert.equal(evidence.readiness.score, 0.7);

  const open = calculateMetric(getMetricDefinition("open_work_count"), evidence, { nowISO: NOW });
  assert.equal(open.value, 1);
  const pending = calculateMetric(getMetricDefinition("pending_approvals_count"), evidence, { nowISO: NOW });
  assert.equal(pending.value, 1);
  const failed = calculateMetric(getMetricDefinition("failed_integrations_count"), evidence, { nowISO: NOW });
  assert.equal(failed.value, 1);

  const recommended = new AnalyticsEngine().recommendAnalytics({
    businessSummary: { industry: "default" },
    businessId: "biz_live",
    evidence,
  });
  assert.equal(recommended.analyticsModel.tenantIsolation.businessId, "biz_live");
  assert.ok(isRegisteredDashboardComponent("kpi_cards"));
  assert.ok(isRegisteredDashboardComponent("reports"));
  assert.ok(recommended.dashboard.cards.some((card) => card.componentType === "kpi_cards"));
  assert.ok(recommended.businessOsMapping.dashboardDefinitions[0].widgets.some((widget) => widget.componentType === "kpi_cards"));
});
