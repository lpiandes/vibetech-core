import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { workspaceCompositionRegistry } from "@/lib/workspace/WorkspaceCompositionRegistry";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { persistAffectedRuntimes } from "../../../../../../../backend/core/persistence/PersistedMutationCoordinator.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../../../../../../backend/core/persistence/RuntimeSnapshotKinds.js";

/**
 * Demo / support: clear launch proofs and disconnect Google email (+ calendar)
 * so Home Launch Path can be re-filmed from Connect business email.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    if (!ctx.isPlatformAdmin && String(ctx.role ?? "").toUpperCase() !== "OWNER") {
      return NextResponse.json({ error: "Only the owner or platform admin can reset launch path." }, { status: 403 });
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

    return NextResponse.json({
      ok: true,
      proofsCleared: proofs.deleted,
      disconnected,
      message: "Launch path reset. Hard-refresh Home to re-film from Connect business email.",
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
