import test from "node:test";
import assert from "node:assert/strict";
import {
  sessionStageToConstitution,
  validateSessionStageTransition,
  assertSessionStageTransition,
  SESSION_STAGE_TO_CONSTITUTION,
} from "./BuilderSessionLifecycle.js";
import { withBuilderSessionPatch, createBuilderSession } from "./BuilderSession.js";

test("session stages map onto constitution lifecycle", () => {
  assert.equal(sessionStageToConstitution("discovering"), "discovery");
  assert.equal(sessionStageToConstitution("awaiting_review"), "preview");
  assert.equal(sessionStageToConstitution("installed"), "operate");
  assert.equal(sessionStageToConstitution("failed"), null);
  assert.ok(SESSION_STAGE_TO_CONSTITUTION.installing === "install");
});

test("forward lifecycle skips are allowed (continuous seed / skipped research)", () => {
  const result = validateSessionStageTransition({
    from: "discovering",
    to: "awaiting_review",
  });
  assert.equal(result.ok, true);
  assert.equal(result.constitution.forwardProgress, true);
});

test("exceptional stages are always allowed", () => {
  assert.equal(validateSessionStageTransition({ from: "installing", to: "failed" }).ok, true);
  assert.equal(validateSessionStageTransition({ from: "dry_run_ready", to: "blocked" }).ok, true);
  assert.equal(validateSessionStageTransition({ from: "installed", to: "archived" }).ok, true);
});

test("pre-install refinement allows assembling → researching", () => {
  const result = validateSessionStageTransition({
    from: "assembling",
    to: "researching",
  });
  assert.equal(result.ok, true);
  assert.equal(result.constitution.refinement, true);
});

test("illegal backward jumps are rejected", () => {
  const result = validateSessionStageTransition({
    from: "awaiting_approval",
    to: "discovering",
  });
  assert.equal(result.ok, false);
  assert.throws(
    () => assertSessionStageTransition({ from: "awaiting_approval", to: "discovering" }),
    /illegal stage transition/,
  );
});

test("withBuilderSessionPatch enforces mapped lifecycle transitions", () => {
  const session = createBuilderSession({ currentStage: "awaiting_approval" });
  assert.throws(
    () => withBuilderSessionPatch(session, { currentStage: "discovering" }),
    /illegal stage transition/,
  );
  const next = withBuilderSessionPatch(session, { currentStage: "installing" });
  assert.equal(next.currentStage, "installing");
});
