import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessGraphRuntime } from "../../business-graph/BusinessGraphRuntime.js";
import { BusinessSubjectRuntime } from "../../business-subject/BusinessSubjectRuntime.js";
import { RequestRuntime } from "../../request/RequestRuntime.js";
import { InteractionRuntime } from "../../interactions/InteractionRuntime.js";
import {
  buildMissedCallDialTwiml,
  defaultMissedCallSmsBody,
  handleMissedCallFollowUp,
  isMissedDialStatus,
  renderMissedCallSmsBody,
  resolveMissedCallFollowUpConfig,
} from "./missedCallSmsFollowUp.js";

const NOW = "2026-08-04T02:00:00.000Z";

function buildStack() {
  return {
    businessGraphRuntime: new BusinessGraphRuntime(),
    businessSubjectRuntime: new BusinessSubjectRuntime(),
    requestRuntime: new RequestRuntime({ nowISO: NOW }),
    interactionRuntime: new InteractionRuntime(),
  };
}

test("isMissedDialStatus recognizes unanswered dial outcomes", () => {
  assert.equal(isMissedDialStatus("no-answer"), true);
  assert.equal(isMissedDialStatus("busy"), true);
  assert.equal(isMissedDialStatus("failed"), true);
  assert.equal(isMissedDialStatus("canceled"), true);
  assert.equal(isMissedDialStatus("completed"), false);
  assert.equal(isMissedDialStatus("answered"), false);
});

test("SMS body templates stay generic with placeholders", () => {
  assert.match(defaultMissedCallSmsBody({ businessName: "Acme Homes" }), /Acme Homes/);
  assert.equal(
    renderMissedCallSmsBody("Hi {firstName} from {businessName}", {
      businessName: "Acme",
      firstName: "Tim",
    }),
    "Hi Tim from Acme",
  );
});

test("resolveMissedCallFollowUpConfig requires enabled + forward number", () => {
  const vault = {
    get(id) {
      if (id !== "cred_twilio_voice_biz_1") return null;
      return {
        metadata: {
          missedCallFollowUpEnabled: true,
          forwardNumber: "+15551212",
          ringTimeoutSeconds: 25,
        },
      };
    },
  };
  const config = resolveMissedCallFollowUpConfig({
    businessId: "biz_1",
    workspace: { connected: { integrationPlatform: { credentialVault: vault } } },
  });
  assert.equal(config.active, true);
  assert.equal(config.forwardNumber, "+15551212");
  assert.equal(config.ringTimeoutSeconds, 25);
});

test("buildMissedCallDialTwiml rings forward number with dial-result action", () => {
  const xml = buildMissedCallDialTwiml({
    forwardNumber: "+15550001111",
    timeoutSeconds: 18,
    actionUrl: "https://app.example/dial-result",
  });
  assert.match(xml, /<Dial timeout="18"/);
  assert.match(xml, /<Number>\+15550001111<\/Number>/);
  assert.match(xml, /action="https:\/\/app\.example\/dial-result"/);
});

test("handleMissedCallFollowUp creates party/request and sends SMS once", async () => {
  const stack = buildStack();
  const sent = [];
  const first = await handleMissedCallFollowUp({
    stack,
    businessId: "biz_demo",
    fromPhone: "+15559876543",
    callSid: "CA_test_1",
    disposition: "no-answer",
    businessName: "Demo Realty",
    nowISO: NOW,
    persist: false,
    sendSms: async ({ to, body }) => {
      sent.push({ to, body });
      return { ok: true, status: "completed" };
    },
  });

  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  assert.ok(first.partyId);
  assert.equal(stack.requestRuntime.getRequest("req_inbound_CA_test_1")?.id, "req_inbound_CA_test_1");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "+15559876543");
  assert.match(sent[0].body, /Demo Realty/);

  const second = await handleMissedCallFollowUp({
    stack,
    businessId: "biz_demo",
    fromPhone: "+15559876543",
    callSid: "CA_test_1",
    disposition: "no-answer",
    businessName: "Demo Realty",
    nowISO: NOW,
    persist: false,
    sendSms: async ({ to, body }) => {
      sent.push({ to, body });
      return { ok: true, status: "completed" };
    },
  });

  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(sent.length, 1);
});

test("handleMissedCallFollowUp records CRM path without SMS when send path unavailable", async () => {
  const stack = buildStack();
  const result = await handleMissedCallFollowUp({
    stack,
    businessId: "biz_demo",
    fromPhone: "+15551112222",
    callSid: "CA_test_2",
    disposition: "busy",
    businessName: "Demo Realty",
    nowISO: NOW,
    persist: false,
    workspace: { connected: { integrationPlatform: { connectionRuntime: { getConnections: () => [] } } } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.smsSent, false);
  assert.equal(result.smsSkipReason, "sms_not_connected");
  assert.ok(result.partyId);
});
