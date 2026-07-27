/**
 * Run sports/dental golden paths against an injected job queue (Postgres in prod).
 * Keeps in-memory defaults for unit tests; live API passes PostgresPlatformJobQueue.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { runSportsGoldenPath } from "./SportsGoldenPath.js";
import { runDentalGoldenPath } from "./DentalGoldenPath.js";
import {
  DurableWorkflowExecutor,
  InMemoryPlatformJobQueue,
  JOB_TYPES,
} from "../jobs/PlatformJobQueue.js";
import { isPropertyManagementWorkspace } from "../vertical/SurfaceInventory.js";

/**
 * @param {{
 *   vertical: "sports"|"dental",
 *   businessId: string,
 *   queue?: any,
 *   outboundApproved?: boolean,
 *   workspaceGate?: object,
 *   nowISO?: string,
 * }} input
 */
export async function runVerticalGoldenPathLive({
  vertical,
  businessId,
  queue = null,
  outboundApproved = true,
  workspaceGate = {},
  nowISO = new Date().toISOString(),
} = {}) {
  const v = String(vertical ?? "").toLowerCase();
  if (v !== "sports" && v !== "dental") {
    throw new Error(`Unsupported golden path vertical: ${vertical}`);
  }

  // Quarantine: sports/dental partners must never run as PM workspaces.
  if (isPropertyManagementWorkspace(workspaceGate)) {
    throw new Error("PM workspace cannot run sports/dental golden paths");
  }

  const jobQueue = queue ?? new InMemoryPlatformJobQueue({ nowISO: () => nowISO });
  const executor = new DurableWorkflowExecutor({
    queue: jobQueue,
    nowISO: () => nowISO,
    sendOutbound: async () => undefined,
  });

  // Seed a durable golden-path job so the worker can drain related work in production.
  const seed = await jobQueue.enqueue({
    businessId,
    jobType: JOB_TYPES.GOLDEN_PATH_STEP,
    idempotencyKey: `golden:${v}:${businessId}:${nowISO.slice(0, 13)}`,
    payload: { vertical: v, phase: "started" },
  });

  const pathResult =
    v === "sports"
      ? await runSportsGoldenPath({
          businessId,
          nowISO,
          outboundApproved,
          queue: jobQueue,
          executor,
        })
      : await runDentalGoldenPath({
          businessId,
          nowISO,
          outboundApproved,
          queue: jobQueue,
          executor,
        });

  if (seed?.id && typeof jobQueue.complete === "function") {
    try {
      await jobQueue.complete(seed.id, {
        vertical: v,
        workId: pathResult.workId,
        ok: pathResult.ok,
      });
    } catch {
      // Seed may already be claimed by worker — ignore.
    }
  }

  return deepFreeze({
    ...pathResult,
    queueBackend: queue ? "injected" : "in_memory",
    seedJobId: seed?.id ?? null,
  });
}
