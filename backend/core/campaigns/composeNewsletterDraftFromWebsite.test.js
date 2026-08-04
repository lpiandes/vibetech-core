import assert from "node:assert/strict";
import { test } from "node:test";

import { composeNewsletterDraftFromWebsite } from "./composeNewsletterDraftFromWebsite.js";

test("composeNewsletterDraftFromWebsite returns editable shell without website", async () => {
  const result = await composeNewsletterDraftFromWebsite({
    businessName: "McBride Real Estate",
    listingName: "12 Oak St",
    websiteUrl: null,
  });
  assert.equal(result.ok, true);
  assert.equal(result.websiteFetched, false);
  assert.match(result.draft.subjectLine, /12 Oak St/);
  assert.ok(result.draft.intro);
  assert.ok(result.draft.highlights);
  assert.match(result.draft.listingBody, /12 Oak St/);
  assert.ok(result.draft.ctaText);
  assert.match(result.draft.signature, /McBride/);
});

test("composeNewsletterDraftFromWebsite uses scraped website text when fetch works", async () => {
  const result = await composeNewsletterDraftFromWebsite({
    businessName: "Acme",
    websiteUrl: "https://example.com",
    fetchImpl: async () => ({
      text: async () => "<html><body><h1>Acme Homes</h1><p>Family real estate since 1999.</p></body></html>",
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.websiteFetched, true);
  assert.ok(result.draft.subjectLine);
});
