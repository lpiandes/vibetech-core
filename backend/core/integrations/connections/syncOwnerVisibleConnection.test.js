import test from "node:test";
import assert from "node:assert/strict";
import {
  connectionIdFromProvider,
  syncOwnerVisibleConnection,
} from "./syncOwnerVisibleConnection.js";

test("connectionIdFromProvider maps providers", () => {
  assert.equal(connectionIdFromProvider({ providerType: "twilio_voice" }), "voice_channel");
  assert.equal(connectionIdFromProvider({ providerType: "hubspot" }), "hubspot");
  assert.equal(connectionIdFromProvider({ connectionType: "meta_lead_ads" }), "meta_lead_ads");
});

test("syncOwnerVisibleConnection marks white-glove ready when Connected", async () => {
  const writes = [];
  const store = {
    async getBusinessById() {
      return { id: "b1", packageConfiguration: { pendingOpsRequests: { voice_channel: { status: "pending_ops" } } } };
    },
    async getBusinessOSInstallation() {
      return { id: "i1", configuration: {} };
    },
    async listIntegrationCredentialsForWorkspace() {
      return [{ credentialId: "cred_twilio_voice_b1", providerType: "twilio_voice", secrets: { accountSid: "AC", authToken: "t", fromNumber: "+1" } }];
    },
    async updateBusinessPackageConfiguration(payload) {
      writes.push(payload);
    },
    async upsertBusinessOSInstallation() {},
  };

  const result = await syncOwnerVisibleConnection({
    platformStore: store,
    businessId: "b1",
    connectionId: "voice_channel",
    connectionStatus: "CONNECTED",
    providerType: "twilio_voice",
  });
  assert.equal(result.ok, true);
  assert.equal(result.synced, true);
  assert.ok(writes.length >= 1);
  assert.equal(writes[0].packageConfiguration.pendingOpsRequests.voice_channel.status, "ops_ready");
});

test("syncOwnerVisibleConnection no-ops when not Connected yet", async () => {
  const result = await syncOwnerVisibleConnection({
    platformStore: {},
    businessId: "b1",
    connectionId: "voice_channel",
    connectionStatus: "NOT_CONNECTED",
  });
  assert.equal(result.synced, false);
  assert.equal(result.reason, "not_connected");
});
