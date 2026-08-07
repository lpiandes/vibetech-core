/**
 * Commercial usage meters — Settings billing panel + overage math.
 * Uses in-memory ledger by default; prefers platformStore durable methods when present.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const USAGE_METERS = deepFreeze({
  voice_minutes_inbound: {
    id: "voice_minutes_inbound",
    label: "Voice minutes (inbound)",
    unit: "minute",
    includedDefault: 0,
    overageUsd: 0.4,
  },
  voice_minutes_outbound: {
    id: "voice_minutes_outbound",
    label: "Voice minutes (outbound)",
    unit: "minute",
    includedDefault: 0,
    overageUsd: 0.45,
  },
  sms_segments: {
    id: "sms_segments",
    label: "Text message segments",
    unit: "segment",
    includedDefault: 1000,
    overageUsd: 0.035,
  },
  emails: {
    id: "emails",
    label: "Emails",
    unit: "email",
    includedDefault: 5000,
    overageUsd: 0.004,
  },
  ai_work_credits: {
    id: "ai_work_credits",
    label: "AI conversations / work credits",
    unit: "credit",
    includedDefault: 1000,
    overageUsd: 0.2,
  },
  storage_gb: {
    id: "storage_gb",
    label: "Data storage",
    unit: "gb",
    includedDefault: 10,
    overageUsd: 7,
  },
  staff_users: {
    id: "staff_users",
    label: "Staff users",
    unit: "user",
    includedDefault: 10,
    overageUsd: 25,
  },
  api_wallet_usd: {
    id: "api_wallet_usd",
    label: "API / provider wallet",
    unit: "usd",
    includedDefault: 150,
    managementMargin: 0.25,
  },
});

const memory = new Map();

function monthKey(nowISO = new Date().toISOString()) {
  return String(nowISO).slice(0, 7);
}

function usageKey(businessId, meterId, month) {
  return `${String(businessId)}:${String(meterId)}:${month}`;
}

function buildPeek({ businessId, meterId, month, used }) {
  const meter = USAGE_METERS[meterId];
  const included = Number(meter.includedDefault ?? 0);
  const remaining = Math.max(0, included - used);
  const overageUnits = Math.max(0, used - included);
  const overageUsd = overageUnits * Number(meter.overageUsd ?? 0);
  return deepFreeze({
    ok: true,
    meterId,
    month,
    used,
    included,
    remaining,
    overageUnits,
    overageUsd,
  });
}

export function peekUsage({
  businessId,
  meterId,
  nowISO = new Date().toISOString(),
  platformStore = null,
} = {}) {
  const meter = USAGE_METERS[meterId];
  if (!meter || !businessId) {
    return deepFreeze({ ok: false, reason: "invalid_meter" });
  }
  const month = monthKey(nowISO);
  if (platformStore?.getUsageMeter) {
    try {
      const remote = platformStore.getUsageMeter({ businessId, meterId, month });
      if (remote && typeof remote.then !== "function" && Number.isFinite(Number(remote.used))) {
        return buildPeek({ businessId, meterId, month, used: Number(remote.used) });
      }
    } catch {
      /* fall through to memory */
    }
  }
  const key = usageKey(businessId, meterId, month);
  const used = Number(memory.get(key) ?? 0) || 0;
  return buildPeek({ businessId, meterId, month, used });
}

export function recordUsage({
  businessId,
  meterId,
  quantity = 1,
  nowISO = new Date().toISOString(),
  platformStore = null,
} = {}) {
  const meter = USAGE_METERS[meterId];
  if (!meter || !businessId) {
    return deepFreeze({ ok: false, reason: "invalid_meter" });
  }
  const month = monthKey(nowISO);
  const qty = Math.max(0, Number(quantity) || 0);

  if (platformStore?.incrementUsageMeter) {
    try {
      const remote = platformStore.incrementUsageMeter({ businessId, meterId, month, quantity: qty });
      if (remote && typeof remote.then !== "function" && Number.isFinite(Number(remote.used))) {
        return buildPeek({ businessId, meterId, month, used: Number(remote.used) });
      }
    } catch {
      /* fall through */
    }
  }

  const key = usageKey(businessId, meterId, month);
  const next = (Number(memory.get(key) ?? 0) || 0) + qty;
  memory.set(key, next);
  return peekUsage({ businessId, meterId, nowISO, platformStore: null });
}

/** Fire-and-forget usage record — never throws into product paths. */
export function recordUsageSafe(input = {}) {
  try {
    const result = recordUsage(input);
    // Best-effort durable write when a platformStore with installation APIs is provided.
    const store = input.platformStore;
    if (store?.getBusinessOSInstallation && store?.upsertBusinessOSInstallation && result?.ok) {
      void import("./InstallationUsageLedger.js")
        .then(({ recordUsageOnInstallation }) => recordUsageOnInstallation({
          platformStore: store,
          businessId: input.businessId,
          meterId: input.meterId,
          quantity: input.quantity ?? 1,
          nowISO: input.nowISO,
          actorId: "usage_meter_safe",
        }))
        .catch(() => null);
    }
    return result;
  } catch {
    return deepFreeze({ ok: false, reason: "usage_record_failed" });
  }
}

export function listUsageMeters() {
  return deepFreeze(Object.values(USAGE_METERS));
}

export function resetUsageMetersForTests() {
  memory.clear();
}
