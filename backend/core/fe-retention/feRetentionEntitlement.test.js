import test from "node:test";
import assert from "node:assert/strict";

import {
  presentFeRetentionBook,
  resolveFeRetentionEntitlement,
  resolveFeRetentionNextPath,
} from "./feRetentionEntitlement.js";
import { writeFeRetentionBilling } from "./FeRetentionBilling.js";

test("paid book wins over unpaid when resolving entitlement", () => {
  const unpaid = {
    id: "biz_unpaid",
    packageConfiguration: writeFeRetentionBilling({}, { status: "past_due" }),
  };
  const paid = {
    id: "biz_paid",
    packageConfiguration: writeFeRetentionBilling({}, { status: "active" }),
  };
  const result = resolveFeRetentionEntitlement({ businesses: [unpaid, paid] });
  assert.equal(result.entitled, true);
  assert.equal(result.businessId, "biz_paid");
  assert.equal(result.allowsDashboard, true);
});

test("unpaid-only entitlement is entitled but blocked from dashboard", () => {
  const unpaid = {
    id: "biz_unpaid",
    name: "Acme",
    packageConfiguration: writeFeRetentionBilling({}, { status: "incomplete" }),
  };
  const result = resolveFeRetentionEntitlement({ businesses: [unpaid] });
  assert.equal(result.entitled, true);
  assert.equal(result.allowsDashboard, false);
  assert.equal(presentFeRetentionBook(unpaid).needsPayment, true);
});

test("resolveFeRetentionNextPath sends agents to dashboard, billing, or admin directory", () => {
  assert.equal(resolveFeRetentionNextPath({ signedIn: false }).kind, "gate");
  assert.equal(resolveFeRetentionNextPath({ signedIn: true, isPlatformAdmin: true }).href, "/admin/insurance");
  assert.deepEqual(
    resolveFeRetentionNextPath({
      signedIn: true,
      books: [{ id: "a", allowsDashboard: true }],
    }),
    { kind: "dashboard", href: "/insurance/a" },
  );
  assert.equal(
    resolveFeRetentionNextPath({
      signedIn: true,
      books: [{ id: "a", allowsDashboard: false }],
    }).kind,
    "billing",
  );
});
