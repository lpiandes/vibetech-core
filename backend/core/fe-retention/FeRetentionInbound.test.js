import test from "node:test";
import assert from "node:assert/strict";

import { writeFeRetentionBilling } from "./FeRetentionBilling.js";
import { applyFeInboundByPhone } from "./FeRetentionInbound.js";
import { emptyFeRetentionState, upsertFeClient, isFeClientSmsPaused } from "./FeRetentionStore.js";

function makeInboundStore(books) {
  const installations = new Map();
  for (const book of books) {
    installations.set(book.id, {
      id: `install_${book.id}`,
      businessId: book.id,
      configuration: { feRetention: book.state },
    });
  }
  return {
    books,
    async listBusinesses() { return books; },
    async getIntegrationCredential() { return null; },
    async getBusinessOSInstallation(businessId) {
      return installations.get(String(businessId)) ?? null;
    },
    async upsertBusinessOSInstallation(row) {
      installations.set(String(row.businessId), row);
      const book = books.find((b) => String(b.id) === String(row.businessId));
      if (book) book.state = row.configuration?.feRetention ?? book.state;
      return row;
    },
  };
}

test("STOP on a dedicated To-number only pauses that book's client", async () => {
  const sharedPhone = "+15550001111";
  const dadState = upsertFeClient(emptyFeRetentionState(), {
    id: "c_dad",
    name: "Same Person",
    phone: sharedPhone,
  }).state;
  const twoState = upsertFeClient(emptyFeRetentionState(), {
    id: "c_two",
    name: "Same Person",
    phone: sharedPhone,
  }).state;

  const dad = {
    id: "biz_dad",
    name: "Dad Agency",
    packageConfiguration: writeFeRetentionBilling({}, {
      status: "complimentary",
      twilioFromNumber: "+15551234567",
    }),
    state: dadState,
  };
  const two = {
    id: "biz_two",
    name: "Second Agency",
    packageConfiguration: writeFeRetentionBilling({}, {
      status: "active",
      twilioFromNumber: "+15559990000",
    }),
    state: twoState,
  };
  const store = makeInboundStore([dad, two]);

  const result = await applyFeInboundByPhone({
    platformStore: store,
    fromPhone: sharedPhone,
    toNumber: "+15559990000",
    inboundText: "STOP",
  });

  assert.equal(result.ok, true);
  assert.equal(result.intent, "stop");
  assert.equal(result.count, 1);
  assert.equal(result.matches[0].businessId, "biz_two");
  assert.equal(isFeClientSmsPaused(two.state.clients[0]), true);
  assert.equal(isFeClientSmsPaused(dad.state.clients[0]), false);
});
