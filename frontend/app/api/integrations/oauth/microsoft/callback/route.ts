import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  exchangeMicrosoftAuthorizationCode,
  getSharedCredentialVault,
  getSharedOAuthStateStore,
  getMicrosoftOAuthAppConfig,
  microsoftScopesIncludeMailSend,
  microsoftScopesIncludeCalendar,
} from "@/lib/server/liveIntegrations";
import { putDurableCredential } from "../../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { workspaceCompositionRegistry } from "@/lib/workspace/WorkspaceCompositionRegistry";

const OAUTH_STATE_COOKIE = "vt_microsoft_oauth_state";

function resolvePendingState(stateToken: string | null) {
  if (!stateToken) return null;
  const fromMemory = getSharedOAuthStateStore().consume(stateToken);
  if (fromMemory) return fromMemory;
  return null;
}

/**
 * Fixed Microsoft OAuth callback (register this exact URI as a redirect URI in the
 * Azure AD app). State encodes businessId + connectionType + providerType.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");

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
      new URL(
        `${fallbackPath}${fallbackPath.includes("?") ? "&" : "?"}error=${encodeURIComponent(
          oauthErrorDescription || oauthError,
        )}`,
        request.url,
      ),
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
    const config = getMicrosoftOAuthAppConfig();
    const tokens = await exchangeMicrosoftAuthorizationCode({ code, redirectUri: config.redirectUri });

    if (pending.providerType === "outlook" && !microsoftScopesIncludeMailSend(tokens.scope)) {
      return NextResponse.redirect(
        new URL(
          `${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}error=${encodeURIComponent(
            `Microsoft did not grant send access (got: ${tokens.scope || "(none)"}). Reconnect Outlook and approve Mail.Send.`,
          )}`,
          request.url,
        ),
      );
    }
    if (pending.providerType === "outlook_calendar" && !microsoftScopesIncludeCalendar(tokens.scope)) {
      return NextResponse.redirect(
        new URL(
          `${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}error=${encodeURIComponent(
            `Microsoft did not grant calendar access (got: ${tokens.scope || "(none)"}). Reconnect Outlook Calendar and approve Calendars.ReadWrite.`,
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

    if (pending.providerType === "outlook") {
      const credentialId = `cred_outlook_${businessId}`;
      await putDurableCredential({
        platformStore,
        vault,
        workspaceId: businessId,
        credentialId,
        providerType: "outlook",
        secrets: {
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken || null,
          senderEmail: tokens.senderEmail || null,
          scope: tokens.scope || null,
        },
        metadata: { senderEmail: tokens.senderEmail || null, scope: tokens.scope || null },
      });
      await ctx.service.connectBusinessEmailOutlook({
        credentialId,
        senderEmail: tokens.senderEmail,
        platformActiveKnowledgeCount: knowledgeCount,
      });
      const emailStatus = String(
        ctx.service.connected?.integrationPlatform?.connectionRuntime?.getConnectionByType?.("business_email")?.status
        ?? "",
      ).toUpperCase();
      if (emailStatus !== "CONNECTED") {
        return NextResponse.redirect(
          new URL(
            `${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}error=${encodeURIComponent(
              "Microsoft signed in, but email connection did not verify. Reconnect Outlook and approve Mail.Send.",
            )}`,
            request.url,
          ),
        );
      }
    } else if (pending.providerType === "outlook_calendar") {
      const credentialId = `cred_outlook_cal_${businessId}`;
      await putDurableCredential({
        platformStore,
        vault,
        workspaceId: businessId,
        credentialId,
        providerType: "outlook_calendar",
        secrets: {
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken || null,
          senderEmail: tokens.senderEmail || null,
        },
        metadata: { senderEmail: tokens.senderEmail || null },
      });
      await ctx.service.connectOutlookCalendar({
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
              "Outlook Calendar connected but verification failed. Reconnect and approve calendar access.",
            )}`,
            request.url,
          ),
        );
      }
    } else {
      return NextResponse.redirect(
        new URL(`${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}error=unknown_provider`, request.url),
      );
    }

    cookieStore.delete(OAUTH_STATE_COOKIE);
    const connectedKey = pending.providerType === "outlook" ? "business_email" : "calendar";
    const successPath = `${pending.redirectPath}${pending.redirectPath?.includes("?") ? "&" : "?"}connected=${encodeURIComponent(connectedKey)}`;
    return NextResponse.redirect(new URL(successPath, request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    const path = pending?.redirectPath || "/";
    return NextResponse.redirect(
      new URL(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
