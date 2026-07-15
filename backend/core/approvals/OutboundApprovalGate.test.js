import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDecideOutboundApproval,
  evaluateOutboundSendPermission,
  isOutboundAutomationAction,
  isOutboundCapability,
} from "./OutboundApprovalGate.js";

describe("OutboundApprovalGate", () => {
  it("forces approval for SEND_EMAIL without outboundApproved", () => {
    const gate = evaluateOutboundSendPermission({ capability: "SEND_EMAIL" });
    assert.equal(gate.outbound, true);
    assert.equal(gate.allowed, false);
    assert.equal(gate.forceApproval, true);
  });

  it("allows send after human approval flag", () => {
    const gate = evaluateOutboundSendPermission({
      capability: "SEND_EMAIL",
      outboundApproved: true,
    });
    assert.equal(gate.allowed, true);
  });

  it("does not force approval for non-outbound capabilities", () => {
    const gate = evaluateOutboundSendPermission({ capability: "READ_CALENDAR_AVAILABILITY" });
    assert.equal(gate.outbound, false);
    assert.equal(gate.forceApproval, false);
  });

  it("detects outbound automation actions", () => {
    assert.equal(
      isOutboundAutomationAction({
        actionType: "EXECUTE_EXTERNAL_ACTION",
        parameters: { capability: "SEND_SMS" },
      }),
      true,
    );
    assert.equal(
      isOutboundAutomationAction({
        actionType: "CREATE_WORK",
        parameters: {},
      }),
      false,
    );
    assert.equal(isOutboundCapability("PLACE_VOICE_CALL"), true);
  });

  it("allows owner manager and admin to decide approvals", () => {
    assert.equal(canDecideOutboundApproval("OWNER"), true);
    assert.equal(canDecideOutboundApproval("MANAGER"), true);
    assert.equal(canDecideOutboundApproval("ADMIN"), true);
    assert.equal(canDecideOutboundApproval("VIEWER"), false);
  });
});
