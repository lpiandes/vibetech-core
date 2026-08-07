import test from "node:test";
import assert from "node:assert/strict";

import { composeSalesAnalyticsDashboard } from "./SalesAnalyticsDashboard.js";
import { emptyCrmState, upsertContact, upsertPipelineCard } from "../../crm/CrmStore.js";

function buildCrmWithCards() {
  let crm = emptyCrmState();
  crm = upsertContact(crm, { id: "contact_1", name: "Alex Lead", email: "alex@example.com" });
  crm = upsertContact(crm, { id: "contact_2", name: "Sam Won", email: "sam@example.com" });
  crm = upsertContact(crm, { id: "contact_3", name: "Jo Lost", email: "jo@example.com" });
  const pipe = crm.pipelines[0];
  const newStageId = pipe.stages.find((s) => s.id === "stage_new").id;
  const wonStageId = pipe.stages.find((s) => s.id === "stage_won").id;
  const lostStageId = pipe.stages.find((s) => s.id === "stage_lost").id;

  crm = upsertPipelineCard(crm, {
    pipelineId: pipe.id,
    card: { title: "Open deal", stageId: newStageId, contactId: "contact_1", value: 500 },
  }).crm;
  crm = upsertPipelineCard(crm, {
    pipelineId: pipe.id,
    card: { title: "Won deal", stageId: wonStageId, contactId: "contact_2", value: 1200 },
  }).crm;
  crm = upsertPipelineCard(crm, {
    pipelineId: pipe.id,
    card: { title: "Lost deal", stageId: lostStageId, contactId: "contact_3", value: 300 },
  }).crm;
  return crm;
}

test("composeSalesAnalyticsDashboard counts open/won/lost pipeline cards from real CRM state", () => {
  const crm = buildCrmWithCards();
  const installation = { businessId: "biz_sa_1", configuration: { crm } };

  const dashboard = composeSalesAnalyticsDashboard({ installation, businessId: "biz_sa_1" });

  assert.equal(dashboard.pipeline.totalContacts, 3);
  assert.equal(dashboard.pipeline.totalCards, 3);
  assert.equal(dashboard.pipeline.openCards, 1);
  assert.equal(dashboard.pipeline.wonCards, 1);
  assert.equal(dashboard.pipeline.lostCards, 1);
  assert.equal(dashboard.pipeline.openValue, 500);
  assert.equal(dashboard.pipeline.wonValue, 1200);
  assert.equal(dashboard.pipeline.byPipeline.length, 1);
  assert.ok(dashboard.pipeline.byPipeline[0].stages.length >= 3);
});

test("composeSalesAnalyticsDashboard marks work as not_observable when no workItems are supplied", () => {
  const installation = { businessId: "biz_sa_2", configuration: { crm: emptyCrmState() } };
  const dashboard = composeSalesAnalyticsDashboard({ installation, businessId: "biz_sa_2" });
  assert.equal(dashboard.work.status, "not_observable");
  assert.equal(dashboard.work.openWork, null);
});

test("composeSalesAnalyticsDashboard computes real work metrics when workItems are supplied", () => {
  const installation = { businessId: "biz_sa_3", configuration: { crm: emptyCrmState() } };
  const workItems = [
    { id: "w1", status: "in_progress" },
    { id: "w2", status: "completed" },
    { id: "w3", status: "blocked" },
  ];
  const dashboard = composeSalesAnalyticsDashboard({
    installation,
    businessId: "biz_sa_3",
    workItems,
    nowISO: "2026-08-07T12:00:00.000Z",
  });
  assert.equal(dashboard.work.status, "observable");
  assert.equal(dashboard.work.totalWork, 3);
  assert.equal(dashboard.work.openWork, 2);
  assert.equal(dashboard.work.blockedWork, 1);
});

test("composeSalesAnalyticsDashboard never invents outcomes counts beyond the ledger", () => {
  const installation = { businessId: "biz_sa_4", configuration: { crm: emptyCrmState() } };
  const dashboard = composeSalesAnalyticsDashboard({ installation, businessId: "biz_sa_4" });
  assert.equal(dashboard.outcomes.total, 0);
  assert.equal(dashboard.outcomes.proofBackedCompleted, 0);
  assert.ok(dashboard.honesty.message.length > 0);
});
