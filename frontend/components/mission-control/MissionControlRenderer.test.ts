import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { composeMissionControlExperience } from "../../../backend/core/mission-control/composeMissionControlExperience.js";

const here = path.dirname(fileURLToPath(import.meta.url));

test("Mission Control Home view model includes composeOperatingHomeSupervision", () => {
  const vm = composeMissionControlExperience({
    missionControlViewModel: {
      hero: { businessName: "Harbor", headline: "Harbor is operating", summary: "Steady morning" },
      needsYourAttention: [{ id: "a1", title: "Approve vendor quote", reason: "Waiting on owner" }],
      digitalWorkforce: { digitalEmployees: [] },
      handledByVibeTech: [],
      businessEpisodeFeed: [],
      businessActivity: [],
      pulse: [{ id: "open_work", label: "Open work", value: 3 }],
      businessControlStatus: { label: "Under control", reason: "No blockers", tone: "success" },
    },
    ownerFirstName: "Harbor",
    businessId: "biz_1",
  });

  assert.equal(vm.supervision?.available, true);
  assert.equal(vm.experience?.supervision?.available, true);
  assert.ok(vm.supervision.sectionOrder.indexOf("needsDecision") < vm.supervision.sectionOrder.indexOf("businessOverview"));
  assert.equal(vm.supervision.needsDecision.items[0].title, "Approve vendor quote");
  assert.match(vm.supervision.greeting.headline, /Harbor/);
});

test("MissionControlRenderer mounts OperatingHomeExperience for mission_control variant", () => {
  const source = readFileSync(path.join(here, "MissionControlRenderer.tsx"), "utf8");
  assert.match(source, /OperatingHomeExperience/);
  assert.match(source, /variant === "for_you"/);
  assert.ok(source.includes("<OperatingHomeExperience"));
});

test("canonical Home splits pre-install Ask VIBETech from post-install operating Home", () => {
  const page = readFileSync(
    path.join(here, "../../app/b/[businessId]/home/page.tsx"),
    "utf8",
  );
  assert.match(page, /BusinessOnboardingHome/);
  assert.match(page, /MissionControlRenderer/);
  assert.match(page, /Talk to VIBETech|hasInstalledOs/);
  assert.ok(!page.includes("PortalHome"));
  assert.ok(!page.includes("ExecutiveHomeLayout"));
  assert.ok(!page.includes("EmptyBusinessHome"));
  assert.ok(!page.includes("FirstLoginBriefingBanner"));
  assert.ok(!page.includes("SetupChecklistBanner"));
});

test("operating Home is mockup-density dashboard from live supervision, not industry CRM hardcodes", () => {
  const home = readFileSync(
    path.join(here, "../operating/OperatingHomeExperience.tsx"),
    "utf8",
  );
  assert.ok(!home.includes("AskVibeTechComposer"));
  assert.ok(!home.includes("AskCard"));
  assert.match(home, /Needs you/);
  assert.match(home, /AI team/);
  assert.match(home, /MetricStrip/);
  assert.match(home, /DashGrid/);
  assert.match(home, /What changed/);
  assert.match(home, /buildMetricCards/);
  assert.match(home, /Same queue as Needs Attention/);
  assert.match(home, /teammateActionLabel/);
  assert.match(home, /metricHrefForLabel/);
  assert.ok(!home.includes("ownerActionOutcomes"));
  assert.ok(!home.includes("needsOwnerAction"));
  assert.ok(!home.includes("estimateProgress"));
  assert.ok(!home.includes("Business memory"));
  assert.ok(!home.includes("Operating pulse"));
  assert.ok(!home.includes("DemoStoryMode"));
  assert.ok(!home.includes("leasing"));
  assert.ok(!home.includes("maintenance"));
  assert.ok(!home.includes("commission"));
  assert.ok(!home.includes("Showings"));
  assert.ok(!home.includes("New Leads"));
  assert.ok(!home.includes("Zillow"));
});
