import { performance } from "node:perf_hooks";

const enabled = () =>
  process.env.WORKSPACE_REQUEST_TIMING === "1" || process.env.NODE_ENV === "test";

/**
 * Collect structured server-path timings for workspace requests.
 * Logs lines like: WORKSPACE_TIMING SNAPSHOT_LOAD 27ms
 */
export function createWorkspaceRequestTimer(scope = "workspace") {
  const marks = [];
  let totalStart = performance.now();

  return {
    mark(label) {
      const ms = Math.round(performance.now() - totalStart);
      marks.push({ label, ms });
      if (enabled()) {
        console.log(`WORKSPACE_TIMING ${label} ${ms}ms`);
      }
      return ms;
    },
    async time(label, fn) {
      const start = performance.now();
      const result = await fn();
      const delta = Math.round(performance.now() - start);
      marks.push({ label, ms: delta });
      if (enabled()) {
        console.log(`WORKSPACE_TIMING ${label} ${delta}ms`);
      }
      return result;
    },
    finish(extraLabel = "TOTAL") {
      const total = Math.round(performance.now() - totalStart);
      marks.push({ label: extraLabel, ms: total });
      if (enabled()) {
        console.log(`WORKSPACE_TIMING ${extraLabel} ${total}ms`);
      }
      return { marks, totalMs: total };
    },
    getMarks() {
      return marks;
    },
    scope,
  };
}
