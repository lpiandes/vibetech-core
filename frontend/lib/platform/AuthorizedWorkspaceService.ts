import { cache } from "react";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

import { authorizeBusinessAccess, AuthorizationError } from "@/lib/server/compose";
import { resolveWorkspaceRuntimeSnapshots } from "../../../backend/core/persistence/resolveWorkspaceRuntimeSnapshots.js";
import { createWorkspaceRequestTimer } from "../../../backend/core/persistence/workspaceRequestTiming.js";
import { timeRequestStage } from "../../../backend/core/platform/requestTiming.js";
import {
  getCachedAuthorizationScope,
  setCachedAuthorizationScope,
  noteAuthorizationCacheHit,
} from "../../../backend/core/platform/authorizationScopeCache.js";
import { workspaceCompositionRegistry } from "../workspace/WorkspaceCompositionRegistry.js";
import { WorkspaceService } from "../workspace/WorkspaceService";
import type { WorkspaceActivationInput } from "../workspace/ConnectedBusinessWorkspace";
import { createLiveIntegrationProviders } from "@/lib/server/liveIntegrations";
import { platformStore } from "@/lib/server/compose";
import { hydrateWorkspaceCredentials } from "../../../backend/core/integrations/credentials/durableCredentialVault.js";
import {
  reconcileConnectionsFromDurableCredentials,
  connectionHealLikelyNeeded,
} from "../../../backend/core/integrations/credentials/reconcileConnectionsFromDurableCredentials.js";
import { getSharedCredentialVault } from "../../../backend/core/integrations/credentials/CredentialVault.js";

export type AuthorizedContext = Awaited<ReturnType<typeof getAuthorizedWorkspace>>;

export const getSessionUser = cache(async () => {
  return timeRequestStage("AUTH_SESSION", async () => {
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user;
  });
});

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthorizationError("UNAUTHENTICATED", "Sign in required.");
  }
  return user;
}

export const getAuthorizedBusinessScope = cache(async (businessId: string, requiredPermission?: string) => {
  const user = await requireSessionUser();
  const cached = getCachedAuthorizationScope(user.id, businessId, null);
  if (cached) {
    noteAuthorizationCacheHit();
    const permissions = cached.permissions instanceof Set
      ? cached.permissions
      : new Set(cached.permissions ?? []);
    if (requiredPermission && !permissions.has(requiredPermission) && !cached.isPlatformAdmin) {
      throw new AuthorizationError("FORBIDDEN", "You do not have permission for this action.");
    }
    return {
      user,
      authz: cached.authz,
      businessId,
      role: cached.role,
      permissions,
      isPlatformAdmin: cached.isPlatformAdmin,
    };
  }

  // Always load full membership once; check requiredPermission in memory.
  const authz = await timeRequestStage("AUTHZ_DB", () =>
    authorizeBusinessAccess({
      userId: user.id,
      businessId,
      platformRole: user.platformRole ?? null,
      requiredPermission: null,
    }),
  );

  if (requiredPermission && !authz.permissions.has(requiredPermission) && !authz.isPlatformAdmin) {
    throw new AuthorizationError("FORBIDDEN", "You do not have permission for this action.");
  }

  const scope = {
    user,
    authz,
    businessId,
    role: authz.role,
    permissions: authz.permissions,
    isPlatformAdmin: authz.isPlatformAdmin,
  };
  setCachedAuthorizationScope(user.id, businessId, null, scope);
  return scope;
});

export const getAuthorizedWorkspace = cache(async (businessId: string, requiredPermission?: string) => {
  const timer = createWorkspaceRequestTimer("getAuthorizedWorkspace");
  const scope = await timer.time("AUTH", () => getAuthorizedBusinessScope(businessId, requiredPermission));

  const registryWarm = workspaceCompositionRegistry.has(businessId);
  timer.mark(registryWarm ? "REGISTRY_HIT" : "REGISTRY_MISS");

  const runtimeSnapshots = registryWarm
    ? undefined
    : ((await timer.time("SNAPSHOT_LOAD", () => resolveWorkspaceRuntimeSnapshots(businessId))) as
        | Record<string, unknown>
        | undefined);

  if (registryWarm) {
    timer.mark("SNAPSHOT_LOAD_SKIPPED");
  }

  const service = new WorkspaceService({
    workspaceId: businessId,
    activation: scope.authz.activation as WorkspaceActivationInput,
    runtimeSnapshots,
    extraProviders: createLiveIntegrationProviders({ nowISO: "2026-07-01T00:00:00.000Z" }),
  });
  timer.mark("WORKSPACE_SERVICE");

  // Soft-nav fast path: hydrate vault once per process composition. Skip DB if
  // known credential ids are already in the shared vault.
  const connected = (service as any).connected as { credentialsHydrated?: boolean };
  if (!connected.credentialsHydrated) {
    const vault =
      (service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    const knownIds = [`cred_gmail_${businessId}`, `cred_gcal_${businessId}`];
    const vaultWarm = knownIds.some((id) => Boolean(vault?.has?.(id)));
    if (vaultWarm) {
      connected.credentialsHydrated = true;
      timer.mark("CREDENTIAL_HYDRATE_VAULT_HIT");
    } else {
      await timer.time("CREDENTIAL_HYDRATE", () =>
        hydrateWorkspaceCredentials({
          platformStore,
          vault,
          workspaceId: businessId,
          overwrite: false,
        }),
      );
      connected.credentialsHydrated = true;
    }
  } else {
    timer.mark("CREDENTIAL_HYDRATE_SKIPPED");
  }

  timer.finish("TOTAL");

  return {
    ...scope,
    service,
  };
});

/**
 * Force durable credentials → CONNECTED status. Call from Integrations / Home / OAuth
 * — never from every soft navigation.
 */
export async function healWorkspaceConnections(
  businessId: string,
  service: WorkspaceService,
  options: { force?: boolean } = {},
) {
  const platform = (service as any)?.connected?.integrationPlatform;
  if (!options.force && !connectionHealLikelyNeeded(platform, businessId)) {
    return { healed: [], skipped: true };
  }
  const vault = platform?.credentialVault ?? getSharedCredentialVault();
  await hydrateWorkspaceCredentials({
    platformStore,
    vault,
    workspaceId: businessId,
    overwrite: true,
  });
  const result = await reconcileConnectionsFromDurableCredentials({
    workspaceId: businessId,
    integrationPlatform: platform,
    operatingStack: (service as any)?.connected?.operatingStack,
    vault,
    platformStore,
  });
  if (result?.healed?.length) {
    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId).catch(() => 0);
    service.refreshOperationalState(knowledgeCount);
  }
  return result;
}

export function authorizationErrorResponse(err: unknown) {
  if (err instanceof AuthorizationError) {
    const status =
      err.code === "UNAUTHENTICATED" ? 401 : err.code === "NOT_FOUND" ? 404 : err.code === "CONFLICT" ? 409 : 403;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  throw err;
}
