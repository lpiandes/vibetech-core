import test from "node:test";
import assert from "node:assert/strict";

import {
  detectProfileVisibility,
  looksLikePrivateProfileText,
  looksLikePublicProfileText,
  privatePostsMessage,
} from "./profileVisibility.js";

test("looksLikePrivateProfileText catches Instagram private gate", () => {
  assert.equal(looksLikePrivateProfileText('{"is_private":true,"username":"x"}'), true);
  assert.equal(looksLikePrivateProfileText("This Account is Private"), true);
  assert.equal(looksLikePrivateProfileText("Leo Piandes · 120 posts · 800 followers"), false);
});

test("looksLikePublicProfileText requires follower/post signals", () => {
  assert.equal(looksLikePublicProfileText("120 posts 800 followers"), true);
  assert.equal(looksLikePublicProfileText("This Account is Private"), false);
});

test("detectProfileVisibility returns public when own posts exist", async () => {
  const vis = await detectProfileVisibility({
    network: "instagram",
    profileUrl: "https://www.instagram.com/jane/",
    handle: "jane",
    existingHits: [{
      network: "instagram",
      kind: "post",
      relation: "own",
      title: "Jane on Instagram",
      url: "https://www.instagram.com/p/1/",
    }],
  });
  assert.equal(vis, "public");
});

test("detectProfileVisibility returns private from snippet language", async () => {
  const vis = await detectProfileVisibility({
    network: "instagram",
    profileUrl: "https://www.instagram.com/jane/",
    handle: "jane",
    existingHits: [{
      network: "instagram",
      kind: "profile",
      title: "Jane",
      snippet: "This account is private",
      url: "https://www.instagram.com/jane/",
    }],
  });
  assert.equal(vis, "private");
});

test("privatePostsMessage is explicit", () => {
  assert.match(privatePostsMessage("instagram"), /Private profile/i);
  assert.match(privatePostsMessage("instagram"), /can't extract/i);
});

test("privateTagsMessage does not mention Google", async () => {
  const { privateTagsMessage } = await import("./profileVisibility.js");
  assert.equal(/google/i.test(privateTagsMessage()), false);
});
