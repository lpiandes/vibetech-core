import assert from "node:assert/strict";
import { test } from "node:test";

import { persistResponsibilityProofResolution } from "./persistResponsibilityProofResolution.js";

test("prove resolution closes matching connection constraints and promotes only ready responsibilities", async () => {
  let saved = null;
  const installation = {
    id: "install_1",
    businessId: "biz_1",
    specificationId: "spec_1",
    configuration: {
      responsibilityRequests: [
        {
          responsibilityId: "resp_email",
          title: "Email follow-through",
          status: "pending",
          constraints: [
            {
              constraintId: "c_email",
              type: "ACCOUNT_CONNECTION_REQUIRED",
              owner: "Customer",
              status: "open",
              description: "Connect business email / Gmail",
            },
          ],
        },
        {
          responsibilityId: "resp_mls",
          title: "MLS sync",
          status: "pending",
          constraints: [
            {
              constraintId: "c_mls",
              type: "ACCOUNT_CONNECTION_REQUIRED",
              owner: "Customer",
              status: "open",
              description: "Connect MLS data source",
            },
          ],
        },
      ],
    },
    history: [],
  };

  const result = await persistResponsibilityProofResolution({
    platformStore: {
      upsertBusinessOSInstallation: async (row) => {
        saved = row;
        return row;
      },
    },
    installation,
    capabilityId: "customer_email_send",
    proveAction: "send_test_email",
    proofReference: "gmail_message_id:msg_1",
    actorId: "user_1",
    nowISO: "2026-08-06T12:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.changed, 1);
  assert.equal(result.promoted, 1);
  assert.equal(saved.configuration.responsibilityRequests[0].status, "live");
  assert.equal(saved.configuration.responsibilityRequests[0].constraints[0].status, "resolved");
  assert.equal(saved.configuration.responsibilityRequests[1].status, "pending");
  assert.equal(saved.configuration.responsibilityRequests[1].constraints[0].status, "open");
});
