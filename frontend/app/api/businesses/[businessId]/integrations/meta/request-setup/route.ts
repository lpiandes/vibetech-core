/**
 * Client-facing Meta Lead Forms handoff: owner tells us their Page name/URL
 * (or that they have no Facebook yet); VIBETech ops connects — clients never paste tokens.
 *
 * Always emails leopiandes@vtechdevelopment.com with exact steps, and persists a
 * pending_ops flag so Home Mission 6 shows Pending (not another Set up).
 */
import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import {
  DEFAULT_PLATFORM_OPERATOR_EMAIL,
  RESEND_ACCOUNT_OPS_FALLBACK_EMAIL,
  notifyPlatformOperators,
} from "../../../../../../../../backend/core/admin/notifyPlatformOperators.js";
import {
  resolveOpsFromCandidates,
  parseResendAllowedRecipient,
} from "../../../../../../../../backend/core/platform/delivery/createInvitationDeliveryProvider.js";

async function sendResendEmail({
  apiKey,
  from,
  to,
  subject,
  text,
  replyTo = "support@vtechdevelopment.com",
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`,
      reply_to: replyTo,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    sent: res.ok === true,
    status: res.status,
    id: data?.id ? String(data.id) : null,
    message: String(data?.message ?? data?.error ?? "").trim() || null,
    from,
    to,
  };
}

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

    const business = await platformStore.getBusinessById(businessId).catch(() => null);
    const businessName = String(business?.name ?? body.businessName ?? businessId).trim();
    const origin = new URL(request.url).origin;
    const webhookUrl = `${origin}/api/businesses/${encodeURIComponent(businessId)}/integrations/meta/webhook`;
    const integrationsHref = `${origin}/b/${encodeURIComponent(businessId)}/integrations`;
    const adminHref = `/admin/businesses/${encodeURIComponent(businessId)}`;
    const requestedAt = new Date().toISOString();

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

    const opsRequest = {
      status: "pending_ops",
      kind: needEverything ? "meta_lead_setup_from_scratch" : "meta_lead_setup",
      requestedAt,
      requestedBy: requestedBy || null,
      needEverything,
      pageName: pageName || null,
      pageUrl: pageUrl || null,
      notes: notes || null,
      webhookUrl,
      integrationsHref,
      steps,
    };

    // Persist so Home Mission 6 flips to Pending even if email fails.
    const credentialId = `cred_meta_${businessId}`;
    try {
      const existingRows = await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => []);
      const existing = (Array.isArray(existingRows) ? existingRows : []).find((row: any) => {
        const provider = String(row?.providerType ?? "");
        const id = String(row?.credentialId ?? "");
        return provider === "meta_lead_ads" || id === credentialId || id.includes("meta");
      });
      const secrets = existing?.secrets && typeof existing.secrets === "object" ? existing.secrets : {};
      const metadata = {
        ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
        ...opsRequest,
        setupRequestedAt: requestedAt,
      };
      await putDurableCredential({
        platformStore,
        vault: getSharedCredentialVault(),
        workspaceId: businessId,
        credentialId: String(existing?.credentialId ?? credentialId),
        providerType: "meta_lead_ads",
        secrets,
        metadata,
      });
    } catch {
      /* non-blocking */
    }

    try {
      if (typeof platformStore.updateBusinessPackageConfiguration === "function") {
        const current = business?.packageConfiguration && typeof business.packageConfiguration === "object"
          ? business.packageConfiguration
          : {};
        await platformStore.updateBusinessPackageConfiguration({
          businessId,
          packageConfiguration: {
            ...current,
            pendingOpsRequests: {
              ...(current.pendingOpsRequests && typeof current.pendingOpsRequests === "object"
                ? current.pendingOpsRequests
                : {}),
              meta_lead_ads: opsRequest,
            },
          },
        });
      }
    } catch {
      /* non-blocking */
    }

    const action = {
      id: `meta_lead_setup:${businessId}:${Date.now()}`,
      kind: opsRequest.kind,
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
      payload: opsRequest,
      createdAt: requestedAt,
    };

    const subject = `[VIBETech] Meta Lead Forms setup — ${businessName}`;
    const text = [
      action.title,
      action.summary,
      "",
      "Steps:",
      ...steps.map((step, i) => `  ${i + 1}. ${step}`),
      "",
      `Admin: ${origin}${adminHref}`,
      `Integrations: ${integrationsHref}`,
    ].join("\n");

    const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
    const recipients = [
      ...new Set([
        DEFAULT_PLATFORM_OPERATOR_EMAIL,
        RESEND_ACCOUNT_OPS_FALLBACK_EMAIL,
        ...String(process.env.PLATFORM_OPERATOR_EMAIL ?? "")
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
      ]),
    ];
    const fromAttempts: Array<Record<string, unknown>> = [];
    let emailed = false;
    let usedFrom: string | null = null;
    let usedTo: string | null = null;

    if (apiKey) {
      const fromCandidates = resolveOpsFromCandidates(
        process.env.OPS_EMAIL_FROM || process.env.INVITATION_EMAIL_FROM || "VIBETech <onboarding@resend.dev>",
      );
      const queue = [...recipients];
      const tried = new Set<string>();
      while (queue.length && !emailed) {
        const to = queue.shift() as string;
        if (tried.has(to)) continue;
        tried.add(to);
        for (const from of fromCandidates) {
          const result = await sendResendEmail({
            apiKey,
            from,
            to,
            subject,
            text,
            replyTo: "support@vtechdevelopment.com",
          });
          fromAttempts.push(result);
          if (result.sent) {
            emailed = true;
            usedFrom = from;
            usedTo = to;
            break;
          }
          const allowed = parseResendAllowedRecipient(result.message ?? "");
          if (allowed && !tried.has(allowed) && !queue.includes(allowed)) {
            queue.push(allowed);
          }
        }
      }
    } else {
      fromAttempts.push({ sent: false, reason: "missing_RESEND_API_KEY", to: recipients[0] });
    }

    // Secondary notify path (webhook / PLATFORM_OPERATOR_EMAIL merge).
    const notify = await notifyPlatformOperators({
      actions: [action],
      force: true,
      fallbackDefaultEmail: true,
      toEmails: recipients,
      from: usedFrom || process.env.OPS_EMAIL_FROM || process.env.INVITATION_EMAIL_FROM || null,
      replyTo: "support@vtechdevelopment.com",
    }).catch(() => null);

    if (!emailed && Array.isArray(notify?.results?.email)) {
      const hit = notify.results.email.find((row: { sent?: boolean; to?: string }) => row?.sent === true);
      if (hit) {
        emailed = true;
        usedTo = hit.to ? String(hit.to) : usedTo;
      }
      usedFrom = usedFrom || notify?.results?.from || null;
    }

    const clientMessage = needEverything
      ? "Our team is on it — we’ll create your Facebook Page and Lead Ads ASAP (usually less than 24 hours)."
      : "Our team is on it — we’ll connect your Facebook Lead Forms ASAP (usually less than 24 hours).";

    return NextResponse.json({
      ok: true,
      requested: true,
      pending: true,
      emailed,
      needEverything,
      from: usedFrom,
      to: usedTo,
      fromAttempts,
      message: clientMessage,
      operatorEmail: usedTo || DEFAULT_PLATFORM_OPERATOR_EMAIL,
      resendConfigured: Boolean(apiKey),
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
