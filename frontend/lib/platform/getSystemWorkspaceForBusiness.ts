/**
 * Load a WorkspaceService for system/webhook contexts (no user session).
 */
import { WorkspaceService } from "@/lib/workspace/WorkspaceService";
import { createLiveIntegrationProviders } from "@/lib/server/liveIntegrations";
import { platformStore } from "@/lib/server/compose";
import { resolveWorkspaceRuntimeSnapshots } from "../../../backend/core/persistence/resolveWorkspaceRuntimeSnapshots.js";
import { hydrateWorkspaceCredentials } from "../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { reconcileConnectionsFromDurableCredentials } from "../../../backend/core/integrations/credentials/reconcileConnectionsFromDurableCredentials.js";
import { workspaceCompositionRegistry } from "@/lib/workspace/WorkspaceCompositionRegistry";

export async function getSystemWorkspaceForBusiness(businessId: string) {
  const id = String(businessId ?? "").trim();
  if (!id) throw new Error("businessId required");

  const installation = await platformStore.getBusinessOSInstallation(id).catch(() => null);
  const registryWarm = workspaceCompositionRegistry.has(id);
  const runtimeSnapshots = registryWarm
    ? undefined
    : ((await resolveWorkspaceRuntimeSnapshots(id)) as Record<string, unknown> | undefined);

  const service = new WorkspaceService({
    workspaceId: id,
    activation: {
      industryPackageId: installation?.configuration?.operatingPackId
        ?? installation?.configuration?.industryPackageId
        ?? null,
      packageConfiguration: installation?.configuration ?? {},
    },
    runtimeSnapshots,
    extraProviders: createLiveIntegrationProviders({ nowISO: new Date().toISOString() }),
  });

  const connected = (service as any).connected as { credentialsHydrated?: boolean };
  const vault = (service as any)?.connected?.integrationPlatform?.credentialVault;
  if (!connected.credentialsHydrated) {
    await hydrateWorkspaceCredentials({
      platformStore,
      vault,
      workspaceId: id,
      overwrite: false,
    });
    connected.credentialsHydrated = true;
  }

  // System/webhook paths need durable connect heal (inbound email etc.).
  await reconcileConnectionsFromDurableCredentials({
    workspaceId: id,
    integrationPlatform: (service as any)?.connected?.integrationPlatform,
    operatingStack: (service as any)?.connected?.operatingStack,
    vault,
    platformStore,
  }).then((result) => {
    if (result?.healed?.length) service.refreshOperationalState(0);
  });

  return { service, installation, businessId: id };
}
