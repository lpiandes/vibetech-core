/**
 * Backend-owned demo provisioner singleton for scripts and Node tests.
 * Next.js must use frontend/lib/server/compose.ts instead.
 */
import { platformStore } from "./persistence/platformStore.js";
import { createDemoWorkspaceProvisioner } from "./DemoWorkspaceProvisioner.js";

const demoWorkspaceProvisioner = createDemoWorkspaceProvisioner({ store: platformStore });

export const createHorizonDemoBusiness = demoWorkspaceProvisioner.createHorizonDemoBusiness;
export { createDemoWorkspaceProvisioner };
