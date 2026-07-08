/**
 * Measure development business-email connect phases for magna mare.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

import { platformStore } from "../backend/core/platform/persistence/PostgresPlatformStore.js";
import { businessRecordToActivation } from "../backend/core/platform/persistence/platformMappers.js";
import { workspaceActivationRegistry } from "../backend/core/workspace/activation/WorkspaceActivationRegistry.js";
import { workspaceCompositionRegistry } from "../frontend/lib/workspace/WorkspaceCompositionRegistry.js";
import { ConnectedBusinessWorkspace } from "../frontend/lib/workspace/ConnectedBusinessWorkspace.ts";
import { refreshWorkspaceOperationalState } from "../backend/core/workspace/refreshWorkspaceOperationalState.js";
import { connectBusinessEmailDev } from "../backend/core/integrations/use-cases/connectBusinessEmailDev.js";
import { ConnectionService } from "../backend/core/integrations/use-cases/ConnectionService.js";
import { createDefaultIntegrationProviderRegistry } from "../backend/core/integrations/createIntegrationPlatform.js";
import { CONNECTION_STATUSES } from "../backend/core/integrations/connections/ConnectionStatus.js";

const businessId = "e58a7a52-969b-4377-a77e-98500e5bf648";

function ms(start, end = performance.now()) {
  return `${(end - start).toFixed(1)}ms`;
}

const business = await platformStore.getBusinessById(businessId);
const activation = businessRecordToActivation(business);
workspaceActivationRegistry.ensure(businessId, activation);

workspaceCompositionRegistry.clear(businessId);
const connected = workspaceCompositionRegistry.getOrCreate(businessId, ({ workspaceId }) => {
  return new ConnectedBusinessWorkspace({ workspaceId, activation });
});

const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);

// Disconnect email so connect path runs fully
const emailConn = connected.integrationPlatform?.connectionRuntime?.getConnectionByType("business_email");
if (emailConn?.status === CONNECTION_STATUSES.CONNECTED) {
  const connectionService = new ConnectionService({
    connectionRuntime: connected.integrationPlatform.connectionRuntime,
    providerRegistry: createDefaultIntegrationProviderRegistry({ nowISO: new Date().toISOString() }),
    nowISO: new Date().toISOString(),
  });
  connectionService.disconnect({ connectionId: emailConn.id });
  refreshWorkspaceOperationalState({
    ctx: connected.ctx,
    installationResult: connected.installationResult,
    integrationPlatform: connected.integrationPlatform,
    activation: connected.activation,
    platformActiveKnowledgeCount: knowledgeCount,
  });
}

const timings = {};
const totalStart = performance.now();

let t = performance.now();
timings.workspaceCompositionReady = ms(t, (t = performance.now()));

t = performance.now();
await connectBusinessEmailDev({
  integrationPlatform: connected.integrationPlatform,
  workspaceId: businessId,
  nowISO: new Date().toISOString(),
});
timings.connectBusinessEmailDev = ms(t, (t = performance.now()));

refreshWorkspaceOperationalState({
  ctx: connected.ctx,
  installationResult: connected.installationResult,
  integrationPlatform: connected.integrationPlatform,
  activation: connected.activation,
  platformActiveKnowledgeCount: knowledgeCount,
});
timings.refreshOperationalState = ms(t, (t = performance.now()));

timings.totalBackend = ms(totalStart);

console.log(JSON.stringify({ businessId, knowledgeCount, timings }, null, 2));
