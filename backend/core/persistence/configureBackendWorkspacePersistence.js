/**
 * Backend-owned workspace persistence bootstrap for scripts and Node tests.
 */
import { withClient } from "../platform/db/pool.js";
import { PostgresWorkspacePersistence } from "./PostgresWorkspacePersistence.js";
import { setWorkspacePersistence } from "./createWorkspacePersistence.js";

export function configureBackendWorkspacePersistence() {
  setWorkspacePersistence(new PostgresWorkspacePersistence(withClient));
}

configureBackendWorkspacePersistence();
