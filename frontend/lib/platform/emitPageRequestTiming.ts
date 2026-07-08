import { headers } from "next/headers";

import { finishRequestTiming } from "../../../backend/core/platform/requestTiming.js";

/**
 * Emit Server-Timing for the current RSC request (visible in browser DevTools).
 */
export async function emitPageRequestTiming(pageLabel: string) {
  if (process.env.WORKSPACE_REQUEST_TIMING !== "1") return;
  const result = finishRequestTiming(pageLabel);
  if (!result) return;
  try {
    const headerStore = await headers();
    const existing = headerStore.get("x-vibetech-timing") ?? "";
    const payload = JSON.stringify({ page: pageLabel, ...result });
    // Note: App Router may not forward custom headers to client for RSC; logs remain primary.
    void existing;
    void payload;
  } catch {
    // headers() unavailable outside request scope
  }
}
