import { computeRequestMetrics } from "./RequestMetrics.js";

export function buildDefaultRequestSeed({ nowISO } = {}) {
  const safeNowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  const requests = [];
  const metrics = computeRequestMetrics({ requests, nowISO: safeNowISO });
  return { requests, metrics };
}

