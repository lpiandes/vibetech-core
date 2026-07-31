/**
 * Client-facing Meta Lead Forms handoff: owner tells us their Page name/URL;
 * VIBETech ops connects Graph API / webhooks — clients never paste tokens.
 */
import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  DEFAULT_PLATFORM_OPERATOR_EMAIL,
  notifyPlatformOperators,
} from "../../../../../../../../backend/core/admin/notifyPlatformOperators.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const pageName = String(body.pageName ?? "").trim();
    const pageUrl = String(body.pageUrl ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const requestedBy = String(
      (ctx as any)?.user?.email
      ?? body.requestedBy
      ?? "",
    ).trim();

    const business = await platformStore.getBusiness?.(businessId).catch?.(() => null) ?? null;
    const businessName = String(business?.name ?? body.businessName ?? businessId).trim();
    const origin = new URL(request.url).origin;
    const webhookUrl = `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta/webhook`;
    const integrationsHref = `${origin}/b/${encodeURIComponent(businessId)}/integrations`;
    const adminHref = `/admin/businesses/${encodeURIComponent(businessId)}`;

    const steps = [
      `Open business “${businessName}” (${businessId}) in Admin / Support access.`,
      pageName || pageUrl
        ? `Locate Facebook Page${pageName ? `: “${pageName}”` : ""}${pageUrl ? ` — ${pageUrl}` : ""}.`
        : "Ask the owner which Facebook Page runs their Lead Ads (they did not provide a name/URL).",
      "In Meta Developers → Graph API Explorer (VIBETech app): generate a User token with pages_show_list, pages_read_engagement, leads_retrieval, pages_manage_metadata.",
      "GET /me/accounts → copy Page id + Page access_token for that Page.",
      `POST ${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta with { pageId, pageAccessToken } (ops only — never ask the client to do this).`,
      `Confirm leadgen Page subscribe + Webhooks callback: ${webhookUrl} (verify token = META_LEAD_VERIFY_TOKEN).`,
      "Create a Lead Form ad if none exists; send a test lead → People + META_LEAD drafts.",
      `Confirm Integrations shows connected: ${integrationsHref}`,
    ];

    const action = {
      id: `meta_lead_setup:${businessId}:${Date.now()}`,
      kind: "meta_lead_setup",
      urgency: "high",
      title: `Connect Meta Lead Forms — ${businessName}`,
      summary: [
        "Client requested white-glove Meta Lead Forms setup (no Graph API work for them).",
        requestedBy ? `Requested by: ${requestedBy}` : null,
        pageName ? `Page name: ${pageName}` : null,
        pageUrl ? `Page URL: ${pageUrl}` : null,
        notes ? `Notes: ${notes}` : null,
      ].filter(Boolean).join(" "),
      businessId,
      businessName,
      href: adminHref,
      steps,
      payload: {
        pageName: pageName || null,
        pageUrl: pageUrl || null,
        notes: notes || null,
        requestedBy: requestedBy || null,
        webhookUrl,
        integrationsHref,
      },
      createdAt: new Date().toISOString(),
    };

    const notify = await notifyPlatformOperators({
      actions: [action],
      force: true,
      fallbackDefaultEmail: true,
      toEmails: [DEFAULT_PLATFORM_OPERATOR_EMAIL],
    });

    const emailed = Array.isArray(notify?.results?.email)
      ? notify.results.email.some((row: { sent?: boolean }) => row?.sent === true)
      : false;

    return NextResponse.json({
      ok: true,
      requested: true,
      emailed,
      notifySkipped: Boolean(notify?.skipped),
      notifyReason: notify?.reason ?? null,
      message: emailed
        ? "VIBETech was notified. We’ll connect your Facebook Page — you don’t need Graph API or tokens."
        : "Request recorded for VIBETech ops. If you need us sooner, email leopiandes@vtechdevelopment.com.",
      operatorEmail: DEFAULT_PLATFORM_OPERATOR_EMAIL,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
