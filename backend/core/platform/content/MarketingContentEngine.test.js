import test from "node:test";
import assert from "node:assert/strict";

import {
  fromBrief,
  listJobs,
  approveMarketingContentJob,
  renderDraftsFromBrief,
  readMarketingContentState,
} from "./MarketingContentEngine.js";

function makeInstallation(overrides = {}) {
  return {
    id: "install_mkt_1",
    businessId: "biz_mkt_1",
    specificationId: "spec_1",
    configuration: {},
    ...overrides,
  };
}

function makePlatformStore(installationRef) {
  return {
    async upsertBusinessOSInstallation(row) {
      installationRef.configuration = row.configuration;
      installationRef.history = row.history;
      return row;
    },
    async getBusinessOSInstallation() {
      return installationRef;
    },
  };
}

test("renderDraftsFromBrief builds email + sms + social from templates without an LLM", () => {
  const drafts = renderDraftsFromBrief({
    businessName: "Acme Roofing",
    headline: "Fall Roof Inspection Special",
    offer: "Free inspection with any repair booked this month",
    audience: "past customers",
    cta: "Call us to book your slot.",
  });
  assert.match(drafts.email.subject, /Fall Roof Inspection Special/);
  assert.match(drafts.email.body, /Free inspection/);
  assert.ok(drafts.sms.body.length <= 320);
  assert.match(drafts.sms.body, /Acme Roofing/);
  assert.ok(drafts.social.body.length > 0);
});

test("fromBrief persists a job with all three channel drafts", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  const result = await fromBrief({
    platformStore,
    installation,
    brief: { businessName: "Acme Roofing", headline: "Spring Sale", offer: "10% off gutters" },
    actorId: "owner_1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.job.status, "draft");
  assert.ok(result.job.drafts.email.subject);
  assert.ok(result.job.drafts.sms.body);
  assert.ok(result.job.drafts.social.body);
  assert.equal(readMarketingContentState(installation).jobs.length, 1);
  assert.deepEqual(listJobs(installation).map((j) => j.id), [result.job.id]);
});

test("fromBrief requires a headline or offer", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  await assert.rejects(
    () => fromBrief({ platformStore, installation, brief: { businessName: "Acme" } }),
    /brief.headline or brief.offer is required/,
  );
});

test("approveMarketingContentJob pushes email + sms drafts into the shared owner-approval queue", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  const created = await fromBrief({
    platformStore,
    installation,
    brief: { businessName: "Acme Roofing", headline: "Spring Sale", offer: "10% off gutters" },
  });

  const approved = await approveMarketingContentJob({
    platformStore,
    installation,
    jobId: created.job.id,
    channels: ["email", "sms"],
    actorId: "owner_1",
  });

  assert.equal(approved.ok, true);
  assert.equal(approved.job.channelStatus.email, "pending_approval");
  assert.equal(approved.job.channelStatus.sms, "pending_approval");
  assert.equal(approved.job.channelStatus.social, "draft");
  assert.equal(approved.job.pendingDecisionDraftIds.length, 2);

  const pendingDrafts = installation.configuration.pendingDecisionDrafts ?? [];
  assert.equal(pendingDrafts.length, 2);
  assert.ok(pendingDrafts.every((d) => d.status === "pending_approval"));
  assert.ok(pendingDrafts.some((d) => d.channel === "email"));
  assert.ok(pendingDrafts.some((d) => d.channel === "sms"));
});

test("approveMarketingContentJob returns an error for an unknown job id", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  const result = await approveMarketingContentJob({ platformStore, installation, jobId: "nope" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "job_not_found");
});
