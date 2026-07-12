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

test("canonical Home page no longer mounts PortalHome or ExecutiveHomeLayout", () => {
  const page = readFileSync(
    path.join(here, "../../app/b/[businessId]/home/page.tsx"),
    "utf8",
  );
  assert.match(page, /MissionControlRenderer/);
  assert.ok(!page.includes("PortalHome"));
  assert.ok(!page.includes("ExecutiveHomeLayout"));
  assert.match(page, /showMissionControl = Boolean\(executive\.showOperatingDashboard\)/);
});
