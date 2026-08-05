import assert from "node:assert/strict";
import { test } from "node:test";

import { CredentialVault, resetSharedCredentialVaultForTests } from "./CredentialVault.js";
import { createIntegrationPlatform } from "../createIntegrationPlatform.js";
import { GmailIntegrationAdapter } from "../adapters/GmailIntegrationAdapter.js";
import { GoogleCalendarIntegrationAdapter } from "../adapters/GoogleCalendarIntegrationAdapter.js";
import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";
import { reconcileConnectionsFromDurableCredentials } from "./reconcileConnectionsFromDurableCredentials.js";

test("reconcile heals business_email from durable gmail credential", async () => {
  resetSharedCredentialVaultForTests();
  const workspaceId = "biz_heal";
  const vault = new CredentialVault();
  vault.put({
    credentialId: `cred_gmail_${workspaceId}`,
    providerType: "gmail",
    secrets: { refreshToken: "rt", senderEmail: "owner@example.com" },
    metadata: { senderEmail: "owner@example.com" },
  });

  const platform = createIntegrationPlatform({
    workspaceId,
    installationResult: {
      connectedSystemRequirements: [{ id: "business_email", displayName: "Business Email" }],
    },
    nowISO: "2026-07-01T00:00:00.000Z",
    credentialVault: vault,
    extraProviders: [
      new GmailIntegrationAdapter({
        gmailCommunicationProvider: {
          send: async () => ({ id: "msg" }),
        },
      }),
    ],
  });

  const result = await reconcileConnectionsFromDurableCredentials({
    workspaceId,
    integrationPlatform: platform,
    vault,
  });

  assert.deepEqual(result.healed, ["business_email"]);
  assert.equal(
    platform.connectionRuntime.getConnectionByType("business_email")?.status,
    CONNECTION_STATUSES.CONNECTED,
  );
});

test("reconcile heals calendar from durable google_calendar credential", async () => {
  resetSharedCredentialVaultForTests();
  const workspaceId = "biz_cal";
  const vault = new CredentialVault();
  vault.put({
    credentialId: `cred_gcal_${workspaceId}`,
    providerType: "google_calendar",
    secrets: { refreshToken: "rt", senderEmail: "owner@example.com" },
    metadata: { senderEmail: "owner@example.com" },
  });

  const calendarClient = {
    calendarList: {
      list: async () => ({ data: { items: [{ id: "primary" }] } }),
    },
    events: {
      insert: async () => ({ data: { id: "evt_1" } }),
    },
  };

  const platform = createIntegrationPlatform({
    workspaceId,
    installationResult: {
      connectedSystemRequirements: [{ id: "calendar", displayName: "Calendar" }],
    },
    nowISO: "2026-07-01T00:00:00.000Z",
    credentialVault: vault,
    extraProviders: [new GoogleCalendarIntegrationAdapter({ calendarClient })],
  });

  const result = await reconcileConnectionsFromDurableCredentials({
    workspaceId,
    integrationPlatform: platform,
    vault,
  });

  assert.deepEqual(result.healed, ["calendar"]);
  assert.equal(
    platform.connectionRuntime.getConnectionByType("calendar")?.status,
    CONNECTION_STATUSES.CONNECTED,
  );
});

test("reconcile is a no-op when already connected", async () => {
  resetSharedCredentialVaultForTests();
  const workspaceId = "biz_ok";
  const vault = new CredentialVault();
  vault.put({
    credentialId: `cred_gmail_${workspaceId}`,
    providerType: "gmail",
    secrets: { refreshToken: "rt", senderEmail: "owner@example.com" },
    metadata: { senderEmail: "owner@example.com" },
  });

  const platform = createIntegrationPlatform({
    workspaceId,
    installationResult: {
      connectedSystemRequirements: [{ id: "business_email", displayName: "Business Email" }],
    },
    nowISO: "2026-07-01T00:00:00.000Z",
    credentialVault: vault,
    extraProviders: [
      new GmailIntegrationAdapter({
        gmailCommunicationProvider: {
          send: async () => ({ id: "msg" }),
        },
      }),
    ],
  });

  await reconcileConnectionsFromDurableCredentials({
    workspaceId,
    integrationPlatform: platform,
    vault,
  });
  const second = await reconcileConnectionsFromDurableCredentials({
    workspaceId,
    integrationPlatform: platform,
    vault,
  });
  assert.deepEqual(second.healed, []);
});
