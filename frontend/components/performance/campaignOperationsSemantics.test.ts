import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCampaignWorkReviewHref,
  campaignPrepareDisabledReason,
  canPrepareCampaignTemplate,
} from "./campaignOperationsSemantics.ts";

test("campaign prepare success routes to exact returned Work deep link", () => {
  assert.equal(
    buildCampaignWorkReviewHref("biz_1", "work_campaign_manual_weekly_newsletter_2026_07_09"),
    "/b/biz_1/work?workId=work_campaign_manual_weekly_newsletter_2026_07_09",
  );
  assert.equal(buildCampaignWorkReviewHref("biz_1", ""), null);
  assert.equal(buildCampaignWorkReviewHref("", "work_1"), null);
});

test("property campaign remains disabled until a BusinessSubject is selected", () => {
  assert.equal(canPrepareCampaignTemplate({ requiresSubject: true }, ""), false);
  assert.equal(campaignPrepareDisabledReason({ requiresSubject: true }, ""), "Select a property to prepare this campaign.");
  assert.equal(canPrepareCampaignTemplate({ requiresSubject: true }, "subj_123"), true);
  assert.equal(campaignPrepareDisabledReason({ requiresSubject: true }, "subj_123"), null);
  assert.equal(canPrepareCampaignTemplate({ requiresSubject: false }, ""), true);
});
