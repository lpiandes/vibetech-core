import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../../integration/PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../../integration/ProspectInquiryOperatingLoopService.js";
import { CommunicationViewAdapter } from "./CommunicationViewAdapter.js";
import { buildCommunicationThreadDetail } from "./buildCommunicationThreadDetail.js";

const NOW = "2026-07-06T14:30:00.000Z";

function buildStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Inbox Detail Co",
    workspaceId,
  });
  const stack = buildPropertyManagementWorkspaceStack({
    nowISO: NOW,
    workspaceId,
    installPackage: true,
    demoConfiguration,
  });
  installPackageEmployees({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    humanTeamMembers: [],
    teamRuntime: stack.teamRuntime,
    nowISO: NOW,
  });
  const integrationPlatform = createIntegrationPlatform({
    workspaceId,
    installationResult: stack.installationResult,
    communicationRuntime: stack.communicationRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    nowISO: NOW,
    platformEventBus: stack.bus,
    platformEventStore: stack.store,
  });
  return { stack, integrationPlatform };
}

test("buildCommunicationThreadDetail resolves prospect inquiry, party, and acknowledgment", async () => {
  const workspaceId = "ws_thread_detail";
  const { stack, integrationPlatform } = buildStack(workspaceId);
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Casey Prospect",
      email: "casey.prospect@example.com",
      message: "Looking for a 2-bedroom near downtown.",
    },
  });

  assert.equal(result.ok, true);
  const threadId = `ct_ack_${result.requestId}`;
  const detail = buildCommunicationThreadDetail({
    threadId,
    communicationRuntime: stack.communicationRuntime,
    requestRuntime: stack.requestRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    interactionRuntime: stack.interactionRuntime,
  });

  assert.ok(detail);
  assert.equal(detail.thread.id, threadId);
  assert.match(detail.thread.subject, /Re: Your inquiry to Inbox Detail Co/);
  assert.equal(detail.contact.displayName, "Casey Prospect");
  assert.equal(detail.contact.email, "casey.prospect@example.com");
  assert.equal(detail.inquiry.text, "Looking for a 2-bedroom near downtown.");
  assert.equal(detail.inquiry.receivedAt, NOW);
  assert.equal(detail.messages.length, 1);
  assert.equal(detail.messages[0].direction, "outbound");
  assert.match(detail.messages[0].body, /Thank you for contacting Inbox Detail Co/);
  assert.equal(detail.messages[0].createdAt, NOW);
});

test("prospect inquiry produces Inbox-visible communication thread", async () => {
  const workspaceId = "ws_inbox_vm";
  const { stack, integrationPlatform } = buildStack(workspaceId);
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });

  assert.equal(stack.communicationRuntime.getThreads().length, 0);

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Alex Morgan",
      email: "alex@example.com",
      message: "Interested in leasing.",
    },
  });

  assert.equal(result.ok, true);

  const vm = new CommunicationViewAdapter({ nowISO: NOW }).translate({
    communicationRuntime: stack.communicationRuntime,
    workRuntime: stack.workRuntime,
    teamRuntime: stack.teamRuntime,
    companyWorkspaceRuntime: stack.companyRuntime,
  });

  assert.equal(vm.threads.length, 1);
  assert.match(String(vm.threads[0].subject), /Re: Your inquiry to Inbox Detail Co/);
  assert.equal(vm.threads[0].latestMessageAt, NOW);
});

test("tenant B has no communication threads after tenant A prospect inquiry", async () => {
  const a = buildStack("ws_inbox_tenant_a");
  const b = buildStack("ws_inbox_tenant_b");
  await connectBusinessEmailDev({ integrationPlatform: a.integrationPlatform, workspaceId: a.stack.workspaceId, nowISO: NOW });

  await runProspectInquiryOperatingLoop({
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    workspaceId: a.stack.workspaceId,
    nowISO: NOW,
    inquiry: { name: "Only A", email: "only.a@example.com", message: "Tenant A inquiry" },
  });

  assert.equal(a.stack.communicationRuntime.getThreads().length, 1);
  assert.equal(b.stack.communicationRuntime.getThreads().length, 0);
});

test("normal business stack starts with no communication threads", () => {
  const { stack } = buildStack("ws_inbox_empty");
  assert.equal(stack.communicationRuntime.getThreads().length, 0);
});
