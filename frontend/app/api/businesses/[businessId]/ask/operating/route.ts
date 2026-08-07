import { NextResponse } from "next/server";

import { getAuthorizedBusinessScope, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  answerOperatingCommand,
  formatOperatingCommandReply,
  OPERATING_ASK_SUGGESTIONS,
} from "../../../../../../../backend/core/ai-builder/askOperatingCommand.js";

/**
 * POST — grounded Ask operating command (no empty chat).
 * Returns evidence-backed answer when intent matches; otherwise handled:false so UI can open Architect.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.WORK_VIEW);
    const body = await request.json().catch(() => ({}));
    const text = String(body?.prompt ?? body?.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ ok: false, error: "Prompt required." }, { status: 400 });
    }

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({
        ok: true,
        handled: false,
        message: "Business installation not found — open Ask to continue setup.",
        suggestions: [...OPERATING_ASK_SUGGESTIONS],
      });
    }

    const grounded = answerOperatingCommand({
      text,
      installation,
      businessId,
    });

    if (!grounded?.handled) {
      return NextResponse.json({
        ok: true,
        handled: false,
        message: null,
        suggestions: [...OPERATING_ASK_SUGGESTIONS],
      });
    }

    return NextResponse.json({
      ok: true,
      handled: true,
      inventedFacts: Boolean(grounded.inventedFacts),
      refused: Boolean(grounded.refused),
      message: formatOperatingCommandReply(grounded) ?? grounded.message,
      evidence: grounded.evidence ?? [],
      actionDraft: grounded.actionDraft ?? null,
      href: grounded.href ?? null,
      suggestions: [...OPERATING_ASK_SUGGESTIONS],
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
