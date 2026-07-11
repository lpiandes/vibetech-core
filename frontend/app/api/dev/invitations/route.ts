import { NextResponse } from "next/server";

import { listDevelopmentInvitations } from "@/lib/server/compose";
import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requirePlatformAdmin();
    const invitations = await listDevelopmentInvitations();
    return NextResponse.json({ devMode: true, invitations });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
