import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import {
  buildGoogleAuthorizeUrl,
  getSharedOAuthStateStore,
  GOOGLE_SEARCH_CONSOLE_OAUTH_SCOPES,
  isGoogleOAuthAppConfigured,
  getGoogleOAuthAppConfig,
} from "@/lib/server/liveIntegrations";
import { resolveOAuthReturnPath } from "@/lib/connections/integrationFocusRouting.js";

const OAUTH_STATE_COOKIE = "vt_google_oauth_state";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    if (!isGoogleOAuthAppConfigured()) {
      return NextResponse.json(
        { error: "Google OAuth is not configured on this server.", code: "NOT_CONFIGURED" },
        { status: 501 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const redirectPath = resolveOAuthReturnPath(
      body?.returnTo,
      `/b/${businessId}/integrations`,
    );

    const state = getSharedOAuthStateStore().create({
      businessId,
      connectionType: "google_search_console",
      providerType: "google_search_console",
      redirectPath,
    });
    const cookieStore = await cookies();
    cookieStore.set({
      name: OAUTH_STATE_COOKIE,
      value: JSON.stringify({
        state: state.state,
        businessId,
        connectionType: "google_search_console",
        providerType: "google_search_console",
        redirectPath,
      }),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    return NextResponse.json({
      ok: true,
      authorizeUrl: buildGoogleAuthorizeUrl({
        state: state.state,
        scopes: GOOGLE_SEARCH_CONSOLE_OAUTH_SCOPES,
        redirectUri: getGoogleOAuthAppConfig().redirectUri,
      }),
      state: state.state,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
