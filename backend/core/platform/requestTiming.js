import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

const storage = new AsyncLocalStorage();

function enabled() {
  return process.env.WORKSPACE_REQUEST_TIMING === "1" || process.env.NODE_ENV === "test";
}

export function runWithRequestTiming(route, fn) {
  const ctx = {
    route: String(route ?? "unknown"),
    startedAt: performance.now(),
    marks: [],
  };
  return storage.run(ctx, fn);
}

export function getRequestTimingContext() {
  return storage.getStore() ?? null;
}

export function markRequestTiming(label, extra) {
  const ctx = storage.getStore();
  if (!ctx) return;
  const ms = Math.round(performance.now() - ctx.startedAt);
  const entry = { label: String(label), ms, ...(extra ? { extra } : {}) };
  ctx.marks.push(entry);
  if (enabled()) {
    console.log(`REQUEST_TIMING ${ctx.route} ${entry.label} ${entry.ms}ms`);
  }
}

export async function timeRequestStage(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ctx = storage.getStore();
  const delta = Math.round(performance.now() - start);
  const cumulative = ctx ? Math.round(performance.now() - ctx.startedAt) : delta;
  if (ctx) {
    ctx.marks.push({ label: String(label), ms: cumulative, deltaMs: delta });
  }
  if (enabled()) {
    const route = ctx?.route ?? "unknown";
    console.log(`REQUEST_TIMING ${route} ${label} ${cumulative}ms (stage ${delta}ms)`);
  }
  return result;
}

export function finishRequestTiming(extraLabel = "TOTAL") {
  const ctx = storage.getStore();
  if (!ctx) return null;
  const total = Math.round(performance.now() - ctx.startedAt);
  ctx.marks.push({ label: extraLabel, ms: total });
  if (enabled()) {
    console.log(`REQUEST_TIMING ${ctx.route} ${extraLabel} ${total}ms`);
  }
  return { route: ctx.route, marks: ctx.marks, totalMs: total };
}

export function serializeRequestTimingHeader() {
  const ctx = storage.getStore();
  if (!ctx?.marks.length) return "";
  return ctx.marks.map((m) => `${m.label};dur=${m.deltaMs ?? m.ms}`).join(", ");
}
