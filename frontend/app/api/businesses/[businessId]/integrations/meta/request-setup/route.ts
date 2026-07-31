/**
 * Client-facing Meta Lead Forms handoff: owner tells us their Page name/URL
 * (or that they have no Facebook yet); VIBETech ops connects — clients never paste tokens.
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
    const needEverything = body.needEverything === true
      || String(body.startingPoint ?? "").trim() === "need_everything";
    const pageName = needEverything ? "" : String(body.pageName ?? "").trim();
    const pageUrl = needEverything ? "" : String(body.pageUrl ?? "").trim();
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

    const connectSteps = [
      "In Meta Developers → Graph API Explorer (VIBETech app): generate a User token with pages_show_list, pages_read_engagement, leads_retrieval, pages_manage_metadata.",
      "GET /me/accounts → copy Page id + Page access_token for that Page.",
      `POST ${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta with { pageId, pageAccessToken } (ops only — never ask the client to do this).`,
      `Confirm leadgen Page subscribe + Webhooks callback: ${webhookUrl} (verify token = META_LEAD_VERIFY_TOKEN).`,
      "Send a test lead → People + META_LEAD drafts.",
      `Confirm Integrations shows connected: ${integrationsHref}`,
    ];

    const steps = needEverything
      ? [
          `Open business “${businessName}” (${businessId}) in Admin / Support access.`,
          "Client has NO Facebook Page / Lead Ads yet — white-glove from scratch.",
          "Schedule a short call or gather: who owns the Facebook login, business website, privacy policy URL, service area, offer.",
          "Create/claim a Facebook Page for the business (or guide them while on a call).",
          "In Ads Manager: create a Leads campaign → Instant Form collecting name, email, phone + privacy policy URL.",
          "Publish a small test Lead Ad (even $5–$20/day) so a real leadgen event can fire.",
          ...connectSteps,
        ]
      : [
          `Open business “${businessName}” (${businessId}) in Admin / Support access.`,
          pageName || pageUrl
            ? `Locate Facebook Page${pageName ? `: “${pageName}”` : ""}${pageUrl ? ` — ${pageUrl}` : ""}.`
            : "Ask the owner which Facebook Page runs their Lead Ads (they did not provide a name/URL).",
          "Confirm a Lead Form exists; if not, create Instant Form + small test ad.",
          ...connectSteps,
        ];

    const action = {
      id: `meta_lead_setup:${businessId}:${Date.now()}`,
      kind: needEverything ? "meta_lead_setup_from_scratch" : "meta_lead_setup",
      urgency: "high",
      title: needEverything
        ? `Build + connect Meta Lead Forms — ${businessName}`
        : `Connect Meta Lead Forms — ${businessName}`,
      summary: [
        needEverything
          ? "Client has no Facebook Page / Lead Ads yet — build from scratch, then connect (no Graph API for them)."
          : "Client requested white-glove Meta Lead Forms setup (no Graph API work for them).",
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
        needEverything,
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
      from: "VIBETech Support <support@vtechdevelopment.com>",
    });

    const emailed = Array.isArray(notify?.results?.email)
      ? notify.results.email.some((row: { sent?: boolean }) => row?.sent === true)
      : false;
    const emailErrors = Array.isArray(notify?.results?.email)
      ? notify.results.email
        .filter((row: { sent?: boolean }) => row?.sent !== true)
        .map((row: { to?: string; reason?: string; message?: string }) => ({
          to: row.to,
          reason: row.reason,
          message: row.message,
        }))
      : [];

    return NextResponse.json({
      ok: true,
      requested: true,
      emailed,
      needEverything,
      notifySkipped: Boolean(notify?.skipped),
      notifyReason: notify?.reason ?? null,
      from: notify?.results?.from ?? "VIBETech Support <support@vtechdevelopment.com>",
      emailErrors,
      message: emailed
        ? (needEverything
          ? "VIBETech was notified at leopiandes@vtechdevelopment.com. We’ll help create Facebook + Lead Ads, then connect them."
          : "VIBETech was notified at leopiandes@vtechdevelopment.com. We’ll connect your Facebook Page.")
        : "Request recorded. If you don’t see an email in a minute, write leopiandes@vtechdevelopment.com — email delivery may need RESEND_API_KEY + verified support@ domain.",
      operatorEmail: DEFAULT_PLATFORM_OPERATOR_EMAIL,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
