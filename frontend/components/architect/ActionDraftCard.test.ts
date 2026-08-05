import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

test("Ask action drafts expose preview, work, and dismiss actions", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const actionDraftCard = readFileSync(path.join(here, "ActionDraftCard.tsx"), "utf8");
  assert.match(actionDraftCard, />\s*Preview\s*</);
  assert.match(actionDraftCard, />\s*Create work\s*</);
  assert.match(actionDraftCard, />\s*Do nothing\s*</);
});
