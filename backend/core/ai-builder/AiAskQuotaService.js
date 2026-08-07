/**
 * Daily AI-ask quotas to cap OpenAI spend.
 * - Ask / AI builder chat: 5 per user per UTC day
 * - Automation path AI: 5 per automation (businessId + employeeId) per UTC day
 *
 * In-memory by default (single Node process). Optional platformStore persistence
 * when `consumeAiAskQuota` / `getAiAskQuota` are available.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const AI_ASK_LIMITS = Object.freeze({
  ask: 5,
  automation: 5,
  /** Soft commercial AI work credits (staging) until Stripe metering. */
  work_credit: 1000,
});

const memory = new Map();

function utcDay(nowISO = new Date().toISOString()) {
  return String(nowISO).slice(0, 10);
}

function askKey(userId, day) {
  return `ask:${String(userId)}:${day}`;
}

function automationKey(businessId, employeeId, day) {
  return `automation:${String(businessId)}:${String(employeeId)}:${day}`;
}

function workCreditKey(businessId, day) {
  return `work_credit:${String(businessId)}:${day}`;
}

function readCount(key) {
  return Number(memory.get(key) ?? 0) || 0;
}

function writeCount(key, count) {
  memory.set(key, count);
}

/**
 * @param {object} params
 * @param {"ask"|"automation"} params.scope
 * @param {string} [params.userId] - required for ask
 * @param {string} [params.businessId] - required for automation
 * @param {string} [params.employeeId] - required for automation
 * @param {number} [params.limit]
 * @param {string} [params.nowISO]
 * @param {object} [params.platformStore]
 * @param {boolean} [params.consume] - if false, peek only
 */
export async function checkAiAskQuota({
  scope,
  userId = null,
  businessId = null,
  employeeId = null,
  limit = null,
  nowISO = new Date().toISOString(),
  platformStore = null,
  consume = false,
} = {}) {
  const day = utcDay(nowISO);
  const max = Number(limit ?? AI_ASK_LIMITS[scope] ?? 5);

  let key;
  if (scope === "ask") {
    if (!userId) {
      return deepFreeze({
        ok: false,
        allowed: false,
        reason: "user_required",
        limit: max,
        used: 0,
        remaining: 0,
      });
    }
    key = askKey(userId, day);
  } else if (scope === "automation") {
    if (!businessId || !employeeId) {
      return deepFreeze({
        ok: false,
        allowed: false,
        reason: "automation_scope_required",
        limit: max,
        used: 0,
        remaining: 0,
      });
    }
    key = automationKey(businessId, employeeId, day);
  } else if (scope === "work_credit") {
    if (!businessId) {
      return deepFreeze({
        ok: false,
        allowed: false,
        reason: "business_required",
        limit: max,
        used: 0,
        remaining: 0,
      });
    }
    key = workCreditKey(businessId, day);
  } else {
    return deepFreeze({
      ok: false,
      allowed: false,
      reason: "unknown_scope",
      limit: max,
      used: 0,
      remaining: 0,
    });
  }

  let used = readCount(key);
  if (platformStore?.getAiAskQuotaUsage) {
    try {
      const remote = await platformStore.getAiAskQuotaUsage({ key });
      if (remote != null && Number.isFinite(Number(remote))) {
        used = Math.max(used, Number(remote));
        writeCount(key, used);
      }
    } catch {
      /* memory fallback */
    }
  }

  const remaining = Math.max(0, max - used);
  if (used >= max) {
    return deepFreeze({
      ok: true,
      allowed: false,
      reason: "quota_exceeded",
      scope,
      day,
      limit: max,
      used,
      remaining: 0,
      message: scope === "ask"
        ? `You've used your ${max} Ask messages for today. Come back tomorrow, or edit without AI.`
        : `You've used your ${max} AI edits for this automation today. Try again tomorrow.`,
    });
  }

  if (consume) {
    used += 1;
    writeCount(key, used);
    if (platformStore?.incrementAiAskQuotaUsage) {
      try {
        await platformStore.incrementAiAskQuotaUsage({ key, day, scope, userId, businessId, employeeId });
      } catch {
        /* memory already updated */
      }
    }
    try {
      const { recordUsageSafe } = await import("../platform/billing/UsageMetering.js");
      recordUsageSafe({
        businessId: businessId || userId || "platform",
        meterId: "ai_work_credits",
        quantity: 1,
        platformStore,
      });
    } catch {
      /* non-blocking */
    }
  }

  return deepFreeze({
    ok: true,
    allowed: true,
    scope,
    day,
    limit: max,
    used: consume ? used : used,
    remaining: Math.max(0, max - used),
  });
}

/** Test helper */
export function resetAiAskQuotaForTests() {
  memory.clear();
}
