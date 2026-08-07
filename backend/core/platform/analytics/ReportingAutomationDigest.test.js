import test from "node:test";
import assert from "node:assert/strict";

import {
  scheduleDigest,
  presentDigestNow,
  readDigestSchedule,
} from "./ReportingAutomationDigest.js";
import { emptyCrmState, upsertContact, upsertPipelineCard } from "../../crm/CrmStore.js";

function makeInstallation(overrides = {}) {
  return {
    id: "install_rep_1",
    businessId: "biz_rep_1",
    specificationId: "spec_1",
    configuration: { crm: emptyCrmState() },
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

test("readDigestSchedule defaults to disabled weekly", () => {
  const schedule = readDigestSchedule(null);
  assert.equal(schedule.enabled, false);
  assert.equal(schedule.frequency, "weekly");
});

test("scheduleDigest persists enabled/frequency/hourUtc on the installation", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  const schedule = await scheduleDigest({
    platformStore,
    installation,
    enabled: true,
    frequency: "daily",
    hourUtc: 9,
    actorId: "owner_1",
  });

  assert.equal(schedule.enabled, true);
  assert.equal(schedule.frequency, "daily");
  assert.equal(schedule.hourUtc, 9);
  assert.equal(readDigestSchedule(installation).enabled, true);
});

test("presentDigestNow composes a real digest from live pipeline state and stamps lastPresentedAt", async () => {
  let crm = emptyCrmState();
  crm = upsertContact(crm, { id: "contact_1", name: "Alex Lead", email: "alex@example.com" });
  const pipe = crm.pipelines[0];
  crm = upsertPipelineCard(crm, {
    pipelineId: pipe.id,
    card: { title: "Open deal", stageId: pipe.stages[0].id, contactId: "contact_1", value: 400 },
  }).crm;

  const installation = makeInstallation({ configuration: { crm } });
  const platformStore = makePlatformStore(installation);

  const { schedule, digest } = await presentDigestNow({ platformStore, installation, businessId: "biz_rep_1" });

  assert.ok(digest.generatedAt);
  assert.match(digest.headline, /1 open opportunity/);
  const pipelineSection = digest.sections.find((s) => s.id === "pipeline");
  assert.ok(pipelineSection.stats.some((s) => s.label === "Open opportunities" && s.value === 1));
  assert.equal(schedule.lastPresentedAt, digest.generatedAt);
  assert.equal(readDigestSchedule(installation).lastPresentedAt, digest.generatedAt);
});
