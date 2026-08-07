import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import {
  buildMicrosoftAuthorizeUrl,
  getSharedOAuthStateStore,
  OUTLOOK_MAIL_OAUTH_SCOPES,
  isMicrosoftOAuthAppConfigured,
  getMicrosoftOAuthAppConfig,
} from "@/lib/server/liveIntegrations";
import { resolveOAuthReturnPath } from "@/lib/connections/integrationFocusRouting.js";

const OAUTH_STATE_COOKIE = "vt_microsoft_oauth_state";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);

    if (!isMicrosoftOAuthAppConfigured()) {
      return NextResponse.json(
        { error: "Outlook OAuth is not configured on this server.", code: "NOT_CONFIGURED" },
        { status: 501 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const redirectPath = resolveOAuthReturnPath(
      body?.returnTo,
      `/b/${businessId}/integrations`,
    );

    const config = getMicrosoftOAuthAppConfig();
    const stateStore = getSharedOAuthStateStore();
    const state = stateStore.create({
      businessId,
      connectionType: "business_email",
      providerType: "outlook",
      redirectPath,
    });

    const cookieStore = await cookies();
    cookieStore.set({
      name: OAUTH_STATE_COOKIE,
      value: JSON.stringify({
        state: state.state,
        businessId,
        connectionType: "business_email",
        providerType: "outlook",
        redirectPath,
      }),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    const authorizeUrl = buildMicrosoftAuthorizeUrl({
      state: state.state,
      scopes: OUTLOOK_MAIL_OAUTH_SCOPES,
      redirectUri: config.redirectUri,
      prompt: "consent",
    });

    return NextResponse.json({ ok: true, authorizeUrl, state: state.state });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
