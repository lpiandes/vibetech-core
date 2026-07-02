import assert from "node:assert/strict";
import { test } from "node:test";

import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { WorkspaceGenerator } from "../WorkspaceGenerator.js";
import { createWorkspaceConfiguration } from "../WorkspaceConfiguration.js";
import { WorkspaceViewAdapter } from "./WorkspaceViewAdapter.js";
import { validateWorkspaceViews } from "./WorkspaceViewValidator.js";
import { COMPANY_EVENT_TYPES } from "../../company/events/CompanyEventTypes.js";
import { createCompanyEvent } from "../../company/events/CompanyEvent.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

function makeCapabilitiesReady(overrides = {}) {
  const base = [
    { id: "company_identity", status: "READY" },
    { id: "business_profile", status: "READY" },
    { id: "brand", status: "READY" },
    { id: "integrations", status: "READY" },
    { id: "knowledge", status: "READY" },
    { id: "communications", status: "READY" },
    { id: "digital_workforce", status: "READY" },
    { id: "workspace", status: "READY" },
    { id: "analytics", status: "READY" },
  ];
  const map = new Map(base.map((c) => [c.id, { ...c }]));
  for (const [k, v] of Object.entries(overrides)) {
    if (!map.has(k)) map.set(k, { id: k, status: v });
    else map.get(k).status = v;
  }
  return { overallReadiness: "READY", capabilities: [...map.values()] };
}

function seedDemoInquiry(runtime) {
  const event = createCompanyEvent({
    id: "evt_demo_website_inquiry_received_1",
    timestampISO: "2026-07-01T19:19:55.460Z",
    type: COMPANY_EVENT_TYPES.WEBSITE_INQUIRY_RECEIVED,
    source: "workspace-view-adapter-test",
    payload: {
      buyer: {
        buyerId: "buyer_web_rachael_nguyen",
        name: "Rachael Nguyen",
        email: "rachael.nguyen@example.com",
        phone: "(555) 019-2219",
      },
      propertyId: "prop_68_mystic",
      message:
        "Hi! I'm interested in the property and would like to discuss next steps today. Can you share a good walkthrough window?",
      submittedAtISO: "2026-07-01T19:19:55.460Z",
      priority: "High",
      employeeName: "Property Interest Coordinator",
      queueVisible: true,
      draftResponseReady: true,
      responseTimeMinutes: 32,
      inquiryId: "inq_demo_rachael_nguyen",
      status: "Needs Review",
    },
  });

  runtime.applyEvent(event);
}

function buildContext() {
  const runtime = new CompanyWorkspaceRuntime();
  seedDemoInquiry(runtime);
  const generator = new WorkspaceGenerator({ nowISO: NOW_ISO });

  const workspaceConfig = generator.generate({
    runtime,
    businessProfile: runtime.getBusinessProfile(),
    companyProfile: runtime.getCompanyProfile(),
    businessCapabilities: makeCapabilitiesReady(),
    nowISO: NOW_ISO,
  });

  const adapter = new WorkspaceViewAdapter({ runtime });
  return { runtime, workspaceConfig, adapter };
}

test("Adapter translation: deterministic outputs across repeated runs", () => {
  const { workspaceConfig, adapter } = buildContext();
  const first = adapter.translate(workspaceConfig);
  const second = adapter.translate(workspaceConfig);
  assert.deepEqual(first, second);
});

test("Dashboard generation: contract fields populated", () => {
  const { workspaceConfig, adapter } = buildContext();
  const view = adapter.getDashboardView(workspaceConfig);

  assert.equal(view.id, "dashboard_view");
  assert.equal(view.title, "Dashboard");
  assert.ok(typeof view.greeting === "string");
  assert.ok(typeof view.itemsRequiringReview === "number");
  assert.ok(view.impactMetrics && typeof view.impactMetrics.hoursSaved === "number");
  assert.ok(Array.isArray(view.activityFeed));
  assert.ok(Array.isArray(view.recentActivity));
});

test("Navigation generation: mirrors workspace navigation module ids", () => {
  const { workspaceConfig, adapter } = buildContext();
  const navView = adapter.getNavigationView(workspaceConfig);

  const navModuleIdsFromConfig = [];
  for (const section of workspaceConfig.navigation.items) {
    for (const it of section.items) navModuleIdsFromConfig.push(String(it.moduleId));
  }
  const navModuleIdsFromView = navView.sections.flatMap((s) => s.items.map((i) => i.moduleId));

  assert.deepEqual(navModuleIdsFromView, navModuleIdsFromConfig);
});

test("Recommendation generation: maps workspaceConfig.recommendations.items in order", () => {
  const { workspaceConfig, adapter } = buildContext();
  const recView = adapter.getRecommendationsView(workspaceConfig);

  assert.equal(recView.id, "recommendations_view");
  const titles = recView.items.map((x) => x.title);
  assert.deepEqual(titles, workspaceConfig.recommendations.items);
});

test("Queue generation: items match runtime work queue contract fields", () => {
  const { workspaceConfig, adapter, runtime } = buildContext();
  const view = adapter.getWorkQueueView(workspaceConfig);

  // Basic contract expectations (queue card component mapping).
  assert.equal(view.id, "work_queue_view");
  assert.ok(["Offline", "No Work", "Needs Review"].includes(view.reviewQueueState));
  assert.ok(Array.isArray(view.items));
  if (view.items.length > 0) {
    const first = view.items[0];
    assert.ok(first.id && typeof first.id === "string");
    assert.ok(typeof first.employee === "string");
    assert.ok(typeof first.createdTimeISO === "string");
  }

  // Queue items should not be empty with seeded demo runtime.
  assert.ok(view.items.length > 0);

  // Verify determinism against same config->view call.
  const view2 = adapter.getWorkQueueView(workspaceConfig);
  assert.deepEqual(view, view2);
});

test("Validation: navigation consistency throws on missing modules", () => {
  const invalid = createWorkspaceConfiguration({
    modules: [{ id: "a", title: "A", requiredCapabilities: [], requiredConnectedSystems: [], defaultWidgets: [], permissions: {} }],
    navigation: { items: [{ section: "Workspace", items: [{ moduleId: "missing", title: "Missing" }] }] },
    dashboard: { defaultWidgets: [], layout: "IN_PROGRESS", sections: [], cards: [], summary: "", priorityOrdering: "deterministic" },
    widgets: [],
    queues: [],
    views: [],
    recommendations: { items: [] },
    digitalWorkforceLayout: {},
    knowledgeLayout: { categories: [] },
    analyticsLayout: { enabled: false },
    morningBriefConfiguration: {},
    notifications: {},
    permissions: { read: [] },
    metadata: { version: "1", generatedAt: NOW_ISO, industry: "" },
  });

  assert.throws(() => validateWorkspaceViews(invalid, {}), /navigation refers to missing module/);
});

test("Validation: dashboard widgets must exist in config.widgets", () => {
  const invalid = createWorkspaceConfiguration({
    modules: [{ id: "dashboard", title: "Dashboard", requiredCapabilities: [], requiredConnectedSystems: [], defaultWidgets: ["w_1"], permissions: {} }],
    navigation: { items: [] },
    widgets: [],
    dashboard: { defaultWidgets: ["w_1"], layout: "IN_PROGRESS", sections: [], cards: [], summary: "", priorityOrdering: "deterministic" },
    queues: [],
    views: [],
    recommendations: { items: [] },
    digitalWorkforceLayout: {},
    knowledgeLayout: { categories: [] },
    analyticsLayout: { enabled: false },
    morningBriefConfiguration: {},
    notifications: {},
    permissions: { read: [] },
    metadata: { version: "1", generatedAt: NOW_ISO, industry: "" },
  });

  assert.throws(() => validateWorkspaceViews(invalid, {}), /dashboard defaultWidgets refers to missing widget/);
});

test("Immutability: view models are deeply frozen", () => {
  const { workspaceConfig, adapter } = buildContext();
  const view = adapter.translate(workspaceConfig);

  assert.ok(Object.isFrozen(view));
  assert.ok(Object.isFrozen(view.dashboard));
  assert.ok(Object.isFrozen(view.dashboard.impactMetrics));
  assert.ok(Object.isFrozen(view.navigation.sections));
  assert.ok(Object.isFrozen(view.navigation.sections[0].items));
});

