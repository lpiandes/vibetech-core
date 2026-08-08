import test from "node:test";
import assert from "node:assert/strict";
import { getOwnerSetupSteps } from "./OwnerPackageSetupRegistry.js";
import {
  resolveOwnerSetupPath,
  evaluateOwnerSetupSteps,
  resolveNextConnectionFocus,
} from "./resolveOwnerSetupPath.js";

test("receptionist-only business uses package path, not RFT observe/replay/shadow", () => {
  const path = resolveOwnerSetupPath({
    purchasedPackages: ["ai_receptionist"],
    rftGoLiveAt: null,
  });
  assert.equal(path.mode, "package");
  assert.equal(path.primaryPackageId, "ai_receptionist");

  const steps = getOwnerSetupSteps("ai_receptionist");
  const labels = steps.map((s) => s.label.toLowerCase());
  assert.ok(labels.some((l) => l.includes("phone")));
  assert.ok(labels.some((l) => l.includes("knowledge")));
  assert.ok(labels.some((l) => l.includes("test") || l.includes("call")));
  assert.ok(labels.some((l) => l.includes("go live")));
  assert.equal(labels.some((l) => l.includes("shadow") || l.includes("replay")), false);
});

test("RFT package keeps RFT mode until go-live", () => {
  const pending = resolveOwnerSetupPath({
    purchasedPackages: ["managed_revenue_follow_through"],
    rftGoLiveAt: null,
  });
  assert.equal(pending.mode, "rft");

  const live = resolveOwnerSetupPath({
    purchasedPackages: ["managed_revenue_follow_through"],
    rftGoLiveAt: "2026-07-27T12:00:00.000Z",
  });
  assert.equal(live.mode, "live");
});

test("evaluateOwnerSetupSteps requires real proof before go-live", () => {
  const blocked = evaluateOwnerSetupSteps({
    packageId: "ai_receptionist",
    connectionStatuses: { voice_channel: "CONNECTED" },
    proofRecords: {},
    knowledgeCount: 2,
  });
  assert.equal(blocked.summary.canGoLive, false);
  assert.equal(blocked.steps.find((s) => s.id === "connect_phone")?.complete, true);
  assert.equal(blocked.steps.find((s) => s.id === "add_knowledge")?.complete, true);
  assert.equal(blocked.steps.find((s) => s.id === "test_call")?.complete, false);

  const ready = evaluateOwnerSetupSteps({
    packageId: "ai_receptionist",
    connectionStatuses: { voice_channel: "CONNECTED" },
    proofRecords: { voice_calls: { ok: true, verified: true } },
    knowledgeCount: 2,
  });
  assert.equal(ready.summary.canGoLive, true);
});

test("pending white-glove keeps connect step incomplete", () => {
  const pending = evaluateOwnerSetupSteps({
    packageId: "ai_receptionist",
    connectionStatuses: {},
    pendingOpsRequests: {
      voice_channel: { status: "pending_ops" },
    },
    proofRecords: {},
    knowledgeCount: 1,
  });
  assert.equal(pending.steps.find((s) => s.id === "connect_phone")?.complete, false);
  assert.match(String(pending.steps.find((s) => s.id === "connect_phone")?.detail ?? ""), /Hold on|VIBETech/i);
});

test("resolveNextConnectionFocus points at business phone for receptionist", () => {
  const next = resolveNextConnectionFocus({
    purchasedPackages: ["ai_receptionist"],
    connectionStatuses: {},
  });
  assert.equal(next.connectionId, "voice_channel");
});

test("sellable packages expose owner setup steps", () => {
  for (const id of [
    "lead_follow_up",
    "knowledge_assistant",
    "essential_managed",
    "crm_external_integration",
  ]) {
    const steps = getOwnerSetupSteps(id);
    assert.ok(steps.length >= 1, id);
    assert.ok(steps.some((s) => s.kind === "go_live" || s.kind === "consulting"), id);
  }
});
