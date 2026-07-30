import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  exchangeGoogleAuthorizationCode,
  getSharedCredentialVault,
  getSharedOAuthStateStore,
  getGoogleOAuthAppConfig,
} from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { workspaceCompositionRegistry } from "@/lib/workspace/WorkspaceCompositionRegistry";
import { GmailInboundSyncService } from "../../../../../../../backend/core/integrations/gmail/GmailInboundSyncService.js";

const OAUTH_STATE_COOKIE = "vt_google_oauth_state";

function resolvePendingState(stateToken: string | null) {
  if (!stateToken) return null;
  const fromMemory = getSharedOAuthStateStore().consume(stateToken);
  if (fromMemory) return fromMemory;
  return null;
}

/**
 * Fixed Google OAuth callback (register this exact URI in Google Cloud Console).
 * State encodes businessId + connectionType + providerType.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const grantedScope = String(url.searchParams.get("scope") ?? "");

  const cookieStore = await cookies();
  let pending = resolvePendingState(stateToken);

  if (!pending && stateToken) {
    try {
      const raw = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.state === stateToken) {
        pending = parsed;
      }
    } catch {
      pending = null;
    }
  }

  const fallbackPath = pending?.redirectPath || "/";

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`${fallbackPath}${fallbackPath.includes("?") ? "&" : "?"}error=${encodeURIComponent(oauthError)}`, request.url),
    );
  }
  if (!code || !pending) {
    return NextResponse.redirect(
      new URL(`${fallbackPath}${fallbackPath.includes("?") ? "&" : "?"}error=invalid_oauth`, request.url),
    );
  }

  try {
    const businessId = String(pending.businessId);
    // Drop stale in-memory workspace so generic businesses get a fresh integration platform.
    workspaceCompositionRegistry.clear(businessId);

    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const config = getGoogleOAuthAppConfig();
    const tokens = await exchangeGoogleAuthorizationCode({ code, redirectUri: config.redirectUri });

    if (pending.providerType === "gmail" && !/gmail\.send/i.test(grantedScope) && !/gmail\.send/i.test(String(tokens.scope ?? ""))) {
      return NextResponse.redirect(
        new URL(
          `${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}error=${encodeURIComponent(
            "Please check “Send email on your behalf” on the Google permission screen, then try again.",
          )}`,
          request.url,
        ),
      );
    }

    if (!tokens.refreshToken) {
      return NextResponse.redirect(
        new URL(
          `${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}error=missing_refresh_token`,
          request.url,
        ),
      );
    }

    const knowledgeCount = await platformStore.countActiveKnowledgeDocuments(businessId);
    const vault =
      (ctx.service as any)?.connected?.integrationPlatform?.credentialVault
      ?? getSharedCredentialVault();

    if (pending.providerType === "gmail") {
      const credentialId = `cred_gmail_${businessId}`;
      await putDurableCredential({
        platformStore,
        vault,
        workspaceId: businessId,
        credentialId,
        providerType: "gmail",
        secrets: {
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken || null,
          senderEmail: tokens.senderEmail || null,
          scope: tokens.scope || grantedScope || null,
        },
        metadata: { senderEmail: tokens.senderEmail || null, scope: tokens.scope || grantedScope || null },
      });
      await ctx.service.connectBusinessEmailGmail({
        credentialId,
        senderEmail: tokens.senderEmail,
        platformActiveKnowledgeCount: knowledgeCount,
      });

      // Best-effort first sync so the inbox isn't empty until the next "Sync now"
      // click or hosted job tick sweep — never block/fail the OAuth redirect on this.
      try {
        const platform = (ctx.service as any)?.connected?.integrationPlatform ?? null;
        const connection = platform?.connectionRuntime?.getConnectionByType?.("business_email") ?? null;
        const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
        if (connection && installation) {
          await new GmailInboundSyncService().sync({
            businessId,
            platformStore,
            installation,
            connection,
            credentialResolver: platform?.credentialResolver ?? null,
            maxResults: 25,
            actorId: "gmail_oauth_connect",
          });
        }
      } catch {
        /* non-fatal — the manual "Sync now" button and hosted tick sweep still cover this */
      }
    } else if (pending.providerType === "google_calendar") {
      const credentialId = `cred_gcal_${businessId}`;
      await putDurableCredential({
        platformStore,
        vault,
        workspaceId: businessId,
        credentialId,
        providerType: "google_calendar",
        secrets: {
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken || null,
          senderEmail: tokens.senderEmail || null,
        },
        metadata: { senderEmail: tokens.senderEmail || null },
      });
      await ctx.service.connectGoogleCalendar({
        credentialId,
        senderEmail: tokens.senderEmail,
        platformActiveKnowledgeCount: knowledgeCount,
      });
      const calendarStatus = String(
        ctx.service.connected?.integrationPlatform?.connectionRuntime?.getConnectionByType?.("calendar")?.status
        ?? "",
      ).toUpperCase();
      if (calendarStatus !== "CONNECTED") {
        return NextResponse.redirect(
          new URL(
            `${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}error=${encodeURIComponent(
              "Calendar connected but verification failed. Reconnect and approve calendar access.",
            )}`,
            request.url,
          ),
        );
      }
    } else if (pending.providerType === "google_search_console") {
      const credentialId = `cred_gsc_${businessId}`;
      await putDurableCredential({
        platformStore,
        vault,
        workspaceId: businessId,
        credentialId,
        providerType: "google_search_console",
        secrets: {
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken || null,
          senderEmail: tokens.senderEmail || null,
        },
        metadata: { senderEmail: tokens.senderEmail || null },
      });
      await ctx.service.connectGoogleSearchConsole({
        credentialId,
        senderEmail: tokens.senderEmail,
        platformActiveKnowledgeCount: knowledgeCount,
      });
    } else {
      return NextResponse.redirect(
        new URL(`${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}error=unknown_provider`, request.url),
      );
    }

    cookieStore.delete(OAUTH_STATE_COOKIE);
    const successPath = `${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}connected=1`;
    return NextResponse.redirect(new URL(successPath, request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    const path = pending?.redirectPath || "/";
    return NextResponse.redirect(
      new URL(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
