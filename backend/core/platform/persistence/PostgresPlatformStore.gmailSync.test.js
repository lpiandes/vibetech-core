import test from "node:test";
import assert from "node:assert/strict";

import { PostgresPlatformStore } from "./PostgresPlatformStore.js";

/**
 * Smoke test for the query the hosted job tick's Gmail inbox sync sweep depends
 * on (see runHostedGmailInboxSyncSweep in frontend/lib/server/runHostedPlatformJobTick.ts).
 * Uses a fake `withClient` so this stays a plain node:test unit test — no real DB.
 */
test("listWorkspaceIdsWithIntegrationCredentialType queries by provider_type and returns string ids", async () => {
  let capturedSql = null;
  let capturedParams = null;
  const fakeWithClient = async (fn) =>
    fn({
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return {
          rows: [
            { workspace_id: "biz_1", updated_at: new Date() },
            { workspace_id: "biz_2", updated_at: new Date() },
          ],
        };
      },
    });

  const store = new PostgresPlatformStore(fakeWithClient);
  const ids = await store.listWorkspaceIdsWithIntegrationCredentialType("gmail", { limit: 5 });

  assert.deepEqual(ids, ["biz_1", "biz_2"]);
  assert.match(capturedSql, /FROM integration_credentials/);
  assert.match(capturedSql, /provider_type = \$1/);
  assert.deepEqual(capturedParams, ["gmail", 5, 0]);
});

test("listWorkspaceIdsWithIntegrationCredentialType defaults limit to 25 and offset to 0", async () => {
  let capturedParams = null;
  const fakeWithClient = async (fn) =>
    fn({
      async query(_sql, params) {
        capturedParams = params;
        return { rows: [] };
      },
    });

  const store = new PostgresPlatformStore(fakeWithClient);
  const ids = await store.listWorkspaceIdsWithIntegrationCredentialType("gmail");

  assert.deepEqual(ids, []);
  assert.equal(capturedParams[1], 25);
  assert.equal(capturedParams[2], 0);
});

test("listWorkspaceIdsWithIntegrationCredentialType passes an offset for cursor rotation across ticks", async () => {
  let capturedSql = null;
  let capturedParams = null;
  const fakeWithClient = async (fn) =>
    fn({
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [{ workspace_id: "biz_9", updated_at: new Date() }] };
      },
    });

  const store = new PostgresPlatformStore(fakeWithClient);
  const ids = await store.listWorkspaceIdsWithIntegrationCredentialType("gmail", { limit: 100, offset: 250 });

  assert.deepEqual(ids, ["biz_9"]);
  assert.match(capturedSql, /OFFSET \$3/);
  assert.deepEqual(capturedParams, ["gmail", 100, 250]);
});

test("listWorkspaceIdsWithIntegrationCredentialType clamps a negative offset to 0", async () => {
  let capturedParams = null;
  const fakeWithClient = async (fn) =>
    fn({
      async query(_sql, params) {
        capturedParams = params;
        return { rows: [] };
      },
    });

  const store = new PostgresPlatformStore(fakeWithClient);
  await store.listWorkspaceIdsWithIntegrationCredentialType("gmail", { offset: -5 });

  assert.equal(capturedParams[2], 0);
});
