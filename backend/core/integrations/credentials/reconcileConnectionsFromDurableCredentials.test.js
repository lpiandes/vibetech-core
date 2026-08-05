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
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_gmail_biz_heal",
    providerType: "gmail",
    secrets: { refreshToken: "rt", senderEmail: "owner@example.com" },
    metadata: { senderEmail: "owner@example.com" },
  });

  const platform = createIntegrationPlatform({
    workspaceId: "biz_heal",
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

  assert.notEqual(
    platform.connectionRuntime.getConnectionByType("business_email")?.status,
    CONNECTION_STATUSES.CONNECTED,
  );

  const result = await reconcileConnectionsFromDurableCredentials({
    workspaceId: "biz_heal",
    integrationPlatform: platform,
    vault,
  });

  assert.deepEqual(result.healed, ["business_email"]);
  assert.equal(
    platform.connectionRuntime.getConnectionByType("business_email")?.status,
    CONNECTION_STATUSES.CONNECTED,
  );
});

test("reconcile is a no-op when already connected", async () => {
  resetSharedCredentialVaultForTests();
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_gmail_biz_ok",
    providerType: "gmail",
    secrets: { refreshToken: "rt", senderEmail: "owner@example.com" },
    metadata: { senderEmail: "owner@example.com" },
  });

  const platform = createIntegrationPlatform({
    workspaceId: "biz_ok",
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
    workspaceId: "biz_ok",
    integrationPlatform: platform,
    vault,
  });
  const second = await reconcileConnectionsFromDurableCredentials({
    workspaceId: "biz_ok",
    integrationPlatform: platform,
    vault,
  });
  assert.deepEqual(second.healed, []);
});
