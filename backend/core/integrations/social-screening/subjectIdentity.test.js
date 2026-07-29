import test from "node:test";
import assert from "node:assert/strict";

import {
  classifySubjectRelation,
  isSubjectOwnPost,
  isSubjectProfile,
} from "./subjectIdentity.js";
import { filterSubjectRelevant, organizePlatformSections } from "../../social-checker/publicSocialChecker.js";

test("isSubjectProfile rejects teammate title on any platform", () => {
  const subject = { name: "Jane Doe", handles: [] };
  assert.equal(isSubjectProfile({
    title: "Jane Doe (@janedoe)",
    url: "https://www.instagram.com/janedoe/",
    snippet: "bio",
  }, subject), true);
  assert.equal(isSubjectProfile({
    title: "Sam Other (@samother) / Posts / X",
    url: "https://x.com/samother",
    snippet: "Congrats to Jane Doe on the win",
  }, subject), false);
  assert.equal(isSubjectProfile({
    title: "Sam Other (@samother)",
    url: "https://www.tiktok.com/@samother",
    snippet: "duet with Jane Doe",
  }, subject), false);
});

test("isSubjectOwnPost requires subject handle or Name-on-Platform title", () => {
  const subject = { name: "Jane Doe", handles: ["janedoe"] };
  assert.equal(isSubjectOwnPost({
    title: "Jane Doe on Instagram: Hello",
    url: "https://www.instagram.com/p/abc/",
    snippet: "hi",
  }, subject), true);
  assert.equal(isSubjectOwnPost({
    title: "Sam Other on Instagram: Hello Jane Doe",
    url: "https://www.instagram.com/p/xyz/",
    handle: "samother",
    snippet: "featuring Jane",
  }, subject), false);
  assert.equal(isSubjectOwnPost({
    title: "Weekend reel",
    url: "https://www.instagram.com/janedoe/reel/abc/",
    handle: "janedoe",
    snippet: "goal",
  }, subject), true);
});

test("classifySubjectRelation is platform-agnostic for wrong-person profiles", () => {
  const subject = { name: "Jane Doe", handles: ["janedoe"] };
  assert.equal(classifySubjectRelation({
    kind: "profile",
    title: "Ron Other (@ironx11) / Posts / X",
    snippet: "Ron and Jane Doe help the team",
    url: "https://x.com/ironx11",
    handle: "ironx11",
  }, subject), null);
  assert.equal(classifySubjectRelation({
    kind: "mention",
    title: "Congratulations to Captain Jane Doe",
    snippet: "well deserved",
    url: "https://www.instagram.com/p/1/",
  }, subject), "mention");
});

test("filter keeps multiple Instagram profiles with the same subject name", () => {
  const filtered = filterSubjectRelevant([
    {
      network: "instagram",
      kind: "profile",
      title: "Jane Doe (@jane.personal)",
      url: "https://www.instagram.com/jane.personal/",
      snippet: "personal",
      handle: "jane.personal",
    },
    {
      network: "instagram",
      kind: "profile",
      title: "Jane Doe (@jane.hockey)",
      url: "https://www.instagram.com/jane.hockey/",
      snippet: "hockey",
      handle: "jane.hockey",
    },
    {
      network: "instagram",
      kind: "profile",
      title: "Coach Sam (@coachsam)",
      url: "https://www.instagram.com/coachsam/",
      snippet: "Photo with Jane Doe yesterday",
      handle: "coachsam",
    },
  ], { name: "Jane Doe", handles: [] });

  const igProfiles = filtered.filter((h) => h.kind === "profile" && h.network === "instagram");
  assert.equal(igProfiles.length, 2);
  assert.equal(filtered.some((h) => /coachsam/i.test(h.url)), false);

  const sections = organizePlatformSections(filtered);
  assert.equal(sections[0].profiles.length, 2);
});
