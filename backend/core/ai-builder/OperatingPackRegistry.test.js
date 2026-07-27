import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getOperatingPack,
  listOperatingPacks,
  operatingPackContract,
  getPackDefaultRoles,
  resolveOperatingIndustry,
} from "./OperatingPackRegistry.js";

test("Dental and Sports are separate operating packs — never one blended catalog", () => {
  assert.deepEqual(listOperatingPacks().map((pack) => pack.industry).sort(), ["dental", "sports"]);
  assert.equal(getOperatingPack("dental")?.packId, "dental_v1");
  assert.equal(getOperatingPack("sports")?.packId, "youth_sports_v1");
  assert.equal(getOperatingPack("property_management"), null);
  assert.equal(getOperatingPack("sports")?.lifecycle, "beachhead");
  assert.equal(getOperatingPack("dental")?.marketingReady, false);

  const sportsRoles = getPackDefaultRoles("sports");
  const dentalRoles = getPackDefaultRoles("dental");
  assert.equal(sportsRoles.length, 4);
  assert.equal(dentalRoles.length, 2);
  assert.equal(getOperatingPack("sports")?.aiRoles?.length, 4);
  assert.equal(getOperatingPack("dental")?.aiRoles?.length, 2);

  const sportsIds = new Set(sportsRoles.map((role) => role.roleId));
  const dentalIds = new Set(dentalRoles.map((role) => role.roleId));
  for (const roleId of sportsIds) assert.equal(dentalIds.has(roleId), false);
  for (const roleId of dentalIds) assert.equal(sportsIds.has(roleId), false);

  assert.ok(sportsRoles.every((role) => role.industry === "sports" && role.packId === "youth_sports_v1"));
  assert.ok(dentalRoles.every((role) => role.industry === "dental" && role.packId === "dental_v1"));
  assert.ok(sportsRoles.every((role) => role.archetypeId && role.roleId));
  assert.ok(!sportsRoles.some((role) => /dental|patient|recall/i.test(role.label)));
  assert.ok(!dentalRoles.some((role) => /club|player|family|practice plan/i.test(role.label)));
});

test("industry aliases resolve hockey and dentist wording to one pack each", () => {
  assert.equal(resolveOperatingIndustry({ industry: "hockey" }), "sports");
  assert.equal(resolveOperatingIndustry({ businessName: "Top Gun Hockey Club" }), "sports");
  assert.equal(resolveOperatingIndustry({ industry: "dentistry" }), "dental");
  assert.equal(
    resolveOperatingIndustry({ operatingPackId: "youth_sports_v1", businessName: "Smile Dental" }),
    "sports",
  );
  assert.equal(
    resolveOperatingIndustry({ operatingPackId: "dental_v1", businessName: "Top Gun Hockey Club" }),
    "dental",
  );
});

test("every operating pack inherits the optional growth-channel contract", () => {
  const capabilityIds = operatingPackContract("dental").sharedCapabilities.map((entry) => entry.capabilityId);
  for (const capabilityId of ["google_ads", "seo", "meta_ads"]) {
    assert.ok(capabilityIds.includes(capabilityId), `missing ${capabilityId}`);
  }
  const sportsCap = operatingPackContract("sports").sharedCapabilities.map((entry) => entry.capabilityId);
  assert.deepEqual(capabilityIds.sort(), sportsCap.sort());
});
