import test from "node:test";
import assert from "node:assert/strict";
import {
  agentNotifyFromOnboardingProfile,
  seedFeAgentNotifySettings,
  resolveFeAgentNotifyContacts,
  resolveFeBookAgentDisplayName,
} from "./FeRetentionAgentNotify.js";
import { emptyFeRetentionState } from "./FeRetentionStore.js";
import { writeFeRetentionOnboarding } from "./FeRetentionOnboarding.js";

test("agentNotifyFromOnboardingProfile reads A2P notify fields", () => {
  const row = agentNotifyFromOnboardingProfile({
    notifyEmail: "kpiandes@senioradvisorsllc.com",
    contactPhone: "6038182383",
  });
  assert.equal(row.agentNotifyEmail, "kpiandes@senioradvisorsllc.com");
  assert.equal(row.agentNotifyPhone, "+16038182383");
});

test("seedFeAgentNotifySettings copies profile notify into blank settings", () => {
  const pkg = writeFeRetentionOnboarding({}, {
    profile: {
      notifyEmail: "owner@agency.com",
      contactPhone: "+15551234567",
    },
  });
  const seeded = seedFeAgentNotifySettings(emptyFeRetentionState(), pkg);
  assert.equal(seeded.seeded, true);
  assert.equal(seeded.state.settings.agentNotifyEmail, "owner@agency.com");
  assert.equal(seeded.state.settings.agentNotifyPhone, "+15551234567");
});

test("seedFeAgentNotifySettings overwrites stale notify email until agency customizes", () => {
  const pkg = writeFeRetentionOnboarding({}, {
    profile: {
      notifyEmail: "kpiandes@senioradvisorsllc.com",
      contactPhone: "+16038182383",
    },
  });
  const state = {
    ...emptyFeRetentionState(),
    settings: {
      ...emptyFeRetentionState().settings,
      agentNotifyEmail: "leopiandes@vtechdevelopment.com",
      agentNotifyCustomized: false,
    },
  };
  const seeded = seedFeAgentNotifySettings(state, pkg);
  assert.equal(seeded.seeded, true);
  assert.equal(seeded.state.settings.agentNotifyEmail, "kpiandes@senioradvisorsllc.com");
});

test("seedFeAgentNotifySettings respects agency customization", () => {
  const pkg = writeFeRetentionOnboarding({}, {
    profile: { notifyEmail: "owner@agency.com" },
  });
  const state = {
    ...emptyFeRetentionState(),
    settings: {
      ...emptyFeRetentionState().settings,
      agentNotifyEmail: "custom@agency.com",
      agentNotifyCustomized: true,
    },
  };
  const seeded = seedFeAgentNotifySettings(state, pkg);
  assert.equal(seeded.seeded, false);
  assert.equal(seeded.state.settings.agentNotifyEmail, "custom@agency.com");
});

test("resolveFeBookAgentDisplayName prefers A2P contact name", () => {
  const name = resolveFeBookAgentDisplayName({
    packageConfiguration: writeFeRetentionOnboarding({}, {
      profile: { contactFirstName: "Kerry", contactLastName: "Piandes" },
    }),
  });
  assert.equal(name, "Kerry Piandes");
});

test("resolveFeAgentNotifyContacts uses book owner email before session admin", async () => {
  const store = {
    async getOwnerMembership(businessId) {
      assert.equal(businessId, "biz_kerry");
      return { email: "kpiandes@senioradvisorsllc.com" };
    },
  };
  const resolved = await resolveFeAgentNotifyContacts({
    platformStore: store,
    businessId: "biz_kerry",
    business: { packageConfiguration: {} },
    state: emptyFeRetentionState(),
  });
  assert.equal(resolved.email, "kpiandes@senioradvisorsllc.com");
});
