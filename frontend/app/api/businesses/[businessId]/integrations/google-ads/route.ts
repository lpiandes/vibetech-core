import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params; const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE); const body = await request.json().catch(() => ({}));
    const customerId = String(body.customerId ?? "").replace(/\D/g, ""); const developerToken = String(body.developerToken ?? "").trim(); const accessToken = String(body.accessToken ?? "").trim(); const loginCustomerId = String(body.loginCustomerId ?? "").replace(/\D/g, "");
    if (!customerId || !developerToken || !accessToken) return NextResponse.json({ error: "Google Ads customer ID, developer token, and access token are required.", code: "MISSING_CREDENTIALS" }, { status: 400 });
    const credentialId = `cred_google_ads_${businessId}`;
    await putDurableCredential({ platformStore, vault: getSharedCredentialVault(), workspaceId: businessId, credentialId, providerType: "google_ads", secrets: { customerId, developerToken, accessToken, loginCustomerId }, metadata: { customerId, loginCustomerId } });
    const connection = await ctx.service.connectGrowthChannel({ connectionType: "google_ads", displayName: "Google Ads", providerType: "google_ads", credentialId, externalAccountReference: `google_ads:${customerId}`, metadata: { customerId, loginCustomerId }, platformActiveKnowledgeCount: await platformStore.countActiveKnowledgeDocuments(businessId) });
    return NextResponse.json({ ok: true, connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status } });
  } catch (error) { return authorizationErrorResponse(error); }
}
