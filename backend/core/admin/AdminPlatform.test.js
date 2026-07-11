import assert from "node:assert/strict";
import { test } from "node:test";

import { AdminPlatformService } from "./AdminPlatformService.js";
import {
  SupportAccessService,
  createInMemorySupportAccessStore,
} from "../platform/support/SupportAccessService.js";
import { PLATFORM_ROLES } from "../platform/permissions/rolePermissions.js";
import { BlueprintRegistry } from "../blueprints/BlueprintRegistry.js";
import { createBlueprintDefinition } from "../blueprints/BlueprintDefinition.js";

const NOW = "2026-07-11T15:00:00.000Z";

function createMockPlatformStore({ businesses = [], installations = {}, sessions = [], audits = [], users = [] } = {}) {
  return {
    async listBusinesses() {
      return businesses;
    },
    async getBusiness(businessId) {
      return businesses.find((entry) => String(entry.id) === String(businessId)) ?? null;
    },
    async getBusinessOwnerStatus() {
      return "invited_pending";
    },
    async listMembershipsForBusiness(businessId) {
      return [{ userId: "u1", email: "owner@example.com", role: "OWNER", name: "Owner", businessId }];
    },
    async getBusinessOSInstallation(businessId) {
      return installations[businessId] ?? null;
    },
    async listAiBuilderSessions() {
      return sessions;
    },
    async listAiBuilderSessionsForBusiness(businessId) {
      return sessions.filter((entry) => String(entry.businessId) === String(businessId));
    },
    async listAuditEvents({ limit = 50 } = {}) {
      return audits.slice(0, limit);
    },
    async listActiveSupportSessions() {
      return [];
    },
    async listUsers() {
      return users;
    },
    async recordAuditEvent(event) {
      audits.push({ id: `audit_${audits.length + 1}`, createdAt: NOW, ...event });
      return event;
    },
  };
}

test("platform-admin gate rejects non-admins on all admin surfaces", async () => {
  const service = new AdminPlatformService({
    platformStore: createMockPlatformStore(),
  });
  const denied = await service.getDashboard({ adminUserId: "u1", platformRole: null });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "platform_admin_required");
  assert.equal(service.listBlueprints({ platformRole: "OWNER" }).ok, false);
  assert.equal(service.listComponents({ platformRole: "EMPLOYEE" }).ok, false);
  assert.equal(service.listEmployeeArchetypes({ platformRole: null }).ok, false);
});

test("business directory excludes journey/test businesses and never claims ownership", async () => {
  const service = new AdminPlatformService({
    platformStore: createMockPlatformStore({
      businesses: [
        { id: "biz_1", name: "Acme Property", industry: "property_management", status: "active" },
        { id: "biz_2", name: "Journey Co smoke", industry: "property_management", status: "active" },
      ],
      installations: {
        biz_1: {
          specificationId: "spec_1",
          specificationVersion: "1.0.0",
          status: "installed",
          actorUserId: "admin_1",
          specificationContentHash: "hash_abc",
          history: [],
        },
      },
    }),
  });

  const listed = await service.listBusinesses({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.businesses.length, 1);
  assert.equal(listed.businesses[0].name, "Acme Property");
  assert.equal(listed.businesses[0].ownerStatus, "invited_pending");

  const summary = await service.getBusinessSummary({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_1",
  });
  assert.equal(summary.ok, true);
  assert.match(summary.business.note, /Never silently become owner/i);
});

test("audited support access retains admin actor identity and blocks cross-business leakage", async () => {
  const supportStore = createInMemorySupportAccessStore({
    businesses: [{ id: "biz_a", name: "A" }, { id: "biz_b", name: "B" }],
  });
  const support = new SupportAccessService({ store: supportStore, nowISO: () => NOW });
  const platformStore = createMockPlatformStore({
    businesses: [
      { id: "biz_a", name: "A", industry: "dental" },
      { id: "biz_b", name: "B", industry: "dental" },
    ],
  });
  const admin = new AdminPlatformService({ platformStore, supportAccessService: support });

  const entered = await support.enter({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_a",
    reason: "Investigate install warning",
    mode: "read_only",
  });
  assert.equal(entered.ok, true);
  assert.equal(entered.session.adminUserId, "admin_1");
  assert.equal(entered.session.permanentMembershipGranted, false);

  const summary = await admin.getBusinessSummary({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_a",
  });
  assert.equal(summary.business.supportSession.sessionId, entered.session.sessionId);
  assert.equal(summary.business.supportSession.adminUserId, "admin_1");

  const foreign = await support.resolveAuthorization({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_b",
  });
  assert.equal(foreign.ok, false);
});

test("architect sessions, blueprints, components, employees, and install history list from evidence", async () => {
  const registry = new BlueprintRegistry();
  registry.register(createBlueprintDefinition({
    blueprintId: "bp_test",
    name: "Test Blueprint",
    industry: "default",
    version: "1.0.0",
    maturity: "gold",
    goldStatus: true,
    source: "gold",
    supportedCapabilities: ["work"],
    requiredCapabilities: [],
    dependencies: [],
  }));

  const service = new AdminPlatformService({
    platformStore: createMockPlatformStore({
      businesses: [{ id: "biz_1", name: "Acme", industry: "default" }],
      sessions: [{
        sessionId: "sess_1",
        businessId: "biz_1",
        currentStage: "discovery",
        status: "blocked",
        capabilityGaps: [{ label: "crm_import" }],
        updatedAt: NOW,
      }],
      installations: {
        biz_1: {
          specificationId: "spec_1",
          specificationVersion: "2.0.0",
          status: "partial",
          actorUserId: "admin_1",
          specificationContentHash: "plan_hash_xyz",
          history: [{ status: "warning", message: "integration skipped" }],
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
      users: [{ id: "admin_1", email: "admin@vibetech.io", name: "Admin", platformRole: PLATFORM_ROLES.PLATFORM_ADMIN }],
    }),
    blueprintRegistry: registry,
  });

  const sessions = await service.listArchitectSessions({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  assert.equal(sessions.sessions[0].resumeHref, "/architect/sess_1");
  assert.equal(sessions.sessions[0].blocked, true);
  assert.equal(sessions.sessions[0].gaps.length, 1);

  const blueprints = service.listBlueprints({ platformRole: PLATFORM_ROLES.PLATFORM_ADMIN });
  assert.ok(blueprints.blueprints.some((entry) => entry.blueprintId === "bp_test"));

  const components = service.listComponents({ platformRole: PLATFORM_ROLES.PLATFORM_ADMIN });
  assert.ok(components.components.some((entry) => entry.type === "kpi_cards"));
  assert.ok(components.components.some((entry) => entry.type === "work_queue"));
  assert.ok(components.components.some((entry) => entry.type === "reports"));

  const employees = service.listEmployeeArchetypes({ platformRole: PLATFORM_ROLES.PLATFORM_ADMIN });
  assert.ok(employees.archetypes.some((entry) => entry.label === "Coordinator"));
  assert.ok(!JSON.stringify(employees.archetypes[0]).includes("raw_internal"));

  const installs = await service.listInstallations({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  assert.equal(installs.installations[0].status, "partial");
  assert.equal(installs.installations[0].partialFailureVisible, true);
  assert.ok(installs.installations[0].warnings.length >= 1);

  const analytics = await service.getPlatformAnalytics({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  assert.equal(analytics.honesty.fabricatedRevenueForbidden, true);
  assert.ok(analytics.metrics.failedOrPartialInstalls >= 1);
});

test("admin analytics and dashboard use real evidence only", async () => {
  const service = new AdminPlatformService({
    platformStore: createMockPlatformStore({
      businesses: [{ id: "biz_1", name: "Acme", status: "active" }],
      audits: [],
    }),
  });
  const dash = await service.getDashboard({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  assert.equal(dash.ok, true);
  assert.equal(dash.metrics.totalBusinesses, 1);
  assert.equal(dash.integrationHealth.status, "projected");
});
