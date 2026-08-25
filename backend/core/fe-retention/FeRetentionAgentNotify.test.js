import test from "node:test";
import assert from "node:assert/strict";
import {
  agentNotifyFromOnboardingProfile,
  seedFeAgentNotifySettings,
  resolveFeAgentNotifyContacts,
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
