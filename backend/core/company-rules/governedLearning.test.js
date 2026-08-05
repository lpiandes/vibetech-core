import assert from "node:assert/strict";
import { test } from "node:test";

import {
  recordCorrection,
  detectRepeatsAndPropose,
  approveProposal,
  rejectProposal,
  rollbackRule,
  attachReplayToProposal,
  ingestExternalFeeds,
  readGovernedLearning,
  REPEAT_THRESHOLD,
} from "./governedLearning.js";

function blank() {
  return readGovernedLearning(null);
}

test("recordCorrection refuses without reason code", () => {
  const result = recordCorrection(blank(), {
    source: "test",
    original: { text: "a" },
    approved: { text: "b" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "reason_required");
});

test("recordCorrection stores original vs approved with policy association", () => {
  const result = recordCorrection(blank(), {
    correctionId: "c1",
    source: "owner_approval",
    reasonCode: "tone_edit",
    original: { body: "Hi" },
    approved: { body: "Hello" },
    decision: "GRANTED",
    contractVersion: "1.0",
    contentHash: "abc",
    employeeId: "emp_rft",
    evidence: [{ kind: "approval_id", providerId: "appr_1" }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.corrections.length, 1);
  assert.equal(result.state.corrections[0].reasonCode, "tone_edit");
  assert.equal(result.state.corrections[0].policy.contentHash, "abc");
  assert.deepEqual(result.state.corrections[0].original, { body: "Hi" });
  assert.deepEqual(result.state.corrections[0].approved, { body: "Hello" });
});

test("detectRepeatsAndPropose does not auto-apply — only proposes after threshold", () => {
  let state = blank();
  for (let i = 0; i < REPEAT_THRESHOLD - 1; i += 1) {
    const r = recordCorrection(state, {
      correctionId: `pre_${i}`,
      source: "operator_intervention",
      reasonCode: "missing_business_rule",
      original: { i },
      approved: { fixed: true },
    });
    assert.equal(r.ok, true);
    state = r.state;
  }
  let detected = detectRepeatsAndPropose(state);
  assert.equal(detected.created.length, 0);

  const third = recordCorrection(detected.state, {
    correctionId: "pre_last",
    source: "operator_intervention",
    reasonCode: "missing_business_rule",
    original: { i: 99 },
    approved: { fixed: true },
  });
  detected = detectRepeatsAndPropose(third.state);
  assert.equal(detected.created.length, 1);
  assert.equal(detected.created[0].status, "proposed");
  assert.equal(detected.state.ruleVersions.length, 0, "must not create rule versions on propose");
});

test("approveProposal requires replay pass — never silent enable", () => {
  let state = blank();
  for (let i = 0; i < REPEAT_THRESHOLD; i += 1) {
    state = recordCorrection(state, {
      correctionId: `ap_${i}`,
      reasonCode: "ai_quality_failure",
      original: {},
      approved: {},
    }).state;
  }
  state = detectRepeatsAndPropose(state).state;
  const proposalId = state.proposals[0].proposalId;

  const blocked = approveProposal(state, { proposalId, requireReplayPass: true });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "replay_required");

  state = attachReplayToProposal(state, proposalId, {
    passed: true,
    passDetail: "ok",
    ranAt: "2026-08-05T00:00:00.000Z",
  });
  const approved = approveProposal(state, { proposalId, actorId: "owner", requireReplayPass: true });
  assert.equal(approved.ok, true);
  assert.equal(approved.rule.status, "active");
  assert.equal(approved.rule.version, 1);
  assert.equal(approved.state.proposals[0].status, "approved");
});

test("rejectProposal closes without creating a rule", () => {
  let state = blank();
  for (let i = 0; i < REPEAT_THRESHOLD; i += 1) {
    state = recordCorrection(state, {
      correctionId: `rj_${i}`,
      reasonCode: "customer_delay",
      original: {},
      approved: {},
    }).state;
  }
  state = detectRepeatsAndPropose(state).state;
  const proposalId = state.proposals[0].proposalId;
  state = rejectProposal(state, { proposalId, note: "Not yet" });
  assert.equal(state.proposals[0].status, "rejected");
  assert.equal(state.ruleVersions.length, 0);
});

test("rollback restores prior version or deactivates honestly", () => {
  let state = blank();
  for (let i = 0; i < REPEAT_THRESHOLD; i += 1) {
    state = recordCorrection(state, {
      correctionId: `rb_${i}`,
      reasonCode: "provider_failure",
      original: {},
      approved: {},
    }).state;
  }
  state = detectRepeatsAndPropose(state).state;
  const proposalId = state.proposals[0].proposalId;
  state = attachReplayToProposal(state, proposalId, { passed: true, passDetail: "pass" });
  const approved = approveProposal(state, { proposalId, requireReplayPass: true });
  assert.equal(approved.ok, true);
  state = approved.state;

  const rolled = rollbackRule(state, { ruleId: approved.rule.ruleId, actorId: "owner" });
  assert.equal(rolled.ok, true);
  assert.equal(rolled.restored, null, "no prior version — honest deactivate");
  assert.equal(
    rolled.state.ruleVersions.find((v) => v.ruleId === approved.rule.ruleId)?.status,
    "rolled_back",
  );
});

test("ingestExternalFeeds pulls operator closed + shadow corrections", () => {
  const installation = {
    configuration: {
      operatorInterventions: {
        closed: [
          {
            caseId: "rft_exception:biz:card1",
            kind: "rft_exception",
            rootCause: "missing_integration",
            note: "Need Gmail",
            actorId: "admin",
            closedAt: "2026-08-01T00:00:00.000Z",
          },
        ],
        open: [],
      },
      rftReplay: {
        shadow: {
          corrections: [
            {
              proposalId: "sh_1",
              note: "Wrong tone",
              shouldHave: "warmer",
              reasonCode: "tone_edit",
              at: "2026-08-02T00:00:00.000Z",
            },
          ],
        },
      },
    },
  };
  const state = ingestExternalFeeds(blank(), { installation });
  assert.equal(state.corrections.length, 2);
  assert.ok(state.corrections.some((c) => c.source === "operator_intervention"));
  assert.ok(state.corrections.some((c) => c.source === "shadow_correction"));
});
