import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import {
  buildGoogleAuthorizeUrl,
  getSharedOAuthStateStore,
  GMAIL_OAUTH_SCOPES,
  isGoogleOAuthAppConfigured,
  getGoogleOAuthAppConfig,
} from "@/lib/server/liveIntegrations";
import { cookies } from "next/headers";

const OAUTH_STATE_COOKIE = "vt_google_oauth_state";

export async function POST(
  _request: Request,
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

    const config = getGoogleOAuthAppConfig();
    const stateStore = getSharedOAuthStateStore();
    const state = stateStore.create({
      businessId,
      connectionType: "business_email",
      providerType: "gmail",
      redirectPath: `/b/${businessId}/integrations?focus=business_email`,
    });

    // Cookie backup — in-memory state is lost on Next.js HMR / restart mid-OAuth.
    const cookieStore = await cookies();
    cookieStore.set({
      name: OAUTH_STATE_COOKIE,
      value: JSON.stringify({
        state: state.state,
        businessId,
        connectionType: "business_email",
        providerType: "gmail",
        redirectPath: `/b/${businessId}/integrations?focus=business_email`,
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
    });

    return NextResponse.json({ ok: true, authorizeUrl, state: state.state });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
