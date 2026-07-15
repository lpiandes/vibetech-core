import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import {
  buildGoogleAuthorizeUrl,
  getSharedOAuthStateStore,
  GOOGLE_CALENDAR_OAUTH_SCOPES,
  isGoogleOAuthAppConfigured,
  getGoogleOAuthAppConfig,
} from "@/lib/server/liveIntegrations";

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
        { error: "Google Calendar OAuth is not configured on this server.", code: "NOT_CONFIGURED" },
        { status: 501 },
      );
    }

    const config = getGoogleOAuthAppConfig();
    const state = getSharedOAuthStateStore().create({
      businessId,
      connectionType: "calendar",
      providerType: "google_calendar",
      redirectPath: `/b/${businessId}/integrations?focus=calendar`,
    });

    const cookieStore = await cookies();
    cookieStore.set({
      name: OAUTH_STATE_COOKIE,
      value: JSON.stringify({
        state: state.state,
        businessId,
        connectionType: "calendar",
        providerType: "google_calendar",
        redirectPath: `/b/${businessId}/integrations?focus=calendar`,
      }),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    const authorizeUrl = buildGoogleAuthorizeUrl({
      state: state.state,
      scopes: GOOGLE_CALENDAR_OAUTH_SCOPES,
      redirectUri: config.redirectUri,
    });

    return NextResponse.json({ ok: true, authorizeUrl, state: state.state });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
