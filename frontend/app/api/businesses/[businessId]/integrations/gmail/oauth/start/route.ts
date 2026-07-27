import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import {
  buildGoogleAuthorizeUrl,
  getSharedOAuthStateStore,
  GMAIL_OAUTH_SCOPES,
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
        { error: "Gmail OAuth is not configured on this server.", code: "NOT_CONFIGURED" },
        { status: 501 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const redirectPath = resolveOAuthReturnPath(
      body?.returnTo,
      `/b/${businessId}/integrations`,
    );

    const config = getGoogleOAuthAppConfig();
    const stateStore = getSharedOAuthStateStore();
    const state = stateStore.create({
      businessId,
      connectionType: "business_email",
      providerType: "gmail",
      redirectPath,
    });

    const cookieStore = await cookies();
    cookieStore.set({
      name: OAUTH_STATE_COOKIE,
      value: JSON.stringify({
        state: state.state,
        businessId,
        connectionType: "business_email",
        providerType: "gmail",
        redirectPath,
      }),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    const authorizeUrl = buildGoogleAuthorizeUrl({
      state: state.state,
      scopes: GMAIL_OAUTH_SCOPES,
      redirectUri: config.redirectUri,
      // Don't merge prior calendar-only grants — require a fresh gmail.send consent.
      includeGrantedScopes: false,
      prompt: "consent",
    });

    return NextResponse.json({ ok: true, authorizeUrl, state: state.state });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
