/**
 * Frontend server adapter for platform persistence.
 * Instantiates the shared PostgresPlatformStore with the frontend DB port
 * so Next.js never resolves backend/core/platform/db/pool.js → pg.
 */
import { PostgresPlatformStore } from "../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { withClient } from "@/lib/server/db";

export const platformStore = new PostgresPlatformStore(withClient);
