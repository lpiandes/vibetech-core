import test from "node:test";
import assert from "node:assert/strict";

import {
  checkSocialCheckerRateLimit,
  rankProfiles,
  runPublicSocialCheck,
} from "./publicSocialChecker.js";

test("rate limit soft-caps per day key", () => {
  const store = new Map();
  const a = checkSocialCheckerRateLimit({ key: "1.1.1.1", limit: 2, store, now: Date.parse("2026-07-27T12:00:00Z") });
  const b = checkSocialCheckerRateLimit({ key: "1.1.1.1", limit: 2, store, now: Date.parse("2026-07-27T12:00:00Z") });
  const c = checkSocialCheckerRateLimit({ key: "1.1.1.1", limit: 2, store, now: Date.parse("2026-07-27T12:00:00Z") });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.ok, false);
  assert.equal(c.remaining, 0);
});

test("rankProfiles prefers linkedin profile urls", () => {
  const ranked = rankProfiles([
    { network: "web", title: "Random", url: "https://example.com", snippet: "x" },
    { network: "linkedin", title: "Jane Doe", url: "https://linkedin.com/in/jane", snippet: "About profile" },
  ]);
  assert.equal(ranked[0].network, "linkedin");
  assert.ok(ranked[0].confidence > ranked[1].confidence);
});

test("runPublicSocialCheck requires name or handle", async () => {
  const res = await runPublicSocialCheck({ name: "", handle: "", serperApiKey: "k" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "name_required");
});

test("runPublicSocialCheck uses discovery mock", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      organic: [
        {
          title: "Jane Doe - LinkedIn",
          link: "https://www.linkedin.com/in/janedoe",
          snippet: "Product leader profile",
        },
      ],
    }),
  });
  const res = await runPublicSocialCheck({
    name: "Jane Doe",
    handle: "janedoe",
    serperApiKey: "test-key",
    fetchImpl,
  });
  assert.equal(res.ok, true);
  assert.ok(res.profiles.length >= 1);
  assert.match(res.disclaimer, /Not an employment/i);
});
