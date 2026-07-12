import assert from "node:assert/strict";
import { test } from "node:test";

import { scrubInternalWording, humanizeEnumLabel, looksLikeInternalId } from "../../../frontend/lib/operating/businessLanguage.ts";

test("business language scrubber removes internal wording", () => {
  assert.equal(scrubInternalWording("from canonical evidence"), "from supporting records");
  assert.equal(scrubInternalWording("open vibetech_app"), "open VIBETech");
  assert.equal(humanizeEnumLabel("IN_PROGRESS"), "In Progress");
  assert.equal(looksLikeInternalId("snap_abc"), true);
  assert.equal(looksLikeInternalId("Follow-up completed"), false);
});
