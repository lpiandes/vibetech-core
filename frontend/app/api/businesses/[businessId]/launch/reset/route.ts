import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { workspaceCompositionRegistry } from "@/lib/workspace/WorkspaceCompositionRegistry";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { persistAffectedRuntimes } from "../../../../../../../backend/core/persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../../../../../../backend/core/persistence/RuntimeSnapshotKinds.js";

async function resetLaunchPath(businessId: string) {
  const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
  if (!ctx.isPlatformAdmin && String(ctx.role ?? "").toUpperCase() !== "OWNER") {
    const err = new Error("Only the owner or platform admin can reset launch path.");
    (err as any).code = "FORBIDDEN";
    throw err;
  }

  const proofs = await platformStore.deleteCapabilityProofRecordsForBusiness(businessId);

  const credentialIds = [
    `cred_gmail_${businessId}`,
    `cred_gcal_${businessId}`,
  ];
  const vault = getSharedCredentialVault();
  for (const credentialId of credentialIds) {
    try {
      await platformStore.deleteIntegrationCredential({ workspaceId: businessId, credentialId });
    } catch {
      /* ignore missing */
    }
    try {
      vault.delete?.(credentialId);
    } catch {
      /* optional */
    }
  }

  const platform = (ctx.service as any)?.connected?.integrationPlatform ?? null;
  const disconnected: string[] = [];
  if (platform?.connectionService && platform?.connectionRuntime) {
    for (const connectionType of ["business_email", "calendar"]) {
      const conn = platform.connectionRuntime.getConnectionByType?.(connectionType);
      if (conn?.id) {
        try {
          platform.connectionService.disconnect({ connectionId: conn.id });
          disconnected.push(connectionType);
        } catch {
          /* ignore */
        }
      }
    }
    try {
      await persistAffectedRuntimes({
        workspaceId: businessId,
        stack: (ctx.service as any)?.connected?.operatingStack,
        integrationPlatform: platform,
        kinds: [RUNTIME_SNAPSHOT_KINDS.CONNECTION],
      });
    } catch {
      /* best effort */
    }
  }

  workspaceCompositionRegistry.clear(businessId);

  return {
    ok: true,
    proofsCleared: proofs.deleted,
    disconnected,
  };
}

/**
 * Demo / support: clear launch proofs and disconnect Google email (+ calendar).
 * GET opens in a normal browser tab (no DevTools) and redirects back to Home.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await resetLaunchPath(businessId);
    return NextResponse.redirect(
      new URL(`/b/${encodeURIComponent(businessId)}/home?launchReset=1`, _request.url),
    );
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as any).code === "FORBIDDEN") {
      return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    }
    return authorizationErrorResponse(err);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const result = await resetLaunchPath(businessId);
    return NextResponse.json({
      ...result,
      message: "Launch path reset. Hard-refresh Home to re-film from Connect business email.",
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as any).code === "FORBIDDEN") {
      return NextResponse.json({ error: (err as Error).message }, { status: 403 });
    }
    return authorizationErrorResponse(err);
  }
}
