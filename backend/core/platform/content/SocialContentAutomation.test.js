import test from "node:test";
import assert from "node:assert/strict";

import {
  createDraftPost,
  listDrafts,
  approveAndQueuePublish,
  runSocialContentDraftProve,
  readSocialContentState,
} from "./SocialContentAutomation.js";
import { CredentialVault } from "../../integrations/credentials/CredentialVault.js";

function makeInstallation(overrides = {}) {
  return {
    id: "install_social_1",
    businessId: "biz_social_1",
    specificationId: "spec_1",
    configuration: {},
    ...overrides,
  };
}

function makePlatformStore(installationRef) {
  return {
    async upsertBusinessOSInstallation(row) {
      installationRef.configuration = row.configuration;
      installationRef.history = row.history;
      return row;
    },
    async getBusinessOSInstallation() {
      return installationRef;
    },
    async listIntegrationCredentialsForWorkspace() {
      return [];
    },
  };
}

test("createDraftPost persists a draft on installation.configuration.socialContentDrafts", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  const result = await createDraftPost({
    platformStore,
    installation,
    channel: "facebook",
    brief: "Announce fall promo",
    body: "20% off all fall services this week only!",
    actorId: "owner_1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.draft.status, "draft");
  assert.equal(result.draft.channel, "facebook");
  assert.equal(result.drafts.length, 1);
  assert.equal(readSocialContentState(installation).drafts.length, 1);
  assert.deepEqual(listDrafts(installation).map((d) => d.id), [result.draft.id]);
});

test("createDraftPost requires a non-empty body", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  await assert.rejects(
    () => createDraftPost({ platformStore, installation, channel: "facebook", brief: "x", body: "" }),
    /body is required/,
  );
});

test("approveAndQueuePublish queues for manual publish with an honest reason when no Meta token is connected", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  const created = await createDraftPost({
    platformStore,
    installation,
    channel: "facebook",
    brief: "Weekly update",
    body: "Check out our new services this week.",
  });

  const approved = await approveAndQueuePublish({
    platformStore,
    installation,
    draftId: created.draft.id,
    actorId: "owner_1",
  });

  assert.equal(approved.ok, true);
  assert.equal(approved.draft.status, "queued_for_manual_publish");
  assert.ok(approved.draft.approvedAt);
  assert.match(approved.draft.honestyReason, /No connected Meta\/Facebook page token/);
  assert.equal(approved.draft.externalReference, null);
});

test("approveAndQueuePublish publishes live when a Meta page token is connected", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  platformStore.listIntegrationCredentialsForWorkspace = async () => [
    { credentialId: "cred_meta_1", providerType: "meta_lead_ads", metadata: { pageId: "page_123" } },
  ];
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_meta_1",
    providerType: "meta_lead_ads",
    secrets: { pageAccessToken: "test_token", pageId: "page_123" },
  });

  const created = await createDraftPost({
    platformStore,
    installation,
    channel: "facebook",
    brief: "Launch day",
    body: "We're live! Come check us out.",
  });

  let requestedUrl = null;
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "page_123_post_456" }),
    };
  };

  const approved = await approveAndQueuePublish({
    platformStore,
    installation,
    draftId: created.draft.id,
    actorId: "owner_1",
    vault,
    fetchImpl,
  });

  assert.equal(approved.ok, true);
  assert.equal(approved.draft.status, "published");
  assert.equal(approved.draft.externalReference, "page_123_post_456");
  assert.equal(approved.draft.publishProvider, "meta_graph");
  assert.match(String(requestedUrl), /graph\.facebook\.com.*page_123.*feed/);
});

test("approveAndQueuePublish marks publish_failed with an honest reason when Graph rejects the post", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  platformStore.listIntegrationCredentialsForWorkspace = async () => [
    { credentialId: "cred_meta_2", providerType: "meta_lead_ads", metadata: { pageId: "page_999" } },
  ];
  const vault = new CredentialVault();
  vault.put({
    credentialId: "cred_meta_2",
    providerType: "meta_lead_ads",
    secrets: { pageAccessToken: "bad_token", pageId: "page_999" },
  });

  const created = await createDraftPost({
    platformStore,
    installation,
    channel: "facebook",
    brief: "Broken",
    body: "This should fail.",
  });

  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { message: "Invalid OAuth access token" } }),
  });

  const approved = await approveAndQueuePublish({
    platformStore,
    installation,
    draftId: created.draft.id,
    vault,
    fetchImpl,
  });

  assert.equal(approved.draft.status, "publish_failed");
  assert.match(approved.draft.honestyReason, /Invalid OAuth access token/);
});

test("approveAndQueuePublish returns an error for an unknown draft id", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  const result = await approveAndQueuePublish({ platformStore, installation, draftId: "nope" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "draft_not_found");
});

test("runSocialContentDraftProve creates + approves a draft end-to-end", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  const result = await runSocialContentDraftProve({ platformStore, installation });
  assert.equal(result.ok, true);
  assert.equal(result.draft.status, "queued_for_manual_publish");
  assert.equal(readSocialContentState(installation).drafts.length, 1);
});
