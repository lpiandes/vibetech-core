import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`RequestMetrics: ${message}`);
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function toISOTimeMillis(iso, name) {
  const t = new Date(String(iso)).getTime();
  if (!Number.isFinite(t)) fail(`${name} invalid ISO time.`);
  return t;
}

function roundTo(n, decimals = 2) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

export function computeRequestMetrics({ requests, nowISO } = {}) {
  if (!Array.isArray(requests)) fail("requests must be array.");
  if (!nowISO || typeof nowISO !== "string") fail("nowISO must be ISO string.");

  const nowMs = toISOTimeMillis(nowISO, "nowISO");

  const totalRequests = requests.length;
  const newRequests = requests.filter((r) => String(r?.status) === "received").length;
  const qualifiedRequests = requests.filter((r) => String(r?.status) === "qualified").length;
  const convertedRequests = requests.filter((r) => String(r?.status) === "converted").length;
  const closedRequests = requests.filter((r) => String(r?.status) === "closed").length;

  const dayMs = 24 * 60 * 60 * 1000;
  const ageDays =
    totalRequests === 0
      ? 0
      : requests.reduce((acc, r) => {
          const receivedMs = toISOTimeMillis(r?.receivedAt, "request.receivedAt");
          return acc + (nowMs - receivedMs) / dayMs;
        }, 0) / totalRequests;

  const metrics = {
    totalRequests,
    newRequests,
    qualifiedRequests,
    convertedRequests,
    closedRequests,
    averageAgeDays: roundTo(ageDays, 2),
  };

  for (const k of Object.keys(metrics)) {
    if (!isFiniteNumber(metrics[k])) fail(`metrics.${k} must be finite number.`);
  }

  return deepFreeze(metrics);
}

