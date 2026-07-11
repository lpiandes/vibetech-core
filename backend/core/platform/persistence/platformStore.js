/**
 * Backend-owned PostgresPlatformStore singleton.
 * Wired to backend/core/platform/db/pool.js for scripts and Node tests.
 * Frontend server code must use frontend/lib/server/compose.ts instead.
 */
import { withClient } from "../db/pool.js";
import { PostgresPlatformStore } from "./PostgresPlatformStore.js";
import { configureBackendWorkspacePersistence } from "../../persistence/configureBackendWorkspacePersistence.js";

configureBackendWorkspacePersistence();

export const platformStore = new PostgresPlatformStore(withClient);
export { PostgresPlatformStore };
