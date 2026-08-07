import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInstallationUsageStore,
  incrementInstallationUsage,
  peekInstallationUsage,
  readUsageMetersFromInstallation,
} from "./InstallationUsageLedger.js";
import { peekUsage, recordUsage, resetUsageMetersForTests } from "./UsageMetering.js";

test("installation usage ledger increments and peeks", () => {
  let installation = { businessId: "biz_u1", configuration: {} };
  const bumped = incrementInstallationUsage({
    installation,
    meterId: "sms_segments",
    quantity: 3,
    nowISO: "2026-08-07T12:00:00.000Z",
  });
  assert.equal(bumped.used, 3);
  installation = bumped.installation;
  assert.equal(peekInstallationUsage({ installation, meterId: "sms_segments", nowISO: "2026-08-07T12:00:00.000Z" }).used, 3);
  assert.ok(readUsageMetersFromInstallation(installation)["2026-08"]?.sms_segments === 3);
});

test("UsageMetering reads installation store when provided", () => {
  resetUsageMetersForTests();
  const installation = { businessId: "biz_u2", configuration: { usageMeters: { "2026-08": { emails: 9 } } } };
  const store = createInstallationUsageStore(installation);
  const peek = peekUsage({
    businessId: "biz_u2",
    meterId: "emails",
    nowISO: "2026-08-07T12:00:00.000Z",
    platformStore: store,
  });
  assert.equal(peek.used, 9);
  const next = recordUsage({
    businessId: "biz_u2",
    meterId: "emails",
    quantity: 1,
    nowISO: "2026-08-07T12:00:00.000Z",
    platformStore: store,
  });
  assert.equal(next.used, 10);
});
