import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import {
  CRM_PROVIDERS,
  verifyCrmPrivateApp,
} from "../../../../../../../backend/core/integrations/crm/CrmPrivateAppConnect.js";

/**
 * Connect HubSpot or HighLevel via private app / API key (Plan 26).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const provider = String(body.provider ?? "").toLowerCase();
    const meta = CRM_PROVIDERS[provider];
    if (!meta) {
      return NextResponse.json(
        { error: "provider must be hubspot or highlevel", code: "INVALID_PROVIDER" },
        { status: 400 },
      );
    }

    const accessToken = String(body.accessToken ?? body.apiKey ?? "").trim();
    const locationId = body.locationId ? String(body.locationId).trim() : null;
    const verified = await verifyCrmPrivateApp({ provider, accessToken, locationId });
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.message, code: verified.reason ?? "VERIFY_FAILED", detail: verified.detail ?? null },
        { status: 400 },
      );
    }

    const credentialId = `cred_${meta.providerType}_${businessId}`;
    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    await putDurableCredential({
      platformStore,
      vault,
      workspaceId: businessId,
      credentialId,
      providerType: meta.providerType,
      secrets: { accessToken, ...(locationId ? { locationId } : {}) },
      metadata: { locationId: locationId ?? null, provider },
    });

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const connection = await ctx.service.connectCrmPrivateApp({
      connectionType: meta.connectionType,
      displayName: meta.label,
      providerType: meta.providerType,
      credentialId,
      locationId,
      platformActiveKnowledgeCount: knowledgeCount,
    });

    const status = String(connection?.status ?? "").toUpperCase();
    if (status !== "CONNECTED") {
      return NextResponse.json(
        {
          error: "Credentials saved but connection did not reach Connected.",
          code: "CONNECT_FAILED",
          connection: { id: connection?.id, connectionType: connection?.connectionType, status: connection?.status },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      connection: {
        id: connection?.id,
        connectionType: connection?.connectionType,
        status: connection?.status,
      },
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

/**
 * Ongoing People ↔ HubSpot/HighLevel sync.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "sync_now");
    if (action !== "sync_now" && action !== "pull" && action !== "push") {
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }

    const {
      syncContactsFromExternal,
      syncContactsToExternal,
    } = await import("../../../../../../../backend/core/integrations/crm/CrmExternalSync.js");
    const { readCrmState, writeCrmState, upsertContact } = await import(
      "../../../../../../../backend/core/crm/CrmStore.js"
    );

    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();
    const credentials = await platformStore.listIntegrationCredentialsForWorkspace(businessId);
    const matching = credentials.find((c: any) => /hubspot|highlevel/i.test(String(c.providerType ?? "")));
    if (!matching) {
      return NextResponse.json({ error: "Connect HubSpot or HighLevel first", code: "NOT_CONNECTED" }, { status: 400 });
    }
    const record = typeof vault?.get === "function" ? vault.get(matching.credentialId) : null;
    const accessToken = String(record?.secrets?.accessToken ?? record?.secrets?.apiKey ?? "").trim();
    const locationId = record?.secrets?.locationId ?? matching.metadata?.locationId ?? null;
    const provider = /highlevel/i.test(String(matching.providerType ?? "")) ? "highlevel" : "hubspot";
    const installation = await platformStore.getBusinessOSInstallation(businessId);
    if (!installation) return NextResponse.json({ error: "Installation not found" }, { status: 404 });

    const direction = action === "pull" ? "pull" : action === "push" ? "push" : "both";
    let pulled = null;
    let pushed = null;
    if (direction === "pull" || direction === "both") {
      pulled = await syncContactsFromExternal({ provider, accessToken, locationId });
      if (pulled.ok && Array.isArray(pulled.contacts)) {
        let crm = readCrmState(installation);
        for (const contact of pulled.contacts) {
          crm = upsertContact(crm, {
            id: contact.id,
            partyId: contact.id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            kind: "lead",
            tags: [contact.source || "crm_sync"],
          });
        }
        await writeCrmState({
          platformStore,
          installation,
          crm,
          actorId: "crm_external_sync",
        });
      }
    }
    if (direction === "push" || direction === "both") {
      const fresh = await platformStore.getBusinessOSInstallation(businessId);
      const crm = readCrmState(fresh);
      pushed = await syncContactsToExternal({
        provider,
        accessToken,
        locationId,
        contacts: crm.contacts ?? [],
        limit: Number(body.limit ?? 25),
      });
    }

    return NextResponse.json({ ok: true, provider, pulled, pushed });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

