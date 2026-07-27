import test from "node:test";
import assert from "node:assert/strict";

import { readSocialScreeningKeys, isSocialScreeningReady } from "./socialScreeningKeys.js";
import { runSocialBackgroundScreen } from "./SocialBackgroundScreeningService.js";
import { formatSocialScreenReportBody } from "./analyzeSocialScreenReport.js";

test("keys ready only when both present", () => {
  assert.equal(readSocialScreeningKeys({ env: {} }).ready, false);
  assert.equal(readSocialScreeningKeys({
    env: { SERPER_API_KEY: "s", SCRAPINGBEE_API_KEY: "b" },
  }).ready, true);
  assert.equal(isSocialScreeningReady({
    env: {},
    connection: { metadata: { ready: true } },
  }), true);
});

test("runSocialBackgroundScreen fails without keys", async () => {
  const result = await runSocialBackgroundScreen({
    subject: { name: "Jane Doe" },
    env: {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "social_screening_keys_missing");
});

test("runSocialBackgroundScreen with mocked Serper/ScrapingBee", async () => {
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.includes("serper.dev")) {
      return {
        ok: true,
        json: async () => ({
          organic: [
            {
              title: "Jane Doe | LinkedIn",
              link: "https://www.linkedin.com/in/janedoe",
              snippet: "Product manager",
            },
          ],
        }),
      };
    }
    if (u.includes("scrapingbee.com")) {
      return {
        ok: true,
        headers: { get: () => "text/html" },
        text: async () => "<html><body>Jane Doe public profile about work</body></html>",
      };
    }
    throw new Error(`unexpected fetch ${u} ${JSON.stringify(init)}`);
  };

  const result = await runSocialBackgroundScreen({
    subject: { name: "Jane Doe" },
    keys: { serperApiKey: "s", scrapingBeeApiKey: "b" },
    fetchImpl,
    llmProvider: {
      generate: async () => JSON.stringify({
        subjectName: "Jane Doe",
        summary: "Public LinkedIn profile found.",
        profilesFound: [{ network: "linkedin", url: "https://www.linkedin.com/in/janedoe", title: "Jane Doe" }],
        findings: [],
        filterNotes: ["Protected-characteristic filter applied."],
        confidence: 0.6,
        disclaimer: "Public-web only.",
      }),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.report.subjectName, "Jane Doe");
  assert.ok(result.reportBody.includes("Social background screening"));
  assert.ok(formatSocialScreenReportBody(result.report).includes("Jane Doe"));
});
