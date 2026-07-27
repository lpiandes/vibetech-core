import { NextResponse } from "next/server";

import {
  isMetaLeadAdsConfigured,
} from "@/lib/server/liveIntegrations";
import { getSystemWorkspaceForBusiness } from "@/lib/platform/getSystemWorkspaceForBusiness";
import {
  ingestMetaLead,
  verifyMetaWebhookSignature,
} from "../../../../../../../../backend/core/integrations/meta/ingestMetaLead.js";
import { platformStore } from "@/lib/server/compose";

/**
 * Meta Lead Ads webhook verification (GET) and leadgen ingest (POST).
 * POST is public (Meta has no session) — secured by X-Hub-Signature-256 when app secret is set.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  void params;
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.META_LEAD_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || "";

  if (mode === "subscribe" && token && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    if (!isMetaLeadAdsConfigured()) {
      return NextResponse.json({ error: "Meta not configured." }, { status: 501 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256") || request.headers.get("X-Hub-Signature-256");
    const appSecret = process.env.META_APP_SECRET || "";
    if (appSecret) {
      const verified = verifyMetaWebhookSignature({
        rawBody,
        signatureHeader: signature,
        appSecret,
      });
      if (!verified.ok) {
        return NextResponse.json({ error: "Invalid signature.", code: verified.reason }, { status: 401 });
      }
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    const { service, installation } = await getSystemWorkspaceForBusiness(businessId);

    const result = await ingestMetaLead({
      businessId,
      webhookBody: body,
      platformStore,
      workspaceService: service,
      installation,
      actorId: "meta_webhook",
    });

    // Persist last webhook receipt for owner/admin health.
    try {
      const rows = await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => []);
      const row = (Array.isArray(rows) ? rows : []).find((r: any) =>
        String(r?.providerType ?? "").includes("meta_lead"),
      );
      if (row?.credentialId) {
        const { putDurableCredential } = await import(
          "../../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js"
        );
        const { getSharedCredentialVault } = await import("@/lib/server/liveIntegrations");
        await putDurableCredential({
          platformStore,
          vault: getSharedCredentialVault(),
          workspaceId: businessId,
          credentialId: String(row.credentialId),
          providerType: row.providerType || "meta_lead_ads",
          secrets: row.secrets ?? {},
          metadata: {
            ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
            lastWebhookAt: new Date().toISOString(),
            lastWebhookOk: result.ok === true,
            lastLeadgenId: result.leadgenId ?? null,
            lastWebhookDeduped: result.deduped === true,
          },
        });
      }
    } catch {
      /* best effort */
    }

    if (!result.ok) {
      return NextResponse.json({ ok: false, ...result }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      contactId: result.contactId,
      cardId: result.cardId,
      leadgenId: result.leadgenId,
      deduped: result.deduped === true,
      automationFired: Number(result.automation?.firedCount ?? 0),
    });
  } catch (err) {
    console.error("[meta webhook]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook ingest failed" },
      { status: 500 },
    );
  }
}
