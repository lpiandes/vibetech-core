import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params; const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE); const body = await request.json().catch(() => ({}));
    const adAccountId = String(body.adAccountId ?? "").trim(); const accessToken = String(body.accessToken ?? "").trim();
    if (!adAccountId || !accessToken) return NextResponse.json({ error: "Meta Ads account ID and access token are required.", code: "MISSING_CREDENTIALS" }, { status: 400 });
    const credentialId = `cred_meta_ads_${businessId}`;
    await putDurableCredential({ platformStore, vault: getSharedCredentialVault(), workspaceId: businessId, credentialId, providerType: "meta_ads", secrets: { adAccountId, accessToken }, metadata: { adAccountId } });
    const connection = await ctx.service.connectGrowthChannel({ connectionType: "meta_ads", displayName: "Meta Ads", providerType: "meta_ads", credentialId, externalAccountReference: `meta_ads:${adAccountId}`, metadata: { adAccountId }, platformActiveKnowledgeCount: await platformStore.countActiveKnowledgeDocuments(businessId) });
    return NextResponse.json({ ok: true, connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status } });
  } catch (error) { return authorizationErrorResponse(error); }
}
