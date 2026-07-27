/**
 * Commercial usage meter definitions (Phase 5 scaffolding).
 * Ask quota remains the live spend guard; these meters are for billing entitlement wiring.
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

/**
 * In-memory usage ledger for staging demos until durable billing tables ship.
 */
const memory = new Map();

function monthKey(nowISO = new Date().toISOString()) {
  return String(nowISO).slice(0, 7);
}

function usageKey(businessId, meterId, month) {
  return `${String(businessId)}:${String(meterId)}:${month}`;
}

export function peekUsage({
  businessId,
  meterId,
  nowISO = new Date().toISOString(),
} = {}) {
  const meter = USAGE_METERS[meterId];
  if (!meter || !businessId) {
    return deepFreeze({ ok: false, reason: "invalid_meter" });
  }
  const month = monthKey(nowISO);
  const key = usageKey(businessId, meterId, month);
  const used = Number(memory.get(key) ?? 0) || 0;
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

export function recordUsage({
  businessId,
  meterId,
  quantity = 1,
  nowISO = new Date().toISOString(),
} = {}) {
  const peek = peekUsage({ businessId, meterId, nowISO });
  if (!peek.ok) return peek;
  const key = usageKey(businessId, meterId, peek.month);
  const next = (Number(memory.get(key) ?? 0) || 0) + Math.max(0, Number(quantity) || 0);
  memory.set(key, next);
  return peekUsage({ businessId, meterId, nowISO });
}

export function listUsageMeters() {
  return deepFreeze(Object.values(USAGE_METERS));
}
