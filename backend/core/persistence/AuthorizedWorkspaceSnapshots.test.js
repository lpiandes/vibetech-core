import assert from "node:assert/strict";
import { test } from "node:test";

import { workspaceCompositionRegistry } from "../../../frontend/lib/workspace/WorkspaceCompositionRegistry.js";
import { InMemoryWorkspacePersistence } from "./InMemoryWorkspacePersistence.js";
import { setWorkspacePersistenceForTests, resetWorkspacePersistenceForTests } from "./createWorkspacePersistence.js";
import { resolveWorkspaceRuntimeSnapshots } from "./resolveWorkspaceRuntimeSnapshots.js";
import { RUNTIME_SNAPSHOT_KINDS } from "./RuntimeSnapshotKinds.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";

const workspaceId = "ws_snapshot_resolve_test";

test("resolveWorkspaceRuntimeSnapshots skips load when registry is warm", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  setWorkspacePersistenceForTests(persistence);

  await persistence.saveRuntimeSnapshots(workspaceId, [
    {
      kind: RUNTIME_SNAPSHOT_KINDS.CONNECTION,
      state: { connections: [], actionHistory: [], metrics: { connectionCount: 0, connectedCount: 0, actionCount: 0 } },
    },
  ]);

  workspaceCompositionRegistry.clear(workspaceId);
  const cold = await resolveWorkspaceRuntimeSnapshots(workspaceId);
  assert.ok(cold);
  assert.ok(cold[RUNTIME_SNAPSHOT_KINDS.CONNECTION]);

  workspaceCompositionRegistry.getOrCreate(workspaceId, ({ workspaceId: wid }) =>
    activateWorkspace({
      workspaceId: wid,
      activation: {
        industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
        packageConfiguration: { companyName: "Snapshot Skip Co" },
      },
      runtimeSnapshots: cold,
    }),
  );

  const warm = await resolveWorkspaceRuntimeSnapshots(workspaceId);
  assert.equal(warm, undefined);

  workspaceCompositionRegistry.clear(workspaceId);
  resetWorkspacePersistenceForTests();
});
