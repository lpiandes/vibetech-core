import test from "node:test";
import assert from "node:assert/strict";

import {
  checkSocialCheckerRateLimit,
  filterSubjectRelevant,
  organizePlatformSections,
  rankProfiles,
  runPublicSocialCheck,
} from "./publicSocialChecker.js";
import {
  classifyHitKind,
  extractHandleFromUrl,
  isDirectMention,
  isDirectTag,
  looksLikeRosterOcrPollution,
  profileLooksLikeSubject,
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
  assert.equal(classifyHitKind("https://instagram.com/reel/AbCdEf", "", "", "profile"), "post");
  assert.equal(classifyHitKind("https://x.com/org/status/123"), "post");
  assert.equal(classifyHitKind("https://news.example.com/story", "Mention of someone"), "mention");
});

test("looksLikeRosterOcrPollution catches hockey lineup ghosts", () => {
  const snip = "... LEO PIANDES (A) NICK DEMIO (A) NE 10. newnorthstars's profile picture ...";
  assert.equal(looksLikeRosterOcrPollution(snip, "Leo Piandes"), true);
  assert.equal(
    isDirectMention({
      title: "Utah Mammoth on Instagram: Wake up, our prospects...",
      snippet: snip,
      name: "Leo Piandes",
      handles: ["lpiandes"],
    }),
    false,
  );
  assert.equal(
    isDirectMention({
      title: "Congratulations to Captain Leo Piandes'22",
      snippet: "induction into the National Honor Society",
      name: "Leo Piandes",
      handles: ["lpiandes"],
    }),
    true,
  );
  assert.equal(
    isDirectMention({
      title: "Photo by someone",
      snippet: "Great game with @lpiandes tonight",
      name: "Leo Piandes",
      handles: ["lpiandes"],
    }),
    true,
  );
});

test("profileLooksLikeSubject requires name on profile", () => {
  assert.equal(profileLooksLikeSubject({
    title: "Leo Piandes (@lpiandes)",
    snippet: "Assumption || Tilton",
    url: "https://www.instagram.com/lpiandes/",
    name: "Leo Piandes",
  }), true);
  assert.equal(profileLooksLikeSubject({
    title: "Post Malone (@postmalone)",
    snippet: "17M followers",
    url: "https://www.tiktok.com/@postmalone",
    name: "Leo Piandes",
  }), false);
  // Another account that only mentions the subject in the snippet must NOT win
  assert.equal(profileLooksLikeSubject({
    title: "Ron Paragallo (@ironx11) / Posts / X",
    snippet: "Ronny Paragallo and Leo Piandes help @GoAssumptionU to a big weekend sweep",
    url: "https://x.com/ironx11",
    name: "Leo Piandes",
  }), false);
});

test("organizePlatformSections keeps multiple LinkedIn profiles", () => {
  const sections = organizePlatformSections([
    {
      network: "linkedin",
      kind: "profile",
      title: "Leo Piandes - Student at Tilton School",
      url: "https://www.linkedin.com/in/leo-piandes-26a760222",
      snippet: "Tilton",
      handle: "leo-piandes-26a760222",
      confidence: 90,
    },
    {
      network: "linkedin",
      kind: "profile",
      title: "Leo Piandes - Hockey Player",
      url: "https://www.linkedin.com/in/leo-piandes-other",
      snippet: "Assumption",
      handle: "leo-piandes-other",
      confidence: 85,
    },
  ]);
  assert.equal(sections[0].profiles.length, 2);
  assert.equal(sections[0].profile?.url, "https://www.linkedin.com/in/leo-piandes-26a760222");
});

test("filterSubjectRelevant drops Utah Mammoth OCR ghosts and celebrities", () => {
  const filtered = filterSubjectRelevant([
    {
      network: "instagram",
      kind: "profile",
      title: "Leo Piandes (@lpiandes)",
      url: "https://www.instagram.com/lpiandes/",
      snippet: "780 followers. Assumption || Tilton",
      handle: "lpiandes",
    },
    {
      network: "instagram",
      kind: "post",
      title: "Utah Mammoth on Instagram: Wake up, our prospects just ...",
      url: "https://www.instagram.com/reel/DaMJvkIxA5X/",
      snippet: "... LEO PIANDES (A) NICK DEMIO (A) NE 10. newnorthstars's profile picture ...",
      handle: null,
    },
    {
      network: "instagram",
      kind: "post",
      title: "Congratulations to Captain Leo Piandes'22 for his induction into ...",
      url: "https://www.instagram.com/p/CdPHgUkLt3q/",
      snippet: "Well deserved for his hard work off the field.",
      handle: null,
    },
    {
      network: "tiktok",
      kind: "profile",
      title: "Post Malone (@postmalone)",
      url: "https://www.tiktok.com/@postmalone",
      snippet: "17M followers",
      handle: "postmalone",
    },
  ], { name: "Leo Piandes", handles: ["lpiandes"] });

  assert.ok(filtered.some((h) => h.url.includes("lpiandes") && h.kind === "profile"));
  assert.ok(filtered.some((h) => /Captain Leo Piandes/i.test(h.title)));
  assert.equal(filtered.some((h) => /Utah Mammoth/i.test(h.title)), false);
  assert.equal(filtered.some((h) => /postmalone/i.test(h.url)), false);
});

test("extractHandleFromUrl pulls platform handles", () => {
  assert.equal(extractHandleFromUrl("https://www.instagram.com/sampleuser/"), "sampleuser");
  assert.equal(extractHandleFromUrl("https://www.tiktok.com/@sampleuser"), "sampleuser");
  assert.equal(extractHandleFromUrl("https://www.linkedin.com/in/sample-user-123"), "sample-user-123");
});

test("organizePlatformSections groups profile posts tags mentions", () => {
  const sections = organizePlatformSections(rankProfiles([
    { network: "instagram", kind: "post", relation: "own", title: "Reel", url: "https://instagram.com/reel/abc", snippet: "goal", handle: "jane" },
    { network: "instagram", kind: "profile", title: "Jane", url: "https://instagram.com/jane", snippet: "780 followers", handle: "jane" },
    { network: "instagram", kind: "tag", relation: "tagged", title: "Night out with @jane", url: "https://instagram.com/p/tag1", snippet: "Congrats @jane", handle: null },
    { network: "instagram", kind: "mention", relation: "mentioned", title: "News about Jane Doe", url: "https://instagram.com/p/xyz", snippet: "about jane", handle: null },
    { network: "tiktok", kind: "profile", title: "Jane TT", url: "https://tiktok.com/@jane", snippet: "bio", handle: "jane" },
  ], { name: "Jane Doe", handles: ["jane"] }));
  assert.equal(sections[0].network, "instagram");
  assert.equal(sections[0].profile?.url, "https://instagram.com/jane");
  assert.ok(sections[0].posts.length >= 1);
  assert.ok(sections[0].tags.length >= 1);
  assert.ok(sections[0].mentions.length >= 1);
  assert.ok(sections.some((s) => s.network === "tiktok"));
});

test("isDirectTag requires @handle not bare name", () => {
  assert.equal(isDirectTag({
    title: "Tagged",
    snippet: "Photo with @lpiandes tonight",
    handles: ["lpiandes"],
  }), true);
  assert.equal(isDirectTag({
    title: "Leo Piandes scored",
    snippet: "great game",
    handles: ["lpiandes"],
  }), false);
});

test("pushHit / guessNetwork does not label hockey sites as Instagram", async () => {
  const { guessNetwork } = await import("../integrations/social-screening/serperSocialDiscovery.js");
  assert.equal(guessNetwork("https://www.assumptiongreyhounds.com/sports/mhockey/2026-27/bios/piandes_leo_mhk"), "web");
  assert.equal(guessNetwork("https://www.instagram.com/p/AbCd/"), "instagram");
  assert.equal(guessNetwork("https://www.eliteprospects.com/player/123/leo-piandes"), "web");
});

test("organizePlatformSections marks private empty states", () => {
  const sections = organizePlatformSections([
    {
      network: "instagram",
      kind: "profile",
      title: "Leo (@lpiandes)",
      url: "https://www.instagram.com/lpiandes/",
      snippet: "Private",
      handle: "lpiandes",
      confidence: 90,
    },
  ], { instagram: "private" });
  assert.equal(sections[0].visibility, "private");
  assert.match(sections[0].postsEmptyReason, /Private profile/i);
  assert.match(sections[0].tagsEmptyReason, /Private profile/i);
});

test("runPublicSocialCheck requires name or handle", async () => {
  const res = await runPublicSocialCheck({ name: "", handle: "", serperApiKey: "k" });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "name_required");
});

test("runPublicSocialCheck profile-first finds instagram then own content", async () => {
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
    if (q.includes("instagram.com") && (q.includes("-inurl") || q.includes("site:instagram.com/janedoe"))) {
      return {
        ok: true,
        json: async () => ({
          organic: [{
            title: "Jane Doe (@janedoe) • Instagram photos and videos",
            link: "https://www.instagram.com/janedoe/",
            snippet: "120 followers",
          }],
        }),
      };
    }
    if (q.includes("Jane Doe on Instagram") || (q.includes("site:instagram.com/janedoe") && !q.includes("-inurl"))) {
      return {
        ok: true,
        json: async () => ({
          organic: [{
            title: "Jane Doe on Instagram: My goal",
            link: "https://www.instagram.com/p/OwnPost1/",
            snippet: "janedoe's post",
          }],
        }),
      };
    }
    if (q.includes("@janedoe") && q.includes("instagram")) {
      return {
        ok: true,
        json: async () => ({
          organic: [{
            title: "Team night with @janedoe",
            link: "https://www.instagram.com/p/TagPost1/",
            snippet: "Congrats to @janedoe",
          }],
        }),
      };
    }
    return { ok: true, json: async () => ({ organic: [] }) };
  };
  const res = await runPublicSocialCheck({
    name: "Jane Doe",
    handlesByPlatform: { instagram: "janedoe" },
    serperApiKey: "test-key",
    fetchImpl,
  });
  assert.equal(res.ok, true);
  const ig = res.platforms.find((p) => p.network === "instagram");
  assert.ok(ig, "instagram platform present");
  assert.ok(ig.profile?.url?.includes("janedoe"), "instagram profile resolved");
  assert.ok(
    (ig.tags?.length ?? 0) >= 1 || (ig.mentions?.length ?? 0) >= 1,
    "instagram tags or mentions present",
  );
  assert.equal(res.subject.handlesByPlatform?.instagram, "janedoe");
  assert.match(res.disclaimer, /Not an employment/i);
});

test("filterSubjectRelevant keeps tags separate from name mentions", () => {
  const filtered = filterSubjectRelevant([
    {
      network: "instagram",
      kind: "tag",
      relation: "tagged",
      title: "Team night with @janedoe",
      url: "https://www.instagram.com/p/TagPost1/",
      snippet: "Congrats to @janedoe",
      handle: null,
    },
    {
      network: "instagram",
      kind: "mention",
      title: "Congratulations to Captain Jane Doe",
      url: "https://www.instagram.com/p/Mention1/",
      snippet: "Well deserved",
      handle: null,
    },
    {
      network: "instagram",
      kind: "post",
      title: "Unrelated celebrity news",
      url: "https://www.instagram.com/p/Noise/",
      snippet: "someone else entirely",
      handle: null,
    },
  ], { name: "Jane Doe", handles: ["janedoe"] });

  assert.ok(filtered.some((h) => h.kind === "tag" && /@janedoe/i.test(h.title)));
  assert.ok(filtered.some((h) => h.kind === "mention" && /Jane Doe/i.test(h.title)));
  assert.equal(filtered.some((h) => /Noise/i.test(h.url)), false);
});

test("handles-only seed does not monopolize multi-platform recall", async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const q = String(body.q ?? "");
    if (q.includes("Jane Doe") && q.includes("linkedin")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          organic: [{
            title: "Jane Doe - Product Manager",
            link: "https://www.linkedin.com/in/jane-doe-pm",
            snippet: "San Francisco · Product",
          }],
        }),
      };
    }
    if (q.includes("@jane") && q.includes("instagram")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          organic: [{
            title: "Team shoutout featuring @jane",
            link: "https://www.instagram.com/p/MentionJane1/",
            snippet: "Congrats to @jane on the win",
          }],
        }),
      };
    }
    if (q === '"Jane Doe"' || (q.includes('"Jane Doe"') && !q.includes("site:"))) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          organic: [{
            title: "Jane Doe named captain",
            link: "https://news.example.com/jane-doe-captain",
            snippet: "Jane Doe led the team this season",
          }],
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ organic: [] }) };
  };

  const res = await runPublicSocialCheck({
    name: "Jane Doe",
    handlesByPlatform: { instagram: "jane" },
    serperApiKey: "test-key",
    fetchImpl,
  });
  assert.equal(res.ok, true);
  assert.ok(res.meta?.networksSearched?.includes("linkedin"), "linkedin was searched");
  assert.ok(res.meta?.networksSearched?.includes("instagram"), "instagram was searched");
  assert.ok(res.meta?.searchesCount >= 7, "core sweep ran multiple queries");
  assert.ok(
    res.profiles.some((p) => p.network === "linkedin" && /linkedin\.com\/in\//i.test(p.url)),
    "linkedin profile present",
  );
  assert.ok(
    res.profiles.some((p) => /MentionJane1|@jane/i.test(`${p.url} ${p.title} ${p.snippet}`)),
    "instagram mention/tag present",
  );
  assert.ok(
    res.profiles.some((p) => /news\.example\.com|named captain/i.test(`${p.url} ${p.title}`)),
    "web hit present",
  );
  assert.ok(
    res.profiles.some((p) => p.network === "instagram" && p.kind === "profile"),
    "seeded instagram profile still present",
  );
});

test("core discovery jobs cover every core network with a name site query", async () => {
  const {
    CORE_DISCOVERY_NETWORKS,
    buildCoreDiscoveryJobs,
  } = await import("../integrations/social-screening/serperSocialDiscovery.js");
  const jobs = buildCoreDiscoveryJobs({
    name: "Jane Doe",
    handlesByNetwork: { instagram: "jane" },
  });
  for (const network of CORE_DISCOVERY_NETWORKS) {
    if (network === "web") {
      assert.ok(jobs.some((j) => j.network === "web" && /"Jane Doe"/.test(j.query)));
      continue;
    }
    assert.ok(
      jobs.some((j) => j.network === network && j.query.includes('"Jane Doe"') && /site:/i.test(j.query)),
      `missing site query for ${network}`,
    );
  }
  assert.ok(jobs.some((j) => j.network === "instagram" && /@jane/i.test(j.query)));
});

test("serperSearchWithMeta retries once after 429", async () => {
  const { serperSearchWithMeta } = await import("../integrations/social-screening/serperSocialDiscovery.js");
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      return { ok: false, status: 429, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        organic: [{ title: "Jane Doe", link: "https://www.linkedin.com/in/jane", snippet: "bio" }],
      }),
    };
  };
  const result = await serperSearchWithMeta({
    query: '"Jane Doe" site:linkedin.com',
    apiKey: "k",
    fetchImpl,
    num: 5,
  });
  assert.equal(calls, 2);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 1);
});

test("wrong-person X profile stays blocked after filter", () => {
  const filtered = filterSubjectRelevant([
    {
      network: "x",
      kind: "profile",
      title: "Ron Paragallo (@ironx11) / Posts / X",
      url: "https://x.com/ironx11",
      snippet: "Ronny Paragallo and Leo Piandes help @GoAssumptionU to a big weekend sweep",
      handle: "ironx11",
    },
    {
      network: "x",
      kind: "mention",
      relation: "mentioned",
      title: "Leo Piandes scores twice",
      url: "https://x.com/someone/status/1",
      snippet: "Leo Piandes with the brace",
      handle: null,
    },
  ], { name: "Leo Piandes", handles: ["lpiandes"] });

  assert.equal(filtered.some((h) => /ironx11/i.test(h.url)), false);
  assert.ok(filtered.some((h) => h.kind === "mention" && /Leo Piandes/i.test(h.title)));
});
