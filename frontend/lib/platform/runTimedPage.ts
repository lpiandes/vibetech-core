import { headers } from "next/headers";

import { runWithRequestTiming, finishRequestTiming, markRequestTiming } from "../../../backend/core/platform/requestTiming.js";

/**
 * Wrap a server page handler with request-scoped timing marks.
 */
export async function runTimedPage<T>(pageName: string, fn: () => Promise<T>): Promise<T> {
  return runWithRequestTiming(pageName, async () => {
    if (process.env.WORKSPACE_REQUEST_TIMING === "1") {
      try {
        const headerStore = await headers();
        const reqStart = Number(headerStore.get("x-vibetech-req-start") ?? 0);
        const mwMs = Number(headerStore.get("x-vibetech-middleware-ms") ?? 0);
        if (reqStart > 0) {
          markRequestTiming("MW_TO_PAGE", { gapMs: Date.now() - reqStart, middlewareMs: mwMs });
        }
      } catch {
        // headers() unavailable outside request scope
      }
    }
    try {
      return await fn();
    } finally {
      finishRequestTiming("PAGE_TOTAL");
    }
  });
}
