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

test("owner with a failed builder session resumes it on the install/recovery trail", async () => {
  const result = await resolvePostInviteRedirect({
    platformStore: {
      getBusinessOSInstallation: async () => null,
    },
    getAiBuilderService: () => ({
      listSessions: async () => ({
        sessions: [{ sessionId: "abs_failed", stageKey: "failed", updatedAt: "2026-01-02T00:00:00.000Z" }],
      }),
      startSession: async () => {
        throw new Error("should not start a new session when one is resumable");
      },
    }),
    businessId: "biz_1",
    membershipRole: "OWNER",
    actorUserId: "user_1",
  });
  assert.equal(result.redirectTo, "/architect/abs_failed/install");
  assert.equal(result.architectSessionId, "abs_failed");
});

test("owner with an installing builder session resumes it on the install/recovery trail", async () => {
  const result = await resolvePostInviteRedirect({
    platformStore: {
      getBusinessOSInstallation: async () => null,
    },
    getAiBuilderService: () => ({
      listSessions: async () => ({
        sessions: [{ sessionId: "abs_installing", stageKey: "installing", updatedAt: "2026-01-02T00:00:00.000Z" }],
      }),
      startSession: async () => {
        throw new Error("should not start");
      },
    }),
    businessId: "biz_1",
    membershipRole: "OWNER",
    actorUserId: "user_1",
  });
  assert.equal(result.redirectTo, "/architect/abs_installing/install");
});

test("owner with a session claiming installed but no canonical OS resumes on install (self-heal)", async () => {
  const result = await resolvePostInviteRedirect({
    platformStore: {
      // Canonical Business OS is missing even though the builder session says installed —
      // this is the durable-installed/no-canonical drift the install page self-heals.
      getBusinessOSInstallation: async () => null,
    },
    getAiBuilderService: () => ({
      listSessions: async () => ({
        sessions: [{ sessionId: "abs_stale_installed", stageKey: "installed", updatedAt: "2026-01-02T00:00:00.000Z" }],
      }),
      startSession: async () => {
        throw new Error("should not start a new session — that loses the durable session pointer");
      },
    }),
    businessId: "biz_1",
    membershipRole: "OWNER",
    actorUserId: "user_1",
  });
  assert.equal(result.redirectTo, "/architect/abs_stale_installed/install");
});

test("owner with a mid-discovery session resumes discovery, not install", async () => {
  const result = await resolvePostInviteRedirect({
    platformStore: {
      getBusinessOSInstallation: async () => null,
    },
    getAiBuilderService: () => ({
      listSessions: async () => ({
        sessions: [{ sessionId: "abs_interviewing", stageKey: "interviewing", updatedAt: "2026-01-02T00:00:00.000Z" }],
      }),
      startSession: async () => {
        throw new Error("should not start");
      },
    }),
    businessId: "biz_1",
    membershipRole: "OWNER",
    actorUserId: "user_1",
  });
  assert.equal(result.redirectTo, "/architect/abs_interviewing");
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
