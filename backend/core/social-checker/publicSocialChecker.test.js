import test from "node:test";
import assert from "node:assert/strict";

import {
  checkSocialCheckerRateLimit,
  organizePlatformSections,
  rankProfiles,
  runPublicSocialCheck,
} from "./publicSocialChecker.js";
import {
  classifyHitKind,
  extractHandleFromUrl,
} from "../integrations/social-screening/serperSocialDiscovery.js";

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
    { network: "web", kind: "mention", title: "Random", url: "https://example.com", snippet: "x" },
    { network: "linkedin", kind: "profile", title: "Jane Doe", url: "https://linkedin.com/in/jane", snippet: "About profile" },
  ]);
  assert.equal(ranked[0].network, "linkedin");
  assert.ok(ranked[0].confidence > ranked[1].confidence);
});

test("classifyHitKind separates profiles posts and mentions", () => {
  assert.equal(classifyHitKind("https://instagram.com/someone"), "profile");
  assert.equal(classifyHitKind("https://instagram.com/p/AbCdEf"), "post");
  // Query preference must not override clear post URLs
  assert.equal(classifyHitKind("https://instagram.com/reel/AbCdEf", "", "", "profile"), "post");
  assert.equal(classifyHitKind("https://x.com/org/status/123"), "post");
  assert.equal(classifyHitKind("https://news.example.com/story", "Mention of someone"), "mention");
});

test("filterSubjectRelevant drops unrelated celebrity noise", async () => {
  const { filterSubjectRelevant } = await import("./publicSocialChecker.js");
  const filtered = filterSubjectRelevant([
    {
      network: "instagram",
      kind: "profile",
      title: "Jane Doe (@janedoe)",
      url: "https://www.instagram.com/janedoe/",
      snippet: "Jane Doe. 100 followers",
      handle: "janedoe",
    },
    {
      network: "tiktok",
      kind: "profile",
      title: "Post Malone (@postmalone)",
      url: "https://www.tiktok.com/@postmalone",
      snippet: "17M followers",
      handle: "postmalone",
    },
    {
      network: "instagram",
      kind: "post",
      title: "Hat trick by Jane Doe",
      url: "https://www.instagram.com/p/abc",
      snippet: "Jane Doe scores again",
      handle: null,
    },
    {
      network: "youtube",
      kind: "profile",
      title: "Megyn Kelly",
      url: "https://www.youtube.com/@MegynKelly",
      snippet: "Talk show",
      handle: "MegynKelly",
    },
  ], { name: "Jane Doe", handles: ["janedoe"] });

  assert.ok(filtered.some((h) => h.handle === "janedoe"));
  assert.ok(filtered.some((h) => /Hat trick/i.test(h.title)));
  assert.equal(filtered.some((h) => /postmalone/i.test(h.url)), false);
  assert.equal(filtered.some((h) => /MegynKelly/i.test(h.url)), false);
});

test("extractHandleFromUrl pulls platform handles", () => {
  assert.equal(extractHandleFromUrl("https://www.instagram.com/sampleuser/"), "sampleuser");
  assert.equal(extractHandleFromUrl("https://www.tiktok.com/@sampleuser"), "sampleuser");
  assert.equal(extractHandleFromUrl("https://www.linkedin.com/in/sample-user-123"), "sample-user-123");
});

test("organizePlatformSections groups profile then posts then mentions", () => {
  const sections = organizePlatformSections(rankProfiles([
    { network: "instagram", kind: "post", relation: "own", title: "Reel", url: "https://instagram.com/reel/abc", snippet: "goal", handle: "jane" },
    { network: "instagram", kind: "profile", title: "Jane", url: "https://instagram.com/jane", snippet: "780 followers", handle: "jane" },
    { network: "instagram", kind: "mention", relation: "mentioned", title: "News", url: "https://instagram.com/p/xyz", snippet: "about jane", handle: null },
    { network: "tiktok", kind: "profile", title: "Jane TT", url: "https://tiktok.com/@jane", snippet: "bio", handle: "jane" },
  ], { name: "Jane Doe", handles: ["jane"] }));
  assert.equal(sections[0].network, "instagram");
  assert.equal(sections[0].profile?.url, "https://instagram.com/jane");
  assert.ok(sections[0].posts.length >= 1);
  assert.ok(sections.some((s) => s.network === "tiktok"));
});

test("runPublicSocialCheck requires name or handle", async () => {
  const res = await runPublicSocialCheck({ name: "", handle: "", serperApiKey: "k" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "name_required");
});

test("runPublicSocialCheck deep discovery returns platforms", async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const q = String(body.q ?? "");
    if (q.includes("linkedin.com/in")) {
      return {
        ok: true,
        json: async () => ({
          organic: [{
            title: "Jane Doe - LinkedIn",
            link: "https://www.linkedin.com/in/janedoe",
            snippet: "Product leader profile",
          }],
        }),
      };
    }
    if (q.includes("instagram.com") && q.includes("-inurl")) {
      return {
        ok: true,
        json: async () => ({
          organic: [{
            title: "Jane Doe (@janedoe)",
            link: "https://www.instagram.com/janedoe/",
            snippet: "120 followers",
          }],
        }),
      };
    }
    if (q.includes("instagram.com/p") || q.includes("instagram.com/reel")) {
      return {
        ok: true,
        json: async () => ({
          organic: [{
            title: "A public reel",
            link: "https://www.instagram.com/reel/AbC123/",
            snippet: "Jane Doe scores",
          }],
        }),
      };
    }
    return { ok: true, json: async () => ({ organic: [] }) };
  };
  const res = await runPublicSocialCheck({
    name: "Jane Doe",
    handle: "janedoe",
    serperApiKey: "test-key",
    fetchImpl,
  });
  assert.equal(res.ok, true);
  assert.ok(res.profiles.length >= 1);
  assert.ok(Array.isArray(res.platforms));
  assert.ok(res.platforms.length >= 1);
  assert.match(res.disclaimer, /Not an employment/i);
});
