import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyTeamAvailability,
  readTeamAvailability,
  writeTeamAvailability,
  upsertMemberAvailability,
  listBookableMembers,
  defaultWeeklyAvailability,
  DEFAULT_TIMEZONE,
} from "./TeamAvailabilityStore.js";

function makeInstallation(overrides = {}) {
  return {
    id: "install_biz_2",
    businessId: "biz_2",
    specificationId: "spec_1",
    configuration: {},
    ...overrides,
  };
}

function makePlatformStore(installation) {
  return {
    async getBusinessOSInstallation() {
      return installation;
    },
    async upsertBusinessOSInstallation(row) {
      installation.configuration = row.configuration;
      return row;
    },
  };
}

test("emptyTeamAvailability and readTeamAvailability default shape", () => {
  const empty = emptyTeamAvailability();
  assert.equal(empty.timezone, DEFAULT_TIMEZONE);
  assert.deepEqual(empty.members, {});
  assert.deepEqual(readTeamAvailability(null), empty);
  assert.deepEqual(readTeamAvailability({ configuration: {} }), empty);
});

test("upsertMemberAvailability defaults weekly to Mon-Fri 9-5 when first enabling", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  const member = await upsertMemberAvailability({
    platformStore,
    installation,
    memberId: "user_1",
    displayName: "Jordan",
    actorId: "owner",
  });

  assert.deepEqual(member.weekly, defaultWeeklyAvailability());
  assert.equal(member.bookable, true);
  assert.equal(member.displayName, "Jordan");

  const state = readTeamAvailability(installation);
  assert.ok(state.members.user_1);
  assert.equal(state.members.user_1.weekly.length, 5);
});

test("upsertMemberAvailability normalizes invalid windows and merges partial patches", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  await upsertMemberAvailability({
    platformStore,
    installation,
    memberId: "user_2",
    displayName: "Alex",
    weekly: [
      { day: 1, start: "09:00", end: "13:00" },
      { day: 2, start: "10:00", end: "09:00" }, // invalid: end before start, dropped
      { day: 9, start: "09:00", end: "17:00" }, // invalid day, dropped
    ],
    bookable: true,
  });

  let state = readTeamAvailability(installation);
  assert.equal(state.members.user_2.weekly.length, 1);
  assert.equal(state.members.user_2.weekly[0].day, 1);

  // Patch bookable only — weekly should be preserved from existing member.
  await upsertMemberAvailability({
    platformStore,
    installation,
    memberId: "user_2",
    bookable: false,
  });
  state = readTeamAvailability(installation);
  assert.equal(state.members.user_2.bookable, false);
  assert.equal(state.members.user_2.weekly.length, 1);
});

test("listBookableMembers filters out non-bookable members", () => {
  const availability = {
    members: {
      a: { memberId: "a", bookable: true },
      b: { memberId: "b", bookable: false },
    },
  };
  const bookable = listBookableMembers(availability);
  assert.equal(bookable.length, 1);
  assert.equal(bookable[0].memberId, "a");
});

test("writeTeamAvailability persists onto installation.configuration.teamAvailability", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  await writeTeamAvailability({
    platformStore,
    installation,
    availability: { timezone: "America/Chicago", members: { u1: { memberId: "u1", displayName: "U1", weekly: [], bookable: true } } },
  });
  assert.ok(installation.configuration.teamAvailability);
  assert.equal(installation.configuration.teamAvailability.timezone, "America/Chicago");
});
