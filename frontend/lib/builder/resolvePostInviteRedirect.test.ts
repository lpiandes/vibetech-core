import assert from "node:assert/strict";
import { test } from "node:test";

import { resolvePostInviteRedirect } from "./resolvePostInviteRedirect.ts";

test("owner without installed OS routes to Architect", async () => {
  const result = await resolvePostInviteRedirect({
    platformStore: {
      getBusinessOSInstallation: async () => null,
    },
    getAiBuilderService: () => ({
      listSessions: async () => ({ sessions: [] }),
      startSession: async () => ({ session: { sessionId: "abs_new" } }),
    }),
    businessId: "biz_1",
    membershipRole: "OWNER",
    actorUserId: "user_1",
    businessName: "Acme",
  });
  assert.equal(result.redirectTo, "/architect/abs_new");
  assert.equal(result.architectSessionId, "abs_new");
});

test("owner with installed OS routes home", async () => {
  const result = await resolvePostInviteRedirect({
    platformStore: {
      getBusinessOSInstallation: async () => ({ status: "installed" }),
    },
    getAiBuilderService: () => ({
      listSessions: async () => ({ sessions: [] }),
      startSession: async () => {
        throw new Error("should not start");
      },
    }),
    businessId: "biz_1",
    membershipRole: "OWNER",
    actorUserId: "user_1",
  });
  assert.equal(result.redirectTo, "/b/biz_1/home");
});

test("employee always routes home", async () => {
  const result = await resolvePostInviteRedirect({
    platformStore: {
      getBusinessOSInstallation: async () => null,
    },
    getAiBuilderService: () => ({
      startSession: async () => {
        throw new Error("should not start");
      },
    }),
    businessId: "biz_1",
    membershipRole: "EMPLOYEE",
    actorUserId: "user_2",
  });
  assert.equal(result.redirectTo, "/b/biz_1/home");
});
