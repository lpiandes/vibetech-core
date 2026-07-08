import assert from "node:assert/strict";
import { test } from "node:test";

import { workspaceCompositionRegistry } from "../../../frontend/lib/workspace/WorkspaceCompositionRegistry.js";

test("WorkspaceCompositionRegistry: getOrCreate reuses identity per workspaceId", () => {
  workspaceCompositionRegistry.clearAll();

  const a1 = workspaceCompositionRegistry.getOrCreate("ws_A", ({ workspaceId }) => ({ workspaceId, seq: 1 }));
  const a2 = workspaceCompositionRegistry.getOrCreate("ws_A", ({ workspaceId }) => ({ workspaceId, seq: 2 }));
  assert.equal(a1, a2);
  assert.equal(a2.seq, 1);

  const b1 = workspaceCompositionRegistry.getOrCreate("ws_B", ({ workspaceId }) => ({ workspaceId, seq: 9 }));
  assert.notEqual(a1, b1);
});

test("WorkspaceCompositionRegistry: clear and clearAll rebuild identities", () => {
  workspaceCompositionRegistry.clearAll();

  const a1 = workspaceCompositionRegistry.getOrCreate("ws_A", () => ({ v: Math.random() }));
  workspaceCompositionRegistry.clear("ws_A");
  const a2 = workspaceCompositionRegistry.getOrCreate("ws_A", () => ({ v: Math.random() }));
  assert.notEqual(a1, a2);

  workspaceCompositionRegistry.clearAll();
  const c1 = workspaceCompositionRegistry.getOrCreate("ws_C", () => ({ v: 1 }));
  assert.ok(c1);
});

test("WorkspaceCompositionRegistry: globalThis singleton survives duplicate module evaluation", async () => {
  workspaceCompositionRegistry.clearAll();
  const first = workspaceCompositionRegistry.getOrCreate("ws_global", () => ({ v: 1 }));
  const { workspaceCompositionRegistry: secondImport } = await import(
    "../../../frontend/lib/workspace/WorkspaceCompositionRegistry.js"
  );
  const second = secondImport.getOrCreate("ws_global", () => ({ v: 2 }));
  assert.equal(first, second);
  assert.equal(second.v, 1);
});
